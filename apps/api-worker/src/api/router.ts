/**
 * API Router - Central request routing and hybrid data layer orchestration
 * 
 * This router implements the core hybrid data strategy:
 * - List operations → D1 indexes (fast SQL queries)
 * - Detail operations → Durable Objects (source of truth)
 * - Analytics operations → D1 aggregations
 * - Search operations → Vectorize + D1
 * - Write operations → Durable Objects + async D1 sync
 */

import { Hono } from 'hono';
import type { Env } from './api-worker';
import { ConversationService } from '../services/data-layer/conversation-service';
import { IndexService } from '../services/data-layer/index-service';

export class APIRouter {
  
  /**
   * Get firm-scoped API routes
   * All routes automatically scoped to authenticated firm context
   */
  getFirmRoutes(): Hono<{ Bindings: Env }> {
    const firm = new Hono<{ Bindings: Env }>();
    
    // Conversation management
    this.addConversationRoutes(firm);
    
    // User & identity management
    this.addUserRoutes(firm);
    
    // Case assignment & workload
    this.addAssignmentRoutes(firm);
    
    // Analytics & reporting
    this.addAnalyticsRoutes(firm);
    
    // Conflict detection & resolution
    this.addConflictRoutes(firm);
    
    // Search & discovery
    this.addSearchRoutes(firm);
    
    // Audit & compliance
    this.addAuditRoutes(firm);
    
    // Firm configuration
    this.addSettingsRoutes(firm);
    
    return firm;
  }
  
  /**
   * Get platform admin API routes
   * Restricted to Lexara employees only
   */
  getPlatformRoutes(): Hono<{ Bindings: Env }> {
    const platform = new Hono<{ Bindings: Env }>();
    
    // Platform firm management (Lexara employees only)
    platform.get('/firms', async (c) => {
      // List all firms for platform admins
      const result = await c.env.PLATFORM_DB.prepare(`
        SELECT firmId, legalName, displayName, status, createdAt, 
               subscriptionStatus, planId, lastActivity
        FROM firms 
        ORDER BY createdAt DESC
      `).all();
      
      return c.json({
        firms: result.results,
        total: result.results?.length || 0
      });
    });
    
    platform.get('/firms/:firmId', async (c) => {
      const firmId = c.req.param('firmId');
      
      const firm = await c.env.PLATFORM_DB.prepare(`
        SELECT * FROM firms WHERE firmId = ?
      `).bind(firmId).first();
      
      if (!firm) {
        return c.json({ error: 'Firm not found' }, 404);
      }
      
      return c.json({ firm });
    });
    
    platform.post('/firms', async (c) => {
      const firmData = await c.req.json();
      // TODO: Implement firm creation
      return c.json({ message: 'Firm creation endpoint', firmData });
    });
    
    platform.put('/firms/:firmId/status', async (c) => {
      const firmId = c.req.param('firmId');
      const { status, reason } = await c.req.json();
      
      // Update firm status (suspend/activate)
      await c.env.PLATFORM_DB.prepare(`
        UPDATE firms SET status = ?, statusReason = ?, updatedAt = ?
        WHERE firmId = ?
      `).bind(status, reason, new Date().toISOString(), firmId).run();
      
      return c.json({ success: true, firmId, status });
    });
    
    // Platform analytics
    platform.get('/analytics/usage', async (c) => {
      // Platform-wide usage metrics
      const metrics = await c.env.PLATFORM_DB.prepare(`
        SELECT 
          COUNT(*) as totalFirms,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as activeFirms,
          COUNT(CASE WHEN subscriptionStatus = 'trial' THEN 1 END) as trialFirms,
          COUNT(CASE WHEN lastActivity > datetime('now', '-30 days') THEN 1 END) as activeLast30Days
        FROM firms
      `).first();
      
      return c.json({ metrics });
    });
    
    platform.get('/health', async (c) => {
      // Detailed system health for platform monitoring
      const checks = await Promise.allSettled([
        c.env.PLATFORM_DB.prepare('SELECT 1').first(),
        c.env.FIRM_INDEX_DB.prepare('SELECT 1').first(),
        // Add more health checks
      ]);
      
      const healthy = checks.every(check => check.status === 'fulfilled');
      
      return c.json({
        status: healthy ? 'healthy' : 'degraded',
        checks: checks.map((check, i) => ({
          name: ['platform_db', 'firm_index_db'][i],
          status: check.status === 'fulfilled' ? 'ok' : 'error'
        })),
        timestamp: new Date().toISOString()
      });
    });
    
    return platform;
  }
  
