/**
 * Conversation API Routes
 * 
 * Implements the hybrid data routing strategy:
 * - GET /conversations → D1 index for fast list queries
 * - GET /conversations/{id} → Durable Object for complete conversation state
 * - POST/PUT/DELETE → Durable Object + async D1 sync
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import type { Env } from '@/api/api-worker';
import type { 
  ConversationListParams, 
  ConversationListResponse, 
  ConversationDetailResponse,
  AddMessageRequest,
  AssignConversationRequest,
  UpdateConversationRequest
} from '@/types/api';

import { requirePermissions } from '@/middleware/auth';
import { ConversationService } from '@/services/data-layer/conversation-service';
import { IndexService } from '@/services/data-layer/index-service';
import { ValidationError, NotFoundError } from '@/api/error-handler';
import { buildPagination } from '@/utils/common/pagination';

const conversations = new Hono<{ Bindings: Env }>();

// Validation schemas
const conversationListSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(['lastActivity', 'createdAt', 'dataQualityScore']).default('lastActivity'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['active', 'completed', 'terminated']).optional(),
  assignedTo: z.string().optional(),
  practiceArea: z.string().optional(),
  conflictStatus: z.enum(['clear', 'conflict_detected', 'pending']).optional(),
  clientName: z.string().optional()
});

const addMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  metadata: z.record(z.unknown()).optional()
});

const assignConversationSchema = z.object({
  assignedTo: z.string().min(1),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).default('normal'),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
  notes: z.string().max(1000).optional()
});

const updateConversationSchema = z.object({
  status: z.enum(['active', 'completed', 'terminated']).optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional()
});

// ============================================================================
// List Conversations (D1 Index Query)
// ============================================================================

conversations.get(
  '/',
  requirePermissions(['view_all_conversations', 'view_assigned_conversations']),
  zValidator('query', conversationListSchema),
  async (c) => {
    const params = c.req.valid('query') as ConversationListParams;
    const firm = c.get('firm');
    const user = c.get('user');
    
    const indexService = new IndexService(c.env.FIRM_INDEX_DB);
    
    // If user only has view_assigned_conversations permission, filter by user
    if (!user.permissions.includes('view_all_conversations')) {
      params.assignedTo = user.userId;
    }
    
    const result = await indexService.getConversations(firm.firmId, params);
    
    const response: ConversationListResponse = {
      data: result.conversations,
      pagination: buildPagination(result.total, params.limit, params.offset)
    };
    
    return c.json(response);
  }
);

// ============================================================================
// Get Conversation Details (Durable Object Query)
// ============================================================================

conversations.get(
  '/:sessionId',
  requirePermissions(['view_all_conversations', 'view_assigned_conversations']),
  async (c) => {
    const sessionId = c.req.param('sessionId');
    const firm = c.get('firm');
    const user = c.get('user');
    
    if (!sessionId) {
      throw new ValidationError('Session ID is required');
    }
    
    const conversationService = new ConversationService(
      c.env.CONVERSATION_SESSION,
      c.env.FIRM_INDEX_DB
    );
    
    const conversation = await conversationService.getConversation(sessionId);
    
    if (!conversation) {
      throw new NotFoundError(`Conversation with ID ${sessionId}`);
    }
    
    // Check if conversation belongs to this firm
    if (conversation.firmId !== firm.firmId) {
      throw new NotFoundError(`Conversation with ID ${sessionId}`);
    }
    
    // Check if user can access this specific conversation
    if (!user.permissions.includes('view_all_conversations')) {
      if (conversation.assignedTo !== user.userId) {
        throw new NotFoundError(`Conversation with ID ${sessionId}`);
      }
    }
    
    // Enhance response with additional computed fields
    const response: ConversationDetailResponse = {
      ...conversation,
      assignedToName: conversation.assignedTo 
        ? await getUserName(conversation.assignedTo, c.env.FIRM_INDEX_DB)
        : undefined,
      estimatedCompletionTime: calculateEstimatedCompletion(conversation),
      similarConversations: await findSimilarConversations(conversation, c.env.KNOWLEDGE_BASE)
    };
    
    return c.json(response);
  }
);

// ============================================================================
// Add Message (Durable Object Write + D1 Sync)
// ============================================================================

conversations.post(
  '/:sessionId/messages',
  requirePermissions(['manage_conversations']),
  zValidator('json', addMessageSchema),
  async (c) => {
    const sessionId = c.req.param('sessionId');
    const messageData = c.req.valid('json') as AddMessageRequest;
    const firm = c.get('firm');
    const user = c.get('user');
    
    const conversationService = new ConversationService(
      c.env.CONVERSATION_SESSION,
      c.env.FIRM_INDEX_DB
    );
    
    // Add message to conversation (Durable Object)
    const result = await conversationService.addMessage(
      sessionId,
      {
        content: messageData.content,
        role: 'user', // Messages from API are user messages
        metadata: {
          ...messageData.metadata,
          addedBy: user.userId,
          addedAt: new Date().toISOString()
        }
      }
    );
    
    if (!result) {
      throw new NotFoundError(`Conversation with ID ${sessionId}`);
    }
    
    // Async index update (non-blocking)
    c.executionCtx.waitUntil(
      conversationService.syncToIndex(sessionId, firm.firmId)
    );
    
    return c.json({ success: true, messageId: result.messageId });
  }
);

// ============================================================================
// Assign Conversation (Durable Object Write + D1 Sync)
// ============================================================================

conversations.put(
  '/:sessionId/assignment',
  requirePermissions(['assign_conversations']),
  zValidator('json', assignConversationSchema),
  async (c) => {
    const sessionId = c.req.param('sessionId');
    const assignmentData = c.req.valid('json') as AssignConversationRequest;
    const firm = c.get('firm');
    const user = c.get('user');
    
    const conversationService = new ConversationService(
      c.env.CONVERSATION_SESSION,
      c.env.FIRM_INDEX_DB
    );
    
    // Validate assignee exists and belongs to firm
    const assigneeExists = await c.env.FIRM_INDEX_DB.prepare(`
      SELECT userId FROM user_index 
      WHERE firmId = ? AND userId = ? AND status = 'active'
    `).bind(firm.firmId, assignmentData.assignedTo).first();
    
    if (!assigneeExists) {
      throw new ValidationError('Invalid assignee - user not found or inactive');
    }
    
    // Assign conversation
    const result = await conversationService.assignConversation(
      sessionId,
      {
        assignedTo: assignmentData.assignedTo,
        assignedBy: user.userId,
        assignedAt: new Date().toISOString(),
        priority: assignmentData.priority,
        dueDate: assignmentData.dueDate,
        estimatedHours: assignmentData.estimatedHours,
        notes: assignmentData.notes
      }
    );
    
    if (!result) {
      throw new NotFoundError(`Conversation with ID ${sessionId}`);
    }
    
    // Async index updates (non-blocking)
    c.executionCtx.waitUntil(Promise.all([
      conversationService.syncToIndex(sessionId, firm.firmId),
      updateAssignmentIndex(sessionId, assignmentData, user.userId, c.env.FIRM_INDEX_DB)
    ]));
    
    return c.json({ success: true });
  }
);

// ============================================================================
// Update Conversation (Durable Object Write + D1 Sync)
// ============================================================================

conversations.put(
  '/:sessionId',
  requirePermissions(['manage_conversations']),
  zValidator('json', updateConversationSchema),
  async (c) => {
    const sessionId = c.req.param('sessionId');
    const updateData = c.req.valid('json') as UpdateConversationRequest;
    const firm = c.get('firm');
    const user = c.get('user');
    
    const conversationService = new ConversationService(
      c.env.CONVERSATION_SESSION,
      c.env.FIRM_INDEX_DB
    );
    
    const result = await conversationService.updateConversation(
      sessionId,
      {
        ...updateData,
        updatedBy: user.userId,
        updatedAt: new Date().toISOString()
      }
    );
    
    if (!result) {
      throw new NotFoundError(`Conversation with ID ${sessionId}`);
    }
    
    // Async index update (non-blocking)
    c.executionCtx.waitUntil(
      conversationService.syncToIndex(sessionId, firm.firmId)
    );
    
    return c.json({ success: true });
  }
);

// ============================================================================
// Delete Conversation (Durable Object + D1 Sync)
// ============================================================================

conversations.delete(
  '/:sessionId',
  requirePermissions(['delete_conversations']),
  async (c) => {
    const sessionId = c.req.param('sessionId');
    const firm = c.get('firm');
    const user = c.get('user');
    
    const conversationService = new ConversationService(
      c.env.CONVERSATION_SESSION,
      c.env.FIRM_INDEX_DB
    );
    
    const result = await conversationService.deleteConversation(
      sessionId,
      {
        deletedBy: user.userId,
        deletedAt: new Date().toISOString(),
        reason: 'deleted_via_api'
      }
    );
    
    if (!result) {
      throw new NotFoundError(`Conversation with ID ${sessionId}`);
    }
    
    // Async index update (non-blocking)
    c.executionCtx.waitUntil(
      conversationService.syncToIndex(sessionId, firm.firmId)
    );
    
    return c.json({ success: true });
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

async function getUserName(userId: string, db: D1Database): Promise<string | undefined> {
  const user = await db.prepare(`
    SELECT name FROM user_index WHERE userId = ?
  `).bind(userId).first();
  
  return user?.name as string | undefined;
}

function calculateEstimatedCompletion(conversation: any): number {
  // Simple estimation based on goals completed
  const completionRate = conversation.completedGoals.length / Math.max(conversation.dataGoals.length, 1);
  const avgGoalTime = 15; // minutes per goal
  const remainingGoals = conversation.dataGoals.length - conversation.completedGoals.length;
  
  return remainingGoals * avgGoalTime;
}

async function findSimilarConversations(conversation: any, vectorizeIndex: VectorizeIndex): Promise<string[]> {
  // Use Vectorize to find semantically similar conversations
  try {
    const query = `${conversation.userIdentity.legalArea} ${conversation.userIdentity.basicSituation}`;
    const results = await vectorizeIndex.query(query, { topK: 3 });
    
    return results.matches?.map(match => match.id) || [];
  } catch (error) {
    console.error('Failed to find similar conversations:', error);
    return [];
  }
}

async function updateAssignmentIndex(
  sessionId: string, 
  assignmentData: AssignConversationRequest, 
  assignedBy: string, 
  db: D1Database
): Promise<void> {
  await db.prepare(`
    INSERT OR REPLACE INTO case_assignment_index 
    (sessionId, assignedTo, assignedBy, assignedAt, status, priority, dueDate, estimatedHours, notes)
    VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `).bind(
    sessionId,
    assignmentData.assignedTo,
    assignedBy,
    new Date().toISOString(),
    assignmentData.priority,
    assignmentData.dueDate,
    assignmentData.estimatedHours,
    assignmentData.notes
  ).run();
}

export { conversations as conversationRoutes };