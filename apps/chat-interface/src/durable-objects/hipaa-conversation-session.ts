// HIPAA-Compliant ConversationSession Durable Object
// Enhanced with encryption, audit logging, and access controls

/// <reference types="@cloudflare/workers-types" />

import { 
  ConversationState, 
  Message, 
  Env,
  FirmContext 
} from '@lexara/shared-types';
import { 
  generateSessionId, 
  generateUserId, 
  generateResumeToken, 
  generateMessageId 
} from '@lexara/shared-utils';
import { createLogger } from '@lexara/shared-utils';
import { 
  SessionNotFoundError, 
  UnauthorizedAccessError, 
  InvalidResumeTokenError,
  EngageError 
} from '@lexara/shared-utils';
import { 
  HIPAAEncryption, 
  EncryptionResult, 
  EncryptedMessage, 
  EncryptedUserIdentity,
  FirmKeyManager 
} from '@lexara/shared-utils';
import { 
  HIPAAAuditLogger, 
  createAuditLogger 
} from '@lexara/shared-utils';
import { resolveFirmContext } from '@lexara/shared-utils';

// HIPAA-enhanced conversation state
export interface HIPAAConversationState extends ConversationState {
  // HIPAA-specific fields
  encryptionEnabled: boolean;
  encryptionKeyId?: string;
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  containsePHI: boolean;
  containsPII: boolean;
  
  // Session security
  sessionTimeout: Date;              // Auto-logout time (15 minutes HIPAA requirement)
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  
  // Enhanced user identity with encryption
  encryptedUserIdentity?: EncryptedUserIdentity;
  
  // Audit metadata
  auditTrailId: string;
  integrityHash: string;
  lastIntegrityCheck: Date;
  
  // Access control
  accessLevel: 'anonymous' | 'authenticated' | 'verified';
  allowedAuth0Users: string[];       // Locked after first authentication
}