  /**
   * Get webhook API routes
   * For external system integrations
   */
  getWebhookRoutes(): Hono<{ Bindings: Env }> {
    const webhooks = new Hono<{ Bindings: Env }>();
    
    // Stripe webhooks
    webhooks.post('/stripe', async (c) => {
      // TODO: Implement Stripe webhook handling
      return c.json({ message: 'Stripe webhook received' });
    });
    
    // Practice management system webhooks
    webhooks.post('/clio', async (c) => {
      // TODO: Implement Clio webhook handling
      return c.json({ message: 'Clio webhook received' });
    });
    
    return webhooks;
  }

  // Private route implementation methods
  
  private addConversationRoutes(router: Hono<{ Bindings: Env }>) {
    // List conversations (D1 index)
    router.get('/conversations', async (c) => {
      const firmId = c.get('firm').firmId;
      const query = c.req.query();
      
      const conversationService = new ConversationService({
        CONVERSATION_SESSION: c.env.CONVERSATION_SESSION,
        FIRM_INDEX_DB: c.env.FIRM_INDEX_DB,
        VECTORIZE_KNOWLEDGE: c.env.KNOWLEDGE_BASE
      });
      
      const result = await conversationService.listConversations(firmId, {
        status: query.status,
        assignedTo: query.assignedTo,
        practiceArea: query.practiceArea,
        limit: query.limit ? parseInt(query.limit) : 50,
        offset: query.offset ? parseInt(query.offset) : 0,
        sortBy: query.sortBy as any || 'lastActivity',
        sortOrder: query.sortOrder as any || 'desc'
      });
      
      return c.json(result);
    });
    
    // Get conversation details (Durable Object)
    router.get('/conversations/:sessionId', async (c) => {
      const sessionId = c.req.param('sessionId');
      
      const conversationService = new ConversationService({
        CONVERSATION_SESSION: c.env.CONVERSATION_SESSION,
        FIRM_INDEX_DB: c.env.FIRM_INDEX_DB,
        VECTORIZE_KNOWLEDGE: c.env.KNOWLEDGE_BASE
      });
      
      const conversation = await conversationService.getConversation(sessionId);
      
      if (!conversation) {
        return c.json({ error: 'Conversation not found' }, 404);
      }
      
      return c.json({ conversation });
    });
    
    // Add message to conversation (DO write + D1 sync)
    router.post('/conversations/:sessionId/messages', async (c) => {
      const sessionId = c.req.param('sessionId');
      const messageData = await c.req.json();
      
      const conversationService = new ConversationService({
        CONVERSATION_SESSION: c.env.CONVERSATION_SESSION,
        FIRM_INDEX_DB: c.env.FIRM_INDEX_DB,
        VECTORIZE_KNOWLEDGE: c.env.KNOWLEDGE_BASE
      });
      
      const updatedConversation = await conversationService.addMessage(sessionId, messageData);
      
      return c.json({ 
        success: true, 
        conversation: updatedConversation 
      });
    });
    
    // Assign conversation (DO write + D1 sync)
    router.put('/conversations/:sessionId/assignment', async (c) => {
      const sessionId = c.req.param('sessionId');
      const { assignedTo } = await c.req.json();
      const assignedBy = c.get('user').userId;
      
      const conversationService = new ConversationService({
        CONVERSATION_SESSION: c.env.CONVERSATION_SESSION,
        FIRM_INDEX_DB: c.env.FIRM_INDEX_DB,
        VECTORIZE_KNOWLEDGE: c.env.KNOWLEDGE_BASE
      });
      
      const updatedConversation = await conversationService.assignConversation(
        sessionId, 
        assignedTo, 
        assignedBy
      );
      
      return c.json({ 
        success: true, 
        conversation: updatedConversation 
      });
    });
    
    // Update conversation status (DO write + D1 sync)
    router.put('/conversations/:sessionId/status', async (c) => {
      const sessionId = c.req.param('sessionId');
      const { status } = await c.req.json();
      const updatedBy = c.get('user').userId;
      
      const conversationService = new ConversationService({
        CONVERSATION_SESSION: c.env.CONVERSATION_SESSION,
        FIRM_INDEX_DB: c.env.FIRM_INDEX_DB,
        VECTORIZE_KNOWLEDGE: c.env.KNOWLEDGE_BASE
      });
      
      const updatedConversation = await conversationService.updateConversationStatus(
        sessionId, 
        status, 
        updatedBy
      );
      
      return c.json({ 
        success: true, 
        conversation: updatedConversation 
      });
    });
  }

