// Platform Audit Logger - Comprehensive audit logging for platform admin actions
// Security: All platform admin actions must be logged for compliance

import { Env } from '@/types/shared';
import { AuthContext } from '@/auth/auth-middleware';
import { generateULID } from '@/utils/ulid';

export interface PlatformAuditLog {
  // Unique identifier
  logId: string;                    // ULID for sorting and uniqueness
  
  // Temporal information
  timestamp: Date;                  // UTC timestamp
  timezone: string;                 // User's timezone for context
  
  // Actor information (Lexara employee)
  platformUserId: string;           // Auth0 user ID
  platformUserEmail: string;       // Employee email
  platformUserName: string;        // Employee name
  platformUserRole: string;        // Employee role (admin, support, billing)
  
  // Action details
  action: PlatformAction;           // Standardized action type
  actionCategory: ActionCategory;   // Grouping for reporting
  description: string;              // Human-readable description
  
  // Target information
  targetType: 'firm' | 'user' | 'system' | 'billing';
  targetId?: string;                // Firm ID, user ID, etc.
  targetName?: string;              // Firm name, user email, etc.
  
  // Request context
  ipAddress: string;                // Source IP
  userAgent: string;                // Browser/client info
  requestId: string;                // Request correlation ID
  sessionId: string;                // Admin session ID
  
  // Action outcome
  result: 'success' | 'failure' | 'partial';
  errorMessage?: string;            // If action failed
  warningMessage?: string;          // If action had issues
  
  // Data context
  beforeData?: Record<string, any>; // State before action
  afterData?: Record<string, any>;  // State after action
  metadata: Record<string, any>;    // Additional context
  
  // Security context
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;        // For sensitive actions
  approvedBy?: string;              // If action required approval
}

export type PlatformAction = 
  // Firm management
  | 'firm_created'
  | 'firm_viewed'
  | 'firm_updated'
  | 'firm_suspended'
  | 'firm_reactivated'
  | 'firm_deleted'
  
  // User management
  | 'user_password_reset'
  | 'user_invited'
  | 'user_deactivated'
  | 'user_reactivated'
  | 'user_role_changed'
  
  // Subscription management
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'subscription_cancelled'
  | 'trial_extended'
  | 'usage_limit_increased'
  
  // Billing actions
  | 'invoice_viewed'
  | 'invoice_generated'
  | 'payment_processed'
  | 'refund_issued'
  | 'credit_applied'
  
  // Support actions
  | 'support_ticket_created'
  | 'support_note_added'
  | 'support_escalated'
  
  // System actions
  | 'analytics_accessed'
  | 'report_generated'
  | 'data_exported'
  | 'system_settings_changed'
  
  // Security actions
  | 'platform_login'
  | 'platform_logout'
  | 'unauthorized_access_attempt'
  | 'permission_denied'
  | 'request_blocked'
  | 'request_error'
  | 'auth_callback_error'
  | 'auth_callback_invalid'
  | 'auth_callback_failed'
  | 'auth_callback_exception';

export type ActionCategory = 
  | 'account_management'
  | 'user_administration'
  | 'billing_operations'
  | 'customer_support'
  | 'system_administration'
  | 'security_events'
  | 'data_access';

export interface SecurityEventParams {
  event: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  request: Request;
  metadata?: Record<string, any>;
}

export interface ActionParams {
  action: PlatformAction;
  description: string;
  platformUser: AuthContext;
  targetType: string;
  targetId?: string;
  targetName?: string;
  beforeData?: any;
  afterData?: any;
  metadata?: any;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  request: Request;
}

export class PlatformAuditLogger {
  private env: Env;
  private logger: any;
  
  constructor(env: Env, logger: any) {
    this.env = env;
    this.logger = logger;
  }
  
  async logAction(params: ActionParams): Promise<void> {
    const logEntry: PlatformAuditLog = {
      logId: generateULID(),
      timestamp: new Date(),
      timezone: 'UTC',
      
      // Platform user context
      platformUserId: params.platformUser.userId,
      platformUserEmail: params.platformUser.email || '',
      platformUserName: params.platformUser.name || '',
      platformUserRole: params.platformUser.userType,
      
      // Action details
      action: params.action,
      actionCategory: this.categorizeAction(params.action),
      description: params.description,
      
      // Target information
      targetType: params.targetType as any,
      targetId: params.targetId,
      targetName: params.targetName,
      
      // Request context
      ipAddress: params.request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: params.request.headers.get('User-Agent')?.substring(0, 200) || 'unknown',
      requestId: params.request.headers.get('CF-Ray') || generateULID(),
      sessionId: this.extractSessionId(params.request),
      
      // Action outcome (set to success, can be updated)
      result: 'success',
      
      // Data context
      beforeData: params.beforeData,
      afterData: params.afterData,
      metadata: params.metadata || {},
      
      // Security context
      riskLevel: params.riskLevel || 'low',
      requiresApproval: this.requiresApproval(params.action),
    };
    
    // Store in audit log Durable Object
    await this.storeAuditLog(logEntry);
    
    // Log to console for development
    this.logger.info('Platform admin action logged', {
      action: logEntry.action,
      user: logEntry.platformUserEmail,
      target: logEntry.targetType,
      riskLevel: logEntry.riskLevel
    });
    
    // Send high-risk actions to security monitoring
    if (logEntry.riskLevel === 'high' || logEntry.riskLevel === 'critical') {
      await this.alertSecurityTeam(logEntry);
    }
  }
  