export class HIPAAConversationSession implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private conversationState: HIPAAConversationState | null = null;
  private auditLogger: HIPAAAuditLogger | null = null;
  private encryptionKey: CryptoKey | null = null;
  private firmContext: FirmContext | null = null;
  
  // HIPAA session timeout (15 minutes)
  private static readonly SESSION_TIMEOUT_MS = 15 * 60 * 1000;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // Initialize session state and HIPAA controls
  private async initializeState(request: Request): Promise<void> {
    if (this.conversationState === null) {
      const stored = await this.state.storage.get<HIPAAConversationState>('conversation');
      this.conversationState = stored || null;
      
      if (this.conversationState) {
        // Initialize firm context and audit logger
        this.firmContext = await this.resolveFirmContext(request);
        this.auditLogger = createAuditLogger(this.conversationState.firmId);
        
        // Load encryption key if needed
        if (this.conversationState.encryptionEnabled && this.conversationState.encryptionKeyId) {
          await this.loadEncryptionKey(this.conversationState.encryptionKeyId);
        }
        
        // Check session timeout
        await this.checkSessionTimeout();
        
        // Verify data integrity
        await this.verifyDataIntegrity();
      }
    }
  }

  // Resolve firm context for HIPAA compliance settings
  private async resolveFirmContext(request: Request): Promise<FirmContext> {
    const resolution = await resolveFirmContext(request, this.env);
    if (!resolution.firmContext) {
      throw new EngageError('Firm context required for HIPAA compliance', 'MISSING_FIRM_CONTEXT', 400);
    }
    return resolution.firmContext;
  }

  // Load encryption key for the firm
  private async loadEncryptionKey(keyId: string): Promise<void> {
    try {
      // TODO: Implement key retrieval from secure storage
      // For now, generate a temporary key
      this.encryptionKey = await HIPAAEncryption.generateKey();
      
      if (this.auditLogger) {
        await this.auditLogger.logEvent('encryption_performed', 'encryption', keyId, {
          success: true,
          metadata: { operation: 'key_loaded' }
        });
      }
    } catch (error) {
      if (this.auditLogger) {
        await this.auditLogger.logEvent('encryption_performed', 'encryption', keyId, {
          success: false,
          errorMessage: error.message
        });
      }
      throw new EngageError('Failed to load encryption key', 'ENCRYPTION_KEY_ERROR', 500);
    }
  }

  // Check and enforce session timeout
  private async checkSessionTimeout(): Promise<void> {
    if (!this.conversationState) return;
    
    const now = new Date();
    if (now > this.conversationState.sessionTimeout) {
      // Session expired - log and terminate
      if (this.auditLogger) {
        await this.auditLogger.logEvent('user_logout', 'user_data', this.conversationState.userId, {
          userId: this.conversationState.auth0UserId,
          success: true,
          metadata: { reason: 'session_timeout' }
        });
      }
      
      // Clear sensitive data
      this.conversationState.isAuthenticated = false;
      this.conversationState.accessLevel = 'anonymous';
      this.encryptionKey = null;
      
      throw new UnauthorizedAccessError('Session expired due to inactivity');
    }
    
    // Update last activity
    this.conversationState.lastActivity = now;
    this.conversationState.sessionTimeout = new Date(now.getTime() + HIPAAConversationSession.SESSION_TIMEOUT_MS);
  }

  // Verify data integrity using hashes
  private async verifyDataIntegrity(): Promise<void> {
    if (!this.conversationState) return;
    
    try {
      const currentData = JSON.stringify({
        sessionId: this.conversationState.sessionId,
        userId: this.conversationState.userId,
        messages: this.conversationState.messages,
        userIdentity: this.conversationState.userIdentity
      });
      
      const isValid = await HIPAAEncryption.verifyIntegrity(currentData, this.conversationState.integrityHash);
      
      if (!isValid) {
        if (this.auditLogger) {
          await this.auditLogger.logSecurityViolation(
            'integrity_violation',
            this.conversationState.sessionId,
            'Data integrity verification failed',
            this.conversationState.auth0UserId
          );
        }
        throw new EngageError('Data integrity violation detected', 'INTEGRITY_VIOLATION', 500);
      }
      
      this.conversationState.lastIntegrityCheck = new Date();
    } catch (error) {
      if (this.auditLogger) {
        await this.auditLogger.logSecurityViolation(
          'integrity_violation',
          this.conversationState.sessionId,
          `Integrity check failed: ${error.message}`,
          this.conversationState.auth0UserId
        );
      }
      throw error;
    }
  }

  // Save state with HIPAA compliance
  private async saveState(): Promise<void> {
    if (!this.conversationState) return;
    
    // Update integrity hash
    const currentData = JSON.stringify({
      sessionId: this.conversationState.sessionId,
      userId: this.conversationState.userId,
      messages: this.conversationState.messages,
      userIdentity: this.conversationState.userIdentity
    });
    
    this.conversationState.integrityHash = await HIPAAEncryption.createIntegrityHash(currentData);
    this.conversationState.lastActivity = new Date();
    
    // Store with encryption if enabled
    if (this.conversationState.encryptionEnabled && this.encryptionKey) {
      const sensitiveData = JSON.stringify(this.conversationState);
      const encrypted = await HIPAAEncryption.encrypt(
        sensitiveData,
        this.encryptionKey,
        this.conversationState.encryptionKeyId!
      );
      await this.state.storage.put('conversation_encrypted', encrypted);
    } else {
      await this.state.storage.put('conversation', this.conversationState);
    }
    
    // Audit the save operation
    if (this.auditLogger) {
      await this.auditLogger.logEvent('conversation_started', 'conversation', this.conversationState.sessionId, {
        success: true,
        containsePHI: this.conversationState.containsePHI,
        containsPII: this.conversationState.containsPII,
        dataClassification: this.conversationState.dataClassification
      });
    }
  }

  // Create new HIPAA-compliant session
  async createSession(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { service: 'hipaa-conversation-session', operation: 'createSession' });
    
    try {
      await this.initializeState(request);
      
      const body = await request.json() as { 
        firmId: string; 
        sessionId?: string;
        userAgent?: string;
        ipAddress?: string;
      };
      
      if (!body.firmId) {
        throw new EngageError('firmId is required', 'MISSING_FIRM_ID', 400);
      }

      // Resolve firm context for HIPAA settings
      this.firmContext = await this.resolveFirmContext(request);
      const firm = this.firmContext.firm;
      
      // Initialize audit logger
      this.auditLogger = createAuditLogger(body.firmId);
      
      // Generate session identifiers
      const sessionId = body.sessionId || generateSessionId();
      const userId = generateUserId();
      const resumeToken = generateResumeToken();
      const auditTrailId = crypto.randomUUID();
      
      // Create resume URL
      const resumeUrl = `${new URL(request.url).origin}/api/v1/conversations/resume/${resumeToken}`;
      
      // Determine encryption requirements
      const encryptionEnabled = firm.compliance.hipaaEnabled;
      let encryptionKeyId: string | undefined;
      
      if (encryptionEnabled) {
        const keyData = await FirmKeyManager.generateFirmKey(body.firmId);
        encryptionKeyId = keyData.keyId;
        this.encryptionKey = keyData.key;
      }

      // Initialize HIPAA-compliant conversation state
      this.conversationState = {
        // Standard fields
        sessionId,
        userId,
        firmId: body.firmId,
        
        // Firm configuration cache
        firmConfig: {
          name: firm.name,
          branding: firm.branding,
          practiceAreas: firm.practiceAreas,
          restrictions: firm.restrictions,
          compliance: firm.compliance
        },
        
        // Authentication & Security
        isAuthenticated: false,
        isSecured: false,
        
        // Resume capability
        resumeToken,
        resumeUrl,
        
        // Pre-login goals
        preLoginGoals: {
          userIdentification: false,
          conflictCheck: false,
          legalNeedsAssessment: false,
        },
        
        // User identity (starts empty)
        userIdentity: {},
        
        // Workflow
        phase: 'pre_login',
        conflictCheck: { status: 'pending' },
        dataGoals: [],
        completedGoals: [],
        supportDocuments: [],
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date(),
        
        // HIPAA-specific fields
        encryptionEnabled,
        encryptionKeyId,
        dataClassification: 'internal',
        containsePHI: false,
        containsPII: false,
        sessionTimeout: new Date(Date.now() + HIPAAConversationSession.SESSION_TIMEOUT_MS),
        ipAddress: body.ipAddress,
        userAgent: body.userAgent,
        auditTrailId,
        integrityHash: '',
        lastIntegrityCheck: new Date(),
        accessLevel: 'anonymous',
        allowedAuth0Users: []
      };
      
      // Save initial state
      await this.saveState();
      
      // Log session creation
      await this.auditLogger.logEvent('conversation_started', 'conversation', sessionId, {
        dataClassification: 'internal',
        accessMethod: 'web_ui',
        ipAddress: body.ipAddress,
        userAgent: body.userAgent,
        metadata: {
          firmId: body.firmId,
          encryptionEnabled,
          hipaaCompliant: firm.compliance.hipaaEnabled
        }
      });

      logger.info('HIPAA conversation session created', {
        sessionId,
        userId,
        firmId: body.firmId,
        encryptionEnabled,
        hipaaEnabled: firm.compliance.hipaaEnabled
      });

      return new Response(JSON.stringify({
        sessionId,
        userId,
        resumeToken,
        resumeUrl,
        phase: 'pre_login',
        firmName: firm.name,
        encryptionEnabled,
        sessionTimeout: this.conversationState.sessionTimeout.toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      logger.error('Session creation failed', { error: error.message });
      
      if (error instanceof EngageError) {
        return new Response(JSON.stringify({ error: error.message, code: error.code }), {
          status: error.statusCode,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Internal server error', { status: 500 });
    }
  }

  // Add message with HIPAA compliance
  async addMessage(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { service: 'hipaa-conversation-session', operation: 'addMessage' });
    
    try {
      await this.initializeState(request);
      
      if (!this.conversationState) {
        throw new SessionNotFoundError('Session not found');
      }
      
      const { content, role, userContext } = await request.json() as {
        content: string;
        role: 'user' | 'agent';
        userContext?: {
          auth0UserId?: string;
          ipAddress?: string;
          userAgent?: string;
        };
      };

      // Classify message content for HIPAA compliance
      const classification = HIPAAEncryption.classifyData(content);
      
      // Update conversation state with new sensitivity information
      if (classification.containsePHI) {
        this.conversationState.containsePHI = true;
        this.conversationState.dataClassification = 'restricted';
      } else if (classification.containsPII || classification.containsMedicalInfo) {
        this.conversationState.containsPII = true;
        this.conversationState.dataClassification = 'confidential';
      }

      // Create message with encryption if needed
      const messageId = generateMessageId();
      let message: EncryptedMessage;
      
      if (classification.requiresEncryption && this.encryptionKey && this.conversationState.encryptionKeyId) {
        // Encrypt sensitive content
        const encrypted = await HIPAAEncryption.encrypt(
          content,
          this.encryptionKey,
          this.conversationState.encryptionKeyId
        );
        
        message = {
          id: messageId,
          role,
          encryptedContent: encrypted,
          isEncrypted: true,
          timestamp: new Date(),
          classification,
          integrityHash: await HIPAAEncryption.createIntegrityHash(content + messageId + role)
        };
        
        // Log encryption
        if (this.auditLogger) {
          await this.auditLogger.logEncryption(
            messageId,
            this.conversationState.encryptionKeyId,
            classification.containsePHI ? 'ephi' : classification.containsPII ? 'pii' : 'general',
            true
          );
        }
      } else {
        // Store as plain text
        message = {
          id: messageId,
          role,
          content,
          isEncrypted: false,
          timestamp: new Date(),
          classification,
          integrityHash: await HIPAAEncryption.createIntegrityHash(content + messageId + role)
        };
      }

      // Add to conversation
      this.conversationState.messages.push(message as Message);
      
      // Log message addition with audit details
      if (this.auditLogger) {
        await this.auditLogger.logDataAccess(
          userContext?.auth0UserId || 'anonymous',
          this.conversationState.sessionId,
          content,
          'web_ui',
          this.conversationState.sessionId
        );
      }
      
      // Save state
      await this.saveState();

      logger.info('Message added to HIPAA conversation', {
        messageId,
        sessionId: this.conversationState.sessionId,
        role,
        encrypted: message.isEncrypted,
        containsePHI: classification.containsePHI,
        containsPII: classification.containsPII
      });

      return new Response(JSON.stringify({
        messageId,
        success: true,
        classification: {
          sensitivityLevel: classification.sensitivityLevel,
          encrypted: message.isEncrypted
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      logger.error('Add message failed', { error: error.message });
      
      if (this.auditLogger && this.conversationState) {
        await this.auditLogger.logEvent('message_sent', 'conversation', this.conversationState.sessionId, {
          success: false,
          errorMessage: error.message
        });
      }
      
      if (error instanceof EngageError) {
        return new Response(JSON.stringify({ error: error.message, code: error.code }), {
          status: error.statusCode,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Internal server error', { status: 500 });
    }
  }

  // Handle HTTP requests
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Route to appropriate handlers
    if (method === 'POST' && path.endsWith('/create')) {
      return this.createSession(request);
    }

    if (method === 'POST' && path.endsWith('/message')) {
      return this.addMessage(request);
    }

    return new Response('Not found', { status: 404 });
  }
}