  private addUserRoutes(router: Hono<{ Bindings: Env }>) {
    // List users (D1 index)
    router.get('/users', async (c) => {
      const firmId = c.get('firm').firmId;
      
      const users = await c.env.FIRM_INDEX_DB.prepare(`
        SELECT userId, email, name, role, status, lastLogin, conversationCount, createdAt
        FROM user_index 
        WHERE firmId = ?
        ORDER BY name ASC
      `).bind(firmId).all();
      
      return c.json({ 
        users: users.results,
        total: users.results?.length || 0
      });
    });
    
    // Get user details (Durable Object)  
    router.get('/users/:userId', async (c) => {
      const userId = c.req.param('userId');
      const firmId = c.get('firm').firmId;
      
      // TODO: Get user details from UserIdentity Durable Object
      return c.json({ message: 'User details endpoint', userId, firmId });
    });
    
    // Create user
    router.post('/users', async (c) => {
      const userData = await c.req.json();
      const firmId = c.get('firm').firmId;
      
      // TODO: Implement user creation
      return c.json({ message: 'User creation endpoint', userData, firmId });
    });
    
    // Update user
    router.put('/users/:userId', async (c) => {
      const userId = c.req.param('userId');
      const updateData = await c.req.json();
      
      // TODO: Implement user updates
      return c.json({ message: 'User update endpoint', userId, updateData });
    });
  }

  private addAnalyticsRoutes(router: Hono<{ Bindings: Env }>) {
    // Firm overview analytics (D1 aggregations)
    router.get('/analytics/overview', async (c) => {
      const firmId = c.get('firm').firmId;
      const { startDate, endDate } = c.req.query();
      
      const conversationService = new ConversationService({
        CONVERSATION_SESSION: c.env.CONVERSATION_SESSION,
        FIRM_INDEX_DB: c.env.FIRM_INDEX_DB,
        VECTORIZE_KNOWLEDGE: c.env.KNOWLEDGE_BASE
      });
      
      const analytics = await conversationService.getConversationAnalytics(firmId, {
        startDate: new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(endDate || Date.now())
      });
      
      return c.json({ analytics });
    });
    
    // Practice area metrics
    router.get('/analytics/practice-areas', async (c) => {
      const firmId = c.get('firm').firmId;
      
      const metrics = await c.env.FIRM_INDEX_DB.prepare(`
        SELECT 
          practiceArea,
          COUNT(*) as totalConversations,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedConversations,
          AVG(dataQualityScore) as avgDataQuality,
          AVG(goalsCompleted * 1.0 / NULLIF(goalsTotal, 0)) as avgGoalCompletion
        FROM conversation_index 
        WHERE firmId = ? AND practiceArea IS NOT NULL AND isDeleted = FALSE
        GROUP BY practiceArea
        ORDER BY totalConversations DESC
      `).bind(firmId).all();
      
      return c.json({ 
        practiceAreaMetrics: metrics.results 
      });
    });
  }

  private addSearchRoutes(router: Hono<{ Bindings: Env }>) {
    // Search conversations (Vectorize + D1)
    router.get('/search/conversations', async (c) => {
      const firmId = c.get('firm').firmId;
      const { q, practiceArea, limit } = c.req.query();
      
      if (!q) {
        return c.json({ error: 'Search query required' }, 400);
      }
      
      const conversationService = new ConversationService({
        CONVERSATION_SESSION: c.env.CONVERSATION_SESSION,
        FIRM_INDEX_DB: c.env.FIRM_INDEX_DB,
        VECTORIZE_KNOWLEDGE: c.env.KNOWLEDGE_BASE
      });
      
      const results = await conversationService.searchConversations(firmId, q, {
        practiceArea,
        limit: limit ? parseInt(limit) : 20
      });
      
      return c.json(results);
    });
    
    // Search knowledge base (Vectorize)
    router.get('/search/knowledge', async (c) => {
      const firmId = c.get('firm').firmId;
      const { q, category } = c.req.query();
      
      if (!q) {
        return c.json({ error: 'Search query required' }, 400);
      }
      
      // TODO: Implement knowledge base search
      return c.json({ message: 'Knowledge search endpoint', q, category, firmId });
    });
  }

  private addConflictRoutes(router: Hono<{ Bindings: Env }>) {
    // Check conflicts (Vectorize)
    router.post('/conflicts/check', async (c) => {
      const conflictData = await c.req.json();
      const firmId = c.get('firm').firmId;
      
      // TODO: Implement conflict checking
      return c.json({ message: 'Conflict check endpoint', conflictData, firmId });
    });
    
    // List conflicts (D1)
    router.get('/conflicts', async (c) => {
      const firmId = c.get('firm').firmId;
      
      // TODO: Get conflicts from D1 index
      return c.json({ message: 'Conflicts list endpoint', firmId });
    });
  }

