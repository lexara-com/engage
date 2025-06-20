import { z } from 'zod';
import type { ConversationSession, ConversationState, Message } from '../../types/api';

/**
 * ConversationService handles all conversation-related operations
 * Routes between Durable Objects (source of truth) and D1 (indexes)
 */
export class ConversationService {
  constructor(
    private env: {
      CONVERSATION_SESSION: DurableObjectNamespace;
      FIRM_INDEX_DB: D1Database;
      VECTORIZE_KNOWLEDGE: VectorizeIndex;
    }
  ) {}

  /**
   * Create a new conversation session
   */
  async createConversation(firmId: string, initialData: {
    userId?: string;
    clientName?: string;
    practiceArea?: string;
  }): Promise<ConversationSession> {
    // Generate session ID
    const sessionId = this.generateSessionId();
    const userId = initialData.userId || this.generateUserId();
    
    // Create conversation in Durable Object (source of truth)
    const conversationDO = this.getConversationDO(sessionId);
    const conversation = await conversationDO.create({
      sessionId,
      userId,
      firmId,
      ...initialData,
    });

    // Async sync to D1 index (non-blocking)
    this.env.ctx?.waitUntil(this.syncConversationToIndex(conversation));

    return conversation;
  }

  /**
   * Get conversation details (from Durable Object - source of truth)
   */
  async getConversation(sessionId: string): Promise<ConversationState | null> {
    const conversationDO = this.getConversationDO(sessionId);
    return await conversationDO.getState();
  }

