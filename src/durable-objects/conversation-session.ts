// ConversationSession Durable Object - Core conversation state management

/// <reference types="@cloudflare/workers-types" />

import { 
  ConversationState, 
  ConflictStatus, 
  Message, 
  Env 
} from '@/types/shared';
import { 
  generateSessionId, 
  generateUserId, 
  generateResumeToken, 
  generateMessageId 
} from '@/utils/ulid';
import { createLogger } from '@/utils/logger';
import { 
  SessionNotFoundError, 
  UnauthorizedAccessError, 
  InvalidResumeTokenError,
  EngageError 
} from '@/utils/errors';

export class ConversationSession implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private conversationState: ConversationState | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // Initialize session state from storage or create new
  private async initializeState(): Promise<void> {
    if (this.conversationState === null) {
      const stored = await this.state.storage.get<ConversationState>('conversation');
      this.conversationState = stored || null;
    }
  }

  // Save state to storage
  private async saveState(): Promise<void> {
    if (this.conversationState) {
      this.conversationState.lastActivity = new Date();
      await this.state.storage.put('conversation', this.conversationState);
    }
  }

  // Create new conversation session
  async createSession(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { operation: 'createSession' });
    
    try {
      const { firmId, sessionId: providedSessionId } = await request.json() as { 
        firmId: string; 
        sessionId?: string; 
      };
      
      if (!firmId) {
        throw new EngageError('firmId is required', 'MISSING_FIRM_ID', 400);
      }

      // Use provided sessionId or generate new ones
      const sessionId = providedSessionId || generateSessionId();
      const userId = generateUserId();
      const resumeToken = generateResumeToken();
      
      // Create resume URL
      const resumeUrl = `${new URL(request.url).origin}/api/v1/conversations/resume/${resumeToken}`;

      // Initialize conversation state
      this.conversationState = {
        // Identity
        sessionId,
        userId,
        firmId,
        
        // Authentication & Security
        isAuthenticated: false,
        isSecured: false,
        
        // Resume capability
        resumeToken,
        resumeUrl,
        
        // Pre-login goals (all start as incomplete)
        preLoginGoals: {
          userIdentification: false,
          conflictCheck: false,
          legalNeedsAssessment: false,
        },
        
        // User identity (starts empty)
        userIdentity: {},
        
        // Workflow
        phase: 'pre_login',
        
        // Conflict checking
        conflictCheck: {
          status: 'pending',
          preLoginCheck: false,
          checkedIdentity: [],
        },
        
        // Data gathering
        dataGoals: [],
        completedGoals: [],
        supportDocuments: [],
        
        // Conversation history
        messages: [],
        
        // Access control
        allowedAuth0Users: [],
        
        // Metadata
        createdAt: new Date(),
        lastActivity: new Date(),
        isDeleted: false,
      };

      await this.saveState();

      logger.info('Created new conversation session', {
        sessionId,
        userId,
        firmId,
        resumeToken
      });

      return new Response(JSON.stringify({
        sessionId,
        userId,
        resumeUrl,
        phase: this.conversationState.phase,
        isAuthenticated: false,
        preLoginGoals: this.conversationState.preLoginGoals
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      logger.error('Failed to create session', error as Error);
      const engageError = error instanceof EngageError ? error : 
        new EngageError('Session creation failed', 'SESSION_CREATION_ERROR', 500);
      
      return new Response(JSON.stringify({
        error: engageError.code,
        message: engageError.message
      }), {
        status: engageError.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Resume existing session
  async resumeSession(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { operation: 'resumeSession' });
    
    try {
      await this.initializeState();
      
      if (!this.conversationState) {
        throw new SessionNotFoundError('Session does not exist');
      }

      const url = new URL(request.url);
      const resumeToken = url.pathname.split('/').pop();
      const auth0UserId = request.headers.get('x-auth0-user-id');

      // Validate resume token
      if (!resumeToken || resumeToken !== this.conversationState.resumeToken) {
        throw new InvalidResumeTokenError(resumeToken || 'missing');
      }

      // Check access permissions for secured conversations
      if (this.conversationState.isSecured) {
        if (!auth0UserId || !this.conversationState.allowedAuth0Users.includes(auth0UserId)) {
          throw new UnauthorizedAccessError('Secured conversation requires valid authentication');
        }
      }

      await this.saveState(); // Update last activity

      logger.info('Resumed conversation session', {
        sessionId: this.conversationState.sessionId,
        phase: this.conversationState.phase,
        isSecured: this.conversationState.isSecured,
        messageCount: this.conversationState.messages.length
      });

      return new Response(JSON.stringify({
        sessionId: this.conversationState.sessionId,
        userId: this.conversationState.userId,
        resumeUrl: this.conversationState.resumeUrl,
        phase: this.conversationState.phase,
        isAuthenticated: this.conversationState.isAuthenticated,
        isSecured: this.conversationState.isSecured,
        preLoginGoals: this.conversationState.preLoginGoals,
        messages: this.conversationState.messages,
        conflictStatus: this.conversationState.conflictCheck.status
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      logger.error('Failed to resume session', error as Error);
      const engageError = error instanceof EngageError ? error : 
        new EngageError('Session resume failed', 'SESSION_RESUME_ERROR', 500);
      
      return new Response(JSON.stringify({
        error: engageError.code,
        message: engageError.message
      }), {
        status: engageError.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Add message to conversation
  async addMessage(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { operation: 'addMessage' });
    
    try {
      await this.initializeState();
      
      if (!this.conversationState) {
        throw new SessionNotFoundError('Session does not exist');
      }

      const { role, content, metadata } = await request.json() as {
        role: 'user' | 'agent';
        content: string;
        metadata?: Record<string, unknown>;
      };

      if (!role || !content) {
        throw new EngageError('role and content are required', 'INVALID_MESSAGE', 400);
      }

      const message: Message = {
        id: generateMessageId(),
        role,
        content,
        timestamp: new Date(),
        ...(metadata && { metadata })
      };

      this.conversationState.messages.push(message);
      await this.saveState();

      logger.info('Added message to conversation', {
        sessionId: this.conversationState.sessionId,
        messageId: message.id,
        role,
        contentLength: content.length
      });

      return new Response(JSON.stringify({
        messageId: message.id,
        timestamp: message.timestamp,
        messageCount: this.conversationState.messages.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      logger.error('Failed to add message', error as Error);
      const engageError = error instanceof EngageError ? error : 
        new EngageError('Add message failed', 'ADD_MESSAGE_ERROR', 500);
      
      return new Response(JSON.stringify({
        error: engageError.code,
        message: engageError.message
      }), {
        status: engageError.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Update user identity information
  async updateUserIdentity(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { operation: 'updateUserIdentity' });
    
    try {
      await this.initializeState();
      
      if (!this.conversationState) {
        throw new SessionNotFoundError('Session does not exist');
      }

      const identityData = await request.json() as Partial<typeof this.conversationState.userIdentity>;

      // Merge new identity data with existing
      this.conversationState.userIdentity = {
        ...this.conversationState.userIdentity,
        ...identityData
      };

      await this.saveState();

      logger.info('Updated user identity', {
        sessionId: this.conversationState.sessionId,
        updatedFields: Object.keys(identityData)
      });

      return new Response(JSON.stringify({
        userIdentity: this.conversationState.userIdentity,
        updated: true
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      logger.error('Failed to update user identity', error as Error);
      const engageError = error instanceof EngageError ? error : 
        new EngageError('Update identity failed', 'UPDATE_IDENTITY_ERROR', 500);
      
      return new Response(JSON.stringify({
        error: engageError.code,
        message: engageError.message
      }), {
        status: engageError.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Authenticate session with Auth0
  async authenticateSession(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { operation: 'authenticateSession' });
    
    try {
      await this.initializeState();
      
      if (!this.conversationState) {
        throw new SessionNotFoundError('Session does not exist');
      }

      const { auth0UserId } = await request.json() as { auth0UserId: string };

      if (!auth0UserId) {
        throw new EngageError('auth0UserId is required', 'MISSING_AUTH0_USER_ID', 400);
      }

      // Update authentication state
      this.conversationState.isAuthenticated = true;
      this.conversationState.isSecured = true;
      this.conversationState.auth0UserId = auth0UserId;
      this.conversationState.allowedAuth0Users = [auth0UserId];
      this.conversationState.phase = 'secured';

      await this.saveState();

      logger.info('Authenticated session', {
        sessionId: this.conversationState.sessionId,
        auth0UserId,
        phase: this.conversationState.phase
      });

      return new Response(JSON.stringify({
        authenticated: true,
        secured: true,
        phase: this.conversationState.phase,
        auth0UserId
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      logger.error('Failed to authenticate session', error as Error);
      const engageError = error instanceof EngageError ? error : 
        new EngageError('Authentication failed', 'AUTHENTICATION_ERROR', 500);
      
      return new Response(JSON.stringify({
        error: engageError.code,
        message: engageError.message
      }), {
        status: engageError.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Set conflict check result
  async setConflictResult(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { operation: 'setConflictResult' });
    
    try {
      await this.initializeState();
      
      if (!this.conversationState) {
        throw new SessionNotFoundError('Session does not exist');
      }

      const { status, details, checkedIdentity } = await request.json() as {
        status: ConflictStatus;
        details?: string;
        checkedIdentity: string[];
      };

      // Update conflict check results
      this.conversationState.conflictCheck = {
        status,
        checkedAt: new Date(),
        preLoginCheck: true,
        checkedIdentity,
        ...(details && { conflictDetails: details })
      };

      // If conflict detected, update phase
      if (status === 'conflict_detected') {
        this.conversationState.phase = 'terminated';
      }

      await this.saveState();

      logger.info('Set conflict check result', {
        sessionId: this.conversationState.sessionId,
        status,
        phase: this.conversationState.phase
      });

      return new Response(JSON.stringify({
        conflictStatus: status,
        phase: this.conversationState.phase,
        conflictDetails: details
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      logger.error('Failed to set conflict result', error as Error);
      const engageError = error instanceof EngageError ? error : 
        new EngageError('Set conflict result failed', 'SET_CONFLICT_ERROR', 500);
      
      return new Response(JSON.stringify({
        error: engageError.code,
        message: engageError.message
      }), {
        status: engageError.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Get conversation context for agent
  async getContext(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { operation: 'getContext' });
    
    try {
      await this.initializeState();
      
      if (!this.conversationState) {
        throw new SessionNotFoundError('Session does not exist');
      }

      const context = {
        sessionId: this.conversationState.sessionId,
        userId: this.conversationState.userId,
        firmId: this.conversationState.firmId,
        phase: this.conversationState.phase,
        isAuthenticated: this.conversationState.isAuthenticated,
        isSecured: this.conversationState.isSecured,
        preLoginGoals: this.conversationState.preLoginGoals,
        messages: this.conversationState.messages,
        conflictStatus: this.conversationState.conflictCheck.status,
        resumeUrl: this.conversationState.resumeUrl
      };

      return new Response(JSON.stringify(context), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      logger.error('Failed to get context', error as Error);
      const engageError = error instanceof EngageError ? error : 
        new EngageError('Get context failed', 'GET_CONTEXT_ERROR', 500);
      
      return new Response(JSON.stringify({
        error: engageError.code,
        message: engageError.message
      }), {
        status: engageError.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Handle fetch requests
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // Route requests to appropriate handlers
    if (method === 'POST' && url.pathname === '/create') {
      return this.createSession(request);
    }
    
    if (method === 'GET' && url.pathname.startsWith('/resume/')) {
      return this.resumeSession(request);
    }
    
    if (method === 'GET' && url.pathname === '/context') {
      return this.getContext(request);
    }
    
    if (method === 'POST' && url.pathname === '/message') {
      return this.addMessage(request);
    }
    
    if (method === 'POST' && url.pathname === '/identity') {
      return this.updateUserIdentity(request);
    }
    
    if (method === 'POST' && url.pathname === '/authenticate') {
      return this.authenticateSession(request);
    }
    
    if (method === 'POST' && url.pathname === '/conflict') {
      return this.setConflictResult(request);
    }
    
    if (method === 'GET' && url.pathname === '/full-conversation') {
      return this.getFullConversation(request);
    }
    
    if (method === 'POST' && url.pathname === '/delete') {
      return this.markDeleted(request);
    }
    
    if (method === 'GET' && url.pathname === '/sync-state') {
      return this.getSyncState(request);
    }

    return new Response(JSON.stringify({
      error: 'NOT_FOUND',
      message: 'Endpoint not found',
      availableEndpoints: [
        'POST /create',
        'GET /resume/{token}',
        'GET /context',
        'POST /message',
        'POST /identity',
        'POST /authenticate',
        'POST /conflict',
        'GET /full-conversation',
        'POST /delete',
        'GET /sync-state'
      ]
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get full conversation data for admin API
  async getFullConversation(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { operation: 'getFullConversation' });
    
    try {
      // Verify admin request
      if (request.headers.get('X-Admin-Request') !== 'true') {
        throw new UnauthorizedAccessError('Admin access required');
      }
      
      await this.initializeState();
      
      if (!this.conversationState) {
        throw new SessionNotFoundError('Session does not exist');
      }
      
      // Return full conversation data
      const fullData = {
        ...this.conversationState,
        messages: this.conversationState.messages || [],
        userIdentity: this.conversationState.userIdentity || {},
        dataGoals: this.conversationState.dataGoals || [],
        supportDocuments: this.conversationState.supportDocuments || [],
        conflictCheck: this.conversationState.conflictCheck || { status: 'pending' }
      };
      
      return new Response(JSON.stringify(fullData), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      logger.error('Failed to get full conversation', error as Error);
      const engageError = error instanceof EngageError ? error : 
        new EngageError('Get full conversation failed', 'GET_FULL_CONVERSATION_ERROR', 500);
      
      return new Response(JSON.stringify({
        error: engageError.code,
        message: engageError.message
      }), {
        status: engageError.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Mark conversation as deleted (soft delete)
  async markDeleted(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { operation: 'markDeleted' });
    
    try {
      // Verify admin request
      if (request.headers.get('X-Admin-Request') !== 'true') {
        throw new UnauthorizedAccessError('Admin access required');
      }
      
      const deletedBy = request.headers.get('X-Deleted-By');
      if (!deletedBy) {
        throw new EngageError('X-Deleted-By header required', 'MISSING_DELETED_BY', 400);
      }
      
      await this.initializeState();
      
      if (!this.conversationState) {
        throw new SessionNotFoundError('Session does not exist');
      }
      
      // Mark as deleted
      this.conversationState.isDeleted = true;
      this.conversationState.deletedAt = new Date();
      this.conversationState.deletedBy = deletedBy;
      
      await this.saveState();
      
      logger.info('Marked conversation as deleted', {
        sessionId: this.conversationState.sessionId,
        deletedBy
      });
      
      return new Response(JSON.stringify({
        deleted: true,
        deletedAt: this.conversationState.deletedAt
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      logger.error('Failed to mark as deleted', error as Error);
      const engageError = error instanceof EngageError ? error : 
        new EngageError('Delete operation failed', 'DELETE_ERROR', 500);
      
      return new Response(JSON.stringify({
        error: engageError.code,
        message: engageError.message
      }), {
        status: engageError.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Get sync state for reconciliation
  async getSyncState(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { operation: 'getSyncState' });
    
    try {
      await this.initializeState();
      
      if (!this.conversationState) {
        throw new SessionNotFoundError('Session does not exist');
      }
      
      // Return minimal sync state
      const syncState = {
        conversationId: this.conversationState.sessionId,
        firmId: this.conversationState.firmId,
        userId: this.conversationState.userId,
        doVersion: (this.conversationState as any).doVersion || 0,
        phase: this.conversationState.phase,
        status: this.conversationState.phase === 'completed' ? 'completed' : 
                this.conversationState.phase === 'terminated' ? 'terminated' : 'active',
        conflictStatus: this.conversationState.conflictCheck.status,
        messageCount: this.conversationState.messages.length,
        completedGoals: this.conversationState.completedGoals.length,
        totalGoals: this.conversationState.dataGoals.length,
        lastActivity: this.conversationState.lastActivity,
        userIdentity: {
          name: this.conversationState.userIdentity.name,
          email: this.conversationState.userIdentity.email,
          phone: this.conversationState.userIdentity.phone
        }
      };
      
      return new Response(JSON.stringify(syncState), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      logger.error('Failed to get sync state', error as Error);
      const engageError = error instanceof EngageError ? error : 
        new EngageError('Get sync state failed', 'GET_SYNC_STATE_ERROR', 500);
      
      return new Response(JSON.stringify({
        error: engageError.code,
        message: engageError.message
      }), {
        status: engageError.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}