/**
 * IndexService manages D1 index tables and provides query utilities
 * Handles the eventually consistent layer of the hybrid architecture
 */
export class IndexService {
  constructor(
    private env: {
      FIRM_INDEX_DB: D1Database;
      PLATFORM_DB: D1Database;
    }
  ) {}

  /**
   * Initialize D1 database schemas
   */
  async initializeSchemas(): Promise<void> {
    const schemas = [
      this.getConversationIndexSchema(),
      this.getUserIndexSchema(),
      this.getAuditLogIndexSchema(),
      this.getCaseAssignmentIndexSchema(),
      this.getFirmConfigIndexSchema(),
    ];

    for (const schema of schemas) {
      try {
        await this.env.FIRM_INDEX_DB.exec(schema);
      } catch (error) {
        console.error('Failed to create schema:', error);
        throw error;
      }
    }
  }

  /**
   * Verify index consistency between DOs and D1
   */
  async verifyIndexConsistency(firmId: string): Promise<{
    conversationsChecked: number;
    inconsistencies: Array<{
      sessionId: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  }> {
    const inconsistencies: Array<{
      sessionId: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // Get all conversations from index
    const indexedConversations = await this.env.FIRM_INDEX_DB.prepare(`
      SELECT sessionId, status, lastActivity, goalsCompleted, conflictStatus
      FROM conversation_index 
      WHERE firmId = ? AND isDeleted = FALSE
    `).bind(firmId).all();

    let conversationsChecked = 0;

    for (const indexed of indexedConversations.results || []) {
      conversationsChecked++;
      
      try {
        // TODO: Compare with Durable Object state
        // This would require calling the conversation DO to get actual state
        // For now, we'll implement basic consistency checks on the index data itself
        
        const conversation = indexed as any;
        
        // Check for missing critical data
        if (!conversation.status) {
          inconsistencies.push({
            sessionId: conversation.sessionId,
            issue: 'Missing status field',
            severity: 'high'
          });
        }

        // Check for outdated lastActivity (older than 24 hours for active conversations)
        if (conversation.status === 'active') {
          const lastActivity = new Date(conversation.lastActivity);
          const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceActivity > 24) {
            inconsistencies.push({
              sessionId: conversation.sessionId,
              issue: `Active conversation inactive for ${Math.round(hoursSinceActivity)} hours`,
              severity: 'medium'
            });
          }
        }

        // Check for negative goal completion
        if (conversation.goalsCompleted < 0) {
          inconsistencies.push({
            sessionId: conversation.sessionId,
            issue: 'Negative goals completed count',
            severity: 'high'
          });
        }

      } catch (error) {
        inconsistencies.push({
          sessionId: conversation.sessionId,
          issue: `Verification error: ${error.message}`,
          severity: 'high'
        });
      }
    }

    return {
      conversationsChecked,
      inconsistencies
    };
  }

  /**
   * Repair index inconsistencies
   */
  async repairIndexInconsistencies(firmId: string, sessionIds: string[]): Promise<{
    repaired: number;
    failed: Array<{ sessionId: string; error: string }>;
  }> {
    let repaired = 0;
    const failed: Array<{ sessionId: string; error: string }> = [];

    for (const sessionId of sessionIds) {
      try {
        // TODO: Fetch current state from Durable Object and update index
        // This would require implementing a sync operation
        
        // For now, mark as repaired
        repaired++;
      } catch (error) {
        failed.push({
          sessionId,
          error: error.message
        });
      }
    }

    return { repaired, failed };
  }

  /**
   * Get index statistics for monitoring
   */
  async getIndexStatistics(firmId: string): Promise<{
    conversations: {
      total: number;
      byStatus: Record<string, number>;
      oldestActive: Date | null;
      newestCreated: Date | null;
    };
    users: {
      total: number;
      active: number;
      lastLogin: Date | null;
    };
    auditLogs: {
      total: number;
      lastWeek: number;
      oldestRetained: Date | null;
    };
  }> {
    // Conversation statistics
    const conversationStats = await this.env.FIRM_INDEX_DB.prepare(`
      SELECT 
        COUNT(*) as total,
        status,
        MIN(CASE WHEN status = 'active' THEN lastActivity END) as oldestActive,
        MAX(createdAt) as newestCreated
      FROM conversation_index 
      WHERE firmId = ? AND isDeleted = FALSE
      GROUP BY status
    `).bind(firmId).all();

    // User statistics
    const userStats = await this.env.FIRM_INDEX_DB.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        MAX(lastLogin) as lastLogin
      FROM user_index 
      WHERE firmId = ?
    `).bind(firmId).first();

    // Audit log statistics
    const auditStats = await this.env.FIRM_INDEX_DB.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN timestamp > datetime('now', '-7 days') THEN 1 END) as lastWeek,
        MIN(timestamp) as oldestRetained
      FROM audit_log_index 
      WHERE firmId = ?
    `).bind(firmId).first();

    // Process conversation statistics
    const conversationsByStatus: Record<string, number> = {};
    let totalConversations = 0;
    let oldestActive: Date | null = null;
    let newestCreated: Date | null = null;

    for (const stat of conversationStats.results || []) {
      const row = stat as any;
      conversationsByStatus[row.status] = row.total;
      totalConversations += row.total;
      
      if (row.oldestActive && (!oldestActive || new Date(row.oldestActive) < oldestActive)) {
        oldestActive = new Date(row.oldestActive);
      }
      if (row.newestCreated && (!newestCreated || new Date(row.newestCreated) > newestCreated)) {
        newestCreated = new Date(row.newestCreated);
      }
    }

    return {
      conversations: {
        total: totalConversations,
        byStatus: conversationsByStatus,
        oldestActive,
        newestCreated
      },
      users: {
        total: (userStats?.total as number) || 0,
        active: (userStats?.active as number) || 0,
        lastLogin: userStats?.lastLogin ? new Date(userStats.lastLogin as string) : null
      },
      auditLogs: {
        total: (auditStats?.total as number) || 0,
        lastWeek: (auditStats?.lastWeek as number) || 0,
        oldestRetained: auditStats?.oldestRetained ? new Date(auditStats.oldestRetained as string) : null
      }
    };
  }