  /**
   * List conversations for a firm (from D1 index - fast queries)
   */
  async listConversations(firmId: string, options: {
    status?: string;
    assignedTo?: string;
    practiceArea?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'lastActivity' | 'createdAt' | 'status';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    conversations: ConversationSession[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      status,
      assignedTo,
      practiceArea,
      limit = 50,
      offset = 0,
      sortBy = 'lastActivity',
      sortOrder = 'desc'
    } = options;

    // Build dynamic SQL query
    let query = `
      SELECT 
        sessionId, userId, firmId, clientName, clientEmail, 
        practiceArea, status, phase, assignedTo, conflictStatus,
        goalsCompleted, goalsTotal, dataQualityScore,
        createdAt, lastActivity
      FROM conversation_index 
      WHERE firmId = ? AND isDeleted = FALSE
    `;
    
    const params: any[] = [firmId];

    // Add filters
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (assignedTo) {
      query += ` AND assignedTo = ?`;
      params.push(assignedTo);
    }
    if (practiceArea) {
      query += ` AND practiceArea = ?`;
      params.push(practiceArea);
    }

    // Add sorting
    query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    // Add pagination
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit + 1, offset); // +1 to check hasMore

    // Execute query
    const result = await this.env.FIRM_INDEX_DB.prepare(query).bind(...params).all();
    
    const conversations = result.results?.slice(0, limit) || [];
    const hasMore = (result.results?.length || 0) > limit;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM conversation_index 
      WHERE firmId = ? AND isDeleted = FALSE
      ${status ? 'AND status = ?' : ''}
      ${assignedTo ? 'AND assignedTo = ?' : ''}
      ${practiceArea ? 'AND practiceArea = ?' : ''}
    `;
    
    const countParams = [firmId];
    if (status) countParams.push(status);
    if (assignedTo) countParams.push(assignedTo);
    if (practiceArea) countParams.push(practiceArea);

    const countResult = await this.env.FIRM_INDEX_DB.prepare(countQuery).bind(...countParams).first();
    const total = countResult?.total as number || 0;

    return {
      conversations: conversations as ConversationSession[],
      total,
      hasMore
    };
  }

  /**
   * Add message to conversation (update DO, sync to D1)
   */
  async addMessage(sessionId: string, message: {
    content: string;
    role: 'user' | 'assistant';
    timestamp?: Date;
    metadata?: Record<string, any>;
  }): Promise<ConversationState> {
    // Update Durable Object (immediate, strongly consistent)
    const conversationDO = this.getConversationDO(sessionId);
    const updatedState = await conversationDO.addMessage({
      ...message,
      timestamp: message.timestamp || new Date(),
    });

    // Async sync to D1 index (non-blocking, eventually consistent)
    this.env.ctx?.waitUntil(this.syncConversationToIndex(updatedState));

    return updatedState;
  }

  /**
   * Assign conversation to user (update DO, sync to D1)
   */
  async assignConversation(sessionId: string, assigneeUserId: string, assignedBy: string): Promise<ConversationState> {
    const conversationDO = this.getConversationDO(sessionId);
    const updatedState = await conversationDO.assign({
      assignedTo: assigneeUserId,
      assignedBy,
      assignedAt: new Date(),
    });

    // Sync assignment to index
    this.env.ctx?.waitUntil(this.syncConversationToIndex(updatedState));

    return updatedState;
  }

  /**
   * Update conversation status (update DO, sync to D1)
   */
  async updateConversationStatus(sessionId: string, status: string, updatedBy: string): Promise<ConversationState> {
    const conversationDO = this.getConversationDO(sessionId);
    const updatedState = await conversationDO.updateStatus({
      status,
      updatedBy,
      updatedAt: new Date(),
    });

    // Sync status to index
    this.env.ctx?.waitUntil(this.syncConversationToIndex(updatedState));

    return updatedState;
  }

  /**
   * Search conversations using semantic search (Vectorize)
   */
  async searchConversations(firmId: string, query: string, options: {
    limit?: number;
    threshold?: number;
    practiceArea?: string;
  } = {}): Promise<{
    conversations: ConversationSession[];
    scores: number[];
  }> {
    const { limit = 20, threshold = 0.7, practiceArea } = options;

    // Perform vector search
    const searchResults = await this.env.VECTORIZE_KNOWLEDGE.query(query, {
      topK: limit,
      filter: {
        firmId,
        ...(practiceArea && { practiceArea })
      }
    });

    // Filter by threshold and extract session IDs
    const relevantResults = searchResults.matches
      .filter(match => match.score >= threshold)
      .map(match => ({
        sessionId: match.id,
        score: match.score
      }));

    if (relevantResults.length === 0) {
      return { conversations: [], scores: [] };
    }

    // Fetch conversation details from D1 index
    const sessionIds = relevantResults.map(r => r.sessionId);
    const placeholders = sessionIds.map(() => '?').join(',');
    
    const conversations = await this.env.FIRM_INDEX_DB.prepare(`
      SELECT * FROM conversation_index 
      WHERE firmId = ? AND sessionId IN (${placeholders}) AND isDeleted = FALSE
    `).bind(firmId, ...sessionIds).all();

    return {
      conversations: conversations.results as ConversationSession[],
      scores: relevantResults.map(r => r.score)
    };
  }

  /**
   * Get conversation analytics (from D1 aggregations)
   */
  async getConversationAnalytics(firmId: string, timeRange: {
    startDate: Date;
    endDate: Date;
  }): Promise<{
    totalConversations: number;
    completedConversations: number;
    averageCompletionTime: number;
    conversionRate: number;
    topPracticeAreas: Array<{ area: string; count: number }>;
    statusDistribution: Array<{ status: string; count: number }>;
  }> {
    const { startDate, endDate } = timeRange;

    // Total conversations
    const totalResult = await this.env.FIRM_INDEX_DB.prepare(`
      SELECT COUNT(*) as total 
      FROM conversation_index 
      WHERE firmId = ? AND createdAt BETWEEN ? AND ? AND isDeleted = FALSE
    `).bind(firmId, startDate.toISOString(), endDate.toISOString()).first();

    // Completed conversations
    const completedResult = await this.env.FIRM_INDEX_DB.prepare(`
      SELECT COUNT(*) as completed 
      FROM conversation_index 
      WHERE firmId = ? AND status = 'completed' 
        AND createdAt BETWEEN ? AND ? AND isDeleted = FALSE
    `).bind(firmId, startDate.toISOString(), endDate.toISOString()).first();

    // Practice area distribution
    const practiceAreasResult = await this.env.FIRM_INDEX_DB.prepare(`
      SELECT practiceArea as area, COUNT(*) as count 
      FROM conversation_index 
      WHERE firmId = ? AND createdAt BETWEEN ? AND ? AND isDeleted = FALSE
        AND practiceArea IS NOT NULL
      GROUP BY practiceArea 
      ORDER BY count DESC 
      LIMIT 10
    `).bind(firmId, startDate.toISOString(), endDate.toISOString()).all();

    // Status distribution
    const statusResult = await this.env.FIRM_INDEX_DB.prepare(`
      SELECT status, COUNT(*) as count 
      FROM conversation_index 
      WHERE firmId = ? AND createdAt BETWEEN ? AND ? AND isDeleted = FALSE
      GROUP BY status 
      ORDER BY count DESC
    `).bind(firmId, startDate.toISOString(), endDate.toISOString()).all();

    const total = totalResult?.total as number || 0;
    const completed = completedResult?.completed as number || 0;

    return {
      totalConversations: total,
      completedConversations: completed,
      averageCompletionTime: 0, // TODO: Calculate from conversation duration
      conversionRate: total > 0 ? (completed / total) * 100 : 0,
      topPracticeAreas: practiceAreasResult.results as Array<{ area: string; count: number }>,
      statusDistribution: statusResult.results as Array<{ status: string; count: number }>
    };
  }

  // Private helper methods

  private getConversationDO(sessionId: string) {
    const doId = this.env.CONVERSATION_SESSION.idFromName(sessionId);
    return this.env.CONVERSATION_SESSION.get(doId);
  }

  private generateSessionId(): string {
    // ULID implementation for session IDs
    return this.generateULID();
  }

  private generateUserId(): string {
    // ULID implementation for user IDs
    return this.generateULID();
  }

  private generateULID(): string {
    // Simple ULID implementation
    const timestamp = Date.now();
    const randomness = crypto.getRandomValues(new Uint8Array(10));
    
    // Convert to base32-like encoding
    const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    let ulid = '';
    
    // Encode timestamp (10 chars)
    let ts = timestamp;
    for (let i = 9; i >= 0; i--) {
      ulid = chars[ts % 32] + ulid;
      ts = Math.floor(ts / 32);
    }
    
    // Encode randomness (16 chars)
    for (let i = 0; i < 10; i++) {
      ulid += chars[randomness[i] % 32];
    }
    
    return ulid.substring(0, 26); // ULID is always 26 characters
  }

  /**
   * Sync conversation state to D1 index table
   */
  private async syncConversationToIndex(conversation: ConversationState): Promise<void> {
    try {
      await this.env.FIRM_INDEX_DB.prepare(`
        INSERT OR REPLACE INTO conversation_index (
          firmId, sessionId, userId, clientName, clientEmail,
          practiceArea, status, phase, assignedTo, conflictStatus,
          goalsCompleted, goalsTotal, dataQualityScore,
          createdAt, lastActivity, isDeleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        conversation.firmId,
        conversation.sessionId,
        conversation.userId,
        conversation.userIdentity?.name || null,
        conversation.userIdentity?.email || null,
        conversation.userIdentity?.legalArea || null,
        conversation.phase,
        conversation.phase,
        conversation.assignedTo || null,
        conversation.conflictCheck?.status || 'pending',
        conversation.completedGoals?.length || 0,
        conversation.dataGoals?.length || 0,
        this.calculateDataQualityScore(conversation),
        conversation.createdAt.toISOString(),
        conversation.lastActivity.toISOString(),
        conversation.isDeleted || false
      ).run();
    } catch (error) {
      console.error('Failed to sync conversation to index:', error);
      // Don't throw - index sync failures shouldn't break the primary operation
    }
  }

  /**
   * Calculate data quality score based on completed goals and information completeness
   */
  private calculateDataQualityScore(conversation: ConversationState): number {
    let score = 0;
    const maxScore = 100;

    // Goal completion score (50% of total)
    const goalCompletionRate = conversation.dataGoals?.length > 0 
      ? (conversation.completedGoals?.length || 0) / conversation.dataGoals.length 
      : 0;
    score += goalCompletionRate * 50;

    // Identity completeness score (30% of total)
    let identityCompleteness = 0;
    const identity = conversation.userIdentity;
    if (identity?.name) identityCompleteness += 0.25;
    if (identity?.email) identityCompleteness += 0.25;
    if (identity?.phone) identityCompleteness += 0.25;
    if (identity?.legalArea) identityCompleteness += 0.25;
    score += identityCompleteness * 30;

    // Conflict check score (20% of total)
    const conflictScore = conversation.conflictCheck?.status === 'clear' || 
                         conversation.conflictCheck?.status === 'conflict_detected' ? 1 : 0;
    score += conflictScore * 20;

    return Math.min(Math.round(score), maxScore);
  }
}