  async logFailure(params: {
    action: PlatformAction;
    description: string;
    platformUser: AuthContext;
    error: Error;
    request: Request;
    metadata?: any;
  }): Promise<void> {
    const logEntry: PlatformAuditLog = {
      logId: generateULID(),
      timestamp: new Date(),
      timezone: 'UTC',
      
      // Platform user context
      platformUserId: params.platformUser.userId,
      platformUserEmail: params.platformUser.email || '',
      platformUserName: params.platformUser.name || '',
      platformUserRole: params.platformUser.userType,
      
      // Action details
      action: params.action,
      actionCategory: this.categorizeAction(params.action),
      description: params.description,
      
      // Target information
      targetType: 'system',
      
      // Request context
      ipAddress: params.request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: params.request.headers.get('User-Agent')?.substring(0, 200) || 'unknown',
      requestId: params.request.headers.get('CF-Ray') || generateULID(),
      sessionId: this.extractSessionId(params.request),
      
      // Action outcome - failure
      result: 'failure',
      errorMessage: params.error.message,
      
      // Error context
      metadata: {
        ...params.metadata,
        errorName: params.error.name,
        errorMessage: params.error.message,
        errorStack: params.error.stack?.substring(0, 1000) // Truncate stack trace
      },
      
      // Security context
      riskLevel: 'medium',
      requiresApproval: false,
    };
    
    await this.storeAuditLog(logEntry);
    
    this.logger.error('Platform admin action failed', params.error, {
      action: logEntry.action,
      user: logEntry.platformUserEmail,
      logId: logEntry.logId
    });
  }

  async logSecurityEvent(params: SecurityEventParams): Promise<void> {
    const logEntry: PlatformAuditLog = {
      logId: generateULID(),
      timestamp: new Date(),
      timezone: 'UTC',
      
      // Platform user context (may be unknown for security events)
      platformUserId: 'unknown',
      platformUserEmail: 'unknown',
      platformUserName: 'unknown',
      platformUserRole: 'unknown',
      
      // Action details
      action: 'request_blocked',
      actionCategory: 'security_events',
      description: `Security event: ${params.event} - ${params.reason}`,
      
      // Target information
      targetType: 'system',
      
      // Request context
      ipAddress: params.request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: params.request.headers.get('User-Agent')?.substring(0, 200) || 'unknown',
      requestId: params.request.headers.get('CF-Ray') || generateULID(),
      sessionId: this.extractSessionId(params.request),
      
      // Action outcome
      result: 'failure',
      errorMessage: params.reason,
      
      // Security context
      metadata: {
        securityEvent: params.event,
        severity: params.severity,
        url: params.request.url,
        method: params.request.method,
        ...params.metadata
      },
      
      // Security context
      riskLevel: params.severity,
      requiresApproval: false,
    };
    
    await this.storeAuditLog(logEntry);
    
    this.logger.warn('Platform security event', {
      event: params.event,
      severity: params.severity,
      reason: params.reason,
      logId: logEntry.logId
    });
    
    // Always alert on security events
    if (params.severity === 'high' || params.severity === 'critical') {
      await this.alertSecurityTeam(logEntry);
    }
  }
  
  private categorizeAction(action: PlatformAction): ActionCategory {
    if (action.startsWith('firm_')) return 'account_management';
    if (action.startsWith('user_')) return 'user_administration';
    if (action.includes('subscription') || action.includes('billing') || action.includes('invoice') || action.includes('payment')) {
      return 'billing_operations';
    }
    if (action.startsWith('support_')) return 'customer_support';
    if (action.includes('system') || action.includes('analytics')) return 'system_administration';
    return 'security_events';
  }
  
  private requiresApproval(action: PlatformAction): boolean {
    const sensitiveActions: PlatformAction[] = [
      'firm_deleted',
      'subscription_cancelled',
      'refund_issued',
      'system_settings_changed'
    ];
    return sensitiveActions.includes(action);
  }
  
  private extractSessionId(request: Request): string {
    // Extract from cookie or generate temporary ID
    const sessionCookie = this.getCookie(request, 'platform_session');
    return sessionCookie || 'no-session';
  }
  
  private getCookie(request: Request, name: string): string | null {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').map(c => c.trim().split('='));
    const cookie = cookies.find(([key]) => key === name);
    return cookie ? cookie[1] : null;
  }
  
  private async storeAuditLog(logEntry: PlatformAuditLog): Promise<void> {
    try {
      // Store in PlatformAuditLog Durable Object
      const auditLogId = `platform:${logEntry.logId}`;
      const auditLogDO = this.env.PLATFORM_AUDIT_LOG.get(
        this.env.PLATFORM_AUDIT_LOG.idFromName(auditLogId)
      );
      
      await auditLogDO.fetch(new Request('https://audit/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      }));
    } catch (error) {
      // Log storage failure but don't throw - audit logging should never break the main flow
      this.logger.error('Failed to store audit log', error as Error, {
        logId: logEntry.logId,
        action: logEntry.action
      });
    }
  }
  
  private async alertSecurityTeam(logEntry: PlatformAuditLog): Promise<void> {
    try {
      // In production, this would send alerts to security monitoring
      // For now, just log a high-priority message
      this.logger.warn('HIGH-RISK PLATFORM ACTION DETECTED', {
        logId: logEntry.logId,
        action: logEntry.action,
        user: logEntry.platformUserEmail,
        riskLevel: logEntry.riskLevel,
        timestamp: logEntry.timestamp.toISOString(),
        details: logEntry.description
      });
      
      // TODO: Implement actual security alerting
      // - Send to security monitoring system
      // - Email security team
      // - Slack/Teams notification
      // - PagerDuty for critical events
    } catch (error) {
      this.logger.error('Failed to send security alert', error as Error);
    }
  }
}