  private addAssignmentRoutes(router: Hono<{ Bindings: Env }>) {
    // List assignments (D1)
    router.get('/assignments', async (c) => {
      const firmId = c.get('firm').firmId;
      const { assignedTo, status } = c.req.query();
      
      let query = `
        SELECT * FROM case_assignment_index 
        WHERE firmId = ?
      `;
      const params: any[] = [firmId];
      
      if (assignedTo) {
        query += ` AND assignedTo = ?`;
        params.push(assignedTo);
      }
      
      if (status) {
        query += ` AND status = ?`;
        params.push(status);
      }
      
      query += ` ORDER BY assignedAt DESC`;
      
      const assignments = await c.env.FIRM_INDEX_DB.prepare(query).bind(...params).all();
      
      return c.json({ 
        assignments: assignments.results,
        total: assignments.results?.length || 0
      });
    });
    
    // Workload analysis (D1 aggregations)
    router.get('/assignments/workload', async (c) => {
      const firmId = c.get('firm').firmId;
      
      const workload = await c.env.FIRM_INDEX_DB.prepare(`
        SELECT 
          assignedTo,
          COUNT(*) as totalAssignments,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingAssignments,
          COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdueAssignments,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedAssignments
        FROM case_assignment_index 
        WHERE firmId = ?
        GROUP BY assignedTo
        ORDER BY totalAssignments DESC
      `).bind(firmId).all();
      
      return c.json({ 
        workloadAnalysis: workload.results 
      });
    });
    
    // Create assignment
    router.post('/assignments', async (c) => {
      const assignmentData = await c.req.json();
      const firmId = c.get('firm').firmId;
      const assignedBy = c.get('user').userId;
      
      // TODO: Implement assignment creation
      return c.json({ message: 'Assignment creation endpoint', assignmentData, firmId, assignedBy });
    });
  }

  private addAuditRoutes(router: Hono<{ Bindings: Env }>) {
    // Get audit logs (D1)
    router.get('/audit', async (c) => {
      const firmId = c.get('firm').firmId;
      const { userId, action, startDate, endDate, limit, offset } = c.req.query();
      
      let query = `
        SELECT auditId, userId, action, resourceType, resourceId, 
               timestamp, ipAddress, userAgent, details
        FROM audit_log_index 
        WHERE firmId = ?
      `;
      const params: any[] = [firmId];
      
      if (userId) {
        query += ` AND userId = ?`;
        params.push(userId);
      }
      
      if (action) {
        query += ` AND action = ?`;
        params.push(action);
      }
      
      if (startDate) {
        query += ` AND timestamp >= ?`;
        params.push(startDate);
      }
      
      if (endDate) {
        query += ` AND timestamp <= ?`;
        params.push(endDate);
      }
      
      query += ` ORDER BY timestamp DESC`;
      
      if (limit) {
        query += ` LIMIT ?`;
        params.push(parseInt(limit));
      }
      
      if (offset) {
        query += ` OFFSET ?`;
        params.push(parseInt(offset));
      }
      
      const auditLogs = await c.env.FIRM_INDEX_DB.prepare(query).bind(...params).all();
      
      return c.json({ 
        auditLogs: auditLogs.results,
        total: auditLogs.results?.length || 0
      });
    });
    
    // Generate compliance report
    router.get('/audit/compliance-report', async (c) => {
      const firmId = c.get('firm').firmId;
      const { startDate, endDate } = c.req.query();
      
      // TODO: Generate compliance report
      return c.json({ message: 'Compliance report endpoint', firmId, startDate, endDate });
    });
  }