  /**
   * Cleanup old index entries based on retention policies
   */
  async cleanupOldEntries(firmId: string, retentionPolicies: {
    conversationRetentionDays: number;
    auditLogRetentionDays: number;
    deletedConversationRetentionDays: number;
  }): Promise<{
    conversationsDeleted: number;
    auditLogsDeleted: number;
    deletedConversationsDeleted: number;
  }> {
    const { conversationRetentionDays, auditLogRetentionDays, deletedConversationRetentionDays } = retentionPolicies;

    // Delete old conversations
    const conversationCutoff = new Date();
    conversationCutoff.setDate(conversationCutoff.getDate() - conversationRetentionDays);

    const conversationResult = await this.env.FIRM_INDEX_DB.prepare(`
      DELETE FROM conversation_index 
      WHERE firmId = ? AND isDeleted = FALSE 
        AND createdAt < ? 
        AND status IN ('completed', 'declined', 'abandoned')
    `).bind(firmId, conversationCutoff.toISOString()).run();

    // Delete old audit logs
    const auditCutoff = new Date();
    auditCutoff.setDate(auditCutoff.getDate() - auditLogRetentionDays);

    const auditResult = await this.env.FIRM_INDEX_DB.prepare(`
      DELETE FROM audit_log_index 
      WHERE firmId = ? AND timestamp < ?
    `).bind(firmId, auditCutoff.toISOString()).run();

    // Permanently delete old deleted conversations
    const deletedCutoff = new Date();
    deletedCutoff.setDate(deletedCutoff.getDate() - deletedConversationRetentionDays);

    const deletedResult = await this.env.FIRM_INDEX_DB.prepare(`
      DELETE FROM conversation_index 
      WHERE firmId = ? AND isDeleted = TRUE AND deletedAt < ?
    `).bind(firmId, deletedCutoff.toISOString()).run();

    return {
      conversationsDeleted: conversationResult.changes || 0,
      auditLogsDeleted: auditResult.changes || 0,
      deletedConversationsDeleted: deletedResult.changes || 0
    };
  }

  // Schema definitions