  private addSettingsRoutes(router: Hono<{ Bindings: Env }>) {
    // Get firm settings (D1)
    router.get('/settings', async (c) => {
      const firmId = c.get('firm').firmId;
      
      const settings = await c.env.FIRM_INDEX_DB.prepare(`
        SELECT configKey, configValue, configType, category
        FROM firm_config_index 
        WHERE firmId = ?
        ORDER BY category, configKey
      `).bind(firmId).all();
      
      // Group settings by category
      const groupedSettings: Record<string, any> = {};
      for (const setting of settings.results || []) {
        const s = setting as any;
        if (!groupedSettings[s.category]) {
          groupedSettings[s.category] = {};
        }
        
        // Parse config value based on type
        let value = s.configValue;
        try {
          if (s.configType === 'json') {
            value = JSON.parse(s.configValue);
          } else if (s.configType === 'number') {
            value = parseFloat(s.configValue);
          } else if (s.configType === 'boolean') {
            value = s.configValue === 'true';
          }
        } catch (e) {
          // Keep original value if parsing fails
        }
        
        groupedSettings[s.category][s.configKey] = value;
      }
      
      return c.json({ settings: groupedSettings });
    });
    
    // Update firm settings (D1)
    router.put('/settings/:section', async (c) => {
      const firmId = c.get('firm').firmId;
      const section = c.req.param('section');
      const settingsData = await c.req.json();
      const modifiedBy = c.get('user').userId;
      
      // TODO: Implement settings updates with validation
      return c.json({ 
        message: 'Settings update endpoint', 
        firmId, 
        section, 
        settingsData,
        modifiedBy 
      });
    });
  }
}

/**
 * Data Layer Routing Utility
 * Determines which data layer to use based on operation type
 */
export class HybridDataRouter {
  
  /**
   * Determine if request should route to D1 indexes
   * Used for list operations and analytics
   */
  static shouldUseD1(method: string, pathname: string): boolean {
    // List operations (GET /conversations, /users, etc.)
    if (method === 'GET' && this.isListEndpoint(pathname)) {
      return true;
    }
    
    // Analytics operations (GET /analytics/*, /reports/*)
    if (method === 'GET' && this.isAnalyticsEndpoint(pathname)) {
      return true;
    }
    
    // Audit log queries (GET /audit/*)
    if (method === 'GET' && this.isAuditEndpoint(pathname)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Determine if request should route to Durable Objects
   * Used for detail operations and all writes
   */
  static shouldUseDurableObjects(method: string, pathname: string): boolean {
    // Detail operations (GET /conversations/{id}, /users/{id})
    if (method === 'GET' && this.isDetailEndpoint(pathname)) {
      return true;
    }
    
    // All write operations (POST, PUT, DELETE, PATCH)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Determine if request should route to Vectorize
   * Used for search and conflict detection
   */
  static shouldUseVectorize(method: string, pathname: string): boolean {
    // Search operations
    if (pathname.includes('/search/')) {
      return true;
    }
    
    // Conflict detection
    if (pathname.includes('/conflicts/check')) {
      return true;
    }
    
    return false;
  }
  
  private static isListEndpoint(pathname: string): boolean {
    const listPatterns = [
      /\/conversations$/,
      /\/users$/,
      /\/assignments$/,
      /\/conflicts$/,
      /\/audit$/
    ];
    
    return listPatterns.some(pattern => pattern.test(pathname));
  }
  
  private static isDetailEndpoint(pathname: string): boolean {
    const detailPatterns = [
      /\/conversations\/[^/]+$/,
      /\/users\/[^/]+$/,
      /\/assignments\/[^/]+$/,
      /\/conflicts\/[^/]+$/
    ];
    
    return detailPatterns.some(pattern => pattern.test(pathname));
  }
  
  private static isAnalyticsEndpoint(pathname: string): boolean {
    return pathname.includes('/analytics/') || 
           pathname.includes('/reports/') ||
           pathname.includes('/workload');
  }
  
  private static isAuditEndpoint(pathname: string): boolean {
    return pathname.includes('/audit/');
  }
}

/**
 * Request Context Enhancement
 * Adds routing metadata to request context
 */
export interface RoutingContext {
  dataLayer: 'durable-objects' | 'd1' | 'vectorize' | 'hybrid';
  cacheStrategy: 'none' | 'short' | 'medium' | 'long';
  requiresSync: boolean; // Whether DO changes need D1 sync
}

export function getRoutingContext(method: string, pathname: string): RoutingContext {
  if (HybridDataRouter.shouldUseDurableObjects(method, pathname)) {
    return {
      dataLayer: 'durable-objects',
      cacheStrategy: 'none', // Real-time data, no caching
      requiresSync: ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
    };
  }
  
  if (HybridDataRouter.shouldUseD1(method, pathname)) {
    return {
      dataLayer: 'd1',
      cacheStrategy: pathname.includes('/analytics/') ? 'medium' : 'short',
      requiresSync: false
    };
  }
  
  if (HybridDataRouter.shouldUseVectorize(method, pathname)) {
    return {
      dataLayer: 'vectorize',
      cacheStrategy: 'short',
      requiresSync: false
    };
  }
  
  return {
    dataLayer: 'hybrid',
    cacheStrategy: 'short',
    requiresSync: false
  };
}