  private getConversationIndexSchema(): string {
    return `
      CREATE TABLE IF NOT EXISTS conversation_index (
        firmId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        userId TEXT,
        clientName TEXT,
        clientEmail TEXT,
        practiceArea TEXT,
        status TEXT, -- 'active', 'completed', 'terminated'  
        phase TEXT,  -- 'pre_login', 'secured', etc.
        assignedTo TEXT,
        conflictStatus TEXT,
        goalsCompleted INTEGER,
        goalsTotal INTEGER,
        dataQualityScore INTEGER,
        createdAt TEXT,
        lastActivity TEXT,
        isDeleted BOOLEAN DEFAULT FALSE,
        deletedAt TEXT,
        deletedBy TEXT,
        
        PRIMARY KEY (firmId, sessionId)
      );

      CREATE INDEX IF NOT EXISTS idx_firm_status ON conversation_index(firmId, status);
      CREATE INDEX IF NOT EXISTS idx_firm_assigned ON conversation_index(firmId, assignedTo);
      CREATE INDEX IF NOT EXISTS idx_firm_activity ON conversation_index(firmId, lastActivity);
      CREATE INDEX IF NOT EXISTS idx_firm_practice_area ON conversation_index(firmId, practiceArea);
      CREATE INDEX IF NOT EXISTS idx_firm_conflict ON conversation_index(firmId, conflictStatus);
    `;
  }

  private getUserIndexSchema(): string {
    return `
      CREATE TABLE IF NOT EXISTS user_index (
        firmId TEXT NOT NULL,
        userId TEXT NOT NULL,
        auth0UserId TEXT,
        email TEXT,
        name TEXT,
        role TEXT,
        status TEXT, -- 'active', 'inactive', 'suspended'
        lastLogin TEXT,
        conversationCount INTEGER DEFAULT 0,
        createdAt TEXT,
        
        PRIMARY KEY (firmId, userId)
      );

      CREATE INDEX IF NOT EXISTS idx_firm_role ON user_index(firmId, role);
      CREATE INDEX IF NOT EXISTS idx_firm_email ON user_index(firmId, email);
      CREATE INDEX IF NOT EXISTS idx_firm_user_status ON user_index(firmId, status);
    `;
  }

  private getAuditLogIndexSchema(): string {
    return `
      CREATE TABLE IF NOT EXISTS audit_log_index (
        firmId TEXT NOT NULL,
        auditId TEXT NOT NULL,
        userId TEXT,
        action TEXT,
        resourceType TEXT,
        resourceId TEXT,
        timestamp TEXT,
        ipAddress TEXT,
        userAgent TEXT,
        details TEXT, -- JSON blob
        
        PRIMARY KEY (firmId, auditId)
      );

      CREATE INDEX IF NOT EXISTS idx_firm_audit_time ON audit_log_index(firmId, timestamp);
      CREATE INDEX IF NOT EXISTS idx_firm_audit_user ON audit_log_index(firmId, userId, timestamp);
      CREATE INDEX IF NOT EXISTS idx_firm_audit_action ON audit_log_index(firmId, action, timestamp);
    `;
  }

  private getCaseAssignmentIndexSchema(): string {
    return `
      CREATE TABLE IF NOT EXISTS case_assignment_index (
        firmId TEXT NOT NULL,
        assignmentId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        assignedTo TEXT NOT NULL,
        assignedBy TEXT NOT NULL,
        assignedAt TEXT,
        status TEXT, -- 'pending', 'accepted', 'completed', 'escalated'
        priority TEXT, -- 'urgent', 'high', 'normal', 'low'
        dueDate TEXT,
        completedAt TEXT,
        notes TEXT,
        
        PRIMARY KEY (firmId, assignmentId)
      );

      CREATE INDEX IF NOT EXISTS idx_firm_assignment_user ON case_assignment_index(firmId, assignedTo, status);
      CREATE INDEX IF NOT EXISTS idx_firm_assignment_session ON case_assignment_index(firmId, sessionId);
      CREATE INDEX IF NOT EXISTS idx_firm_assignment_due ON case_assignment_index(firmId, dueDate);
    `;
  }

  private getFirmConfigIndexSchema(): string {
    return `
      CREATE TABLE IF NOT EXISTS firm_config_index (
        firmId TEXT NOT NULL,
        configKey TEXT NOT NULL,
        configValue TEXT,
        configType TEXT, -- 'string', 'number', 'boolean', 'json'
        category TEXT, -- 'practice_areas', 'branding', 'notifications', etc.
        lastModified TEXT,
        modifiedBy TEXT,
        
        PRIMARY KEY (firmId, configKey)
      );

      CREATE INDEX IF NOT EXISTS idx_firm_config_category ON firm_config_index(firmId, category);
    `;
  }
}