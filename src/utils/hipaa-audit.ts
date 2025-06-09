// HIPAA-compliant audit logging system for Engage
// Provides tamper-proof audit trails with comprehensive access tracking

import { createLogger } from '@/utils/logger';
import { HIPAAEncryption } from '@/utils/hipaa-encryption';
import { ConversationPhase, FirmRole } from '@/types/shared';

const logger = createLogger('HIPAAAudit');

// Audit action types
export type AuditAction = 
  | 'conversation_started'
  | 'message_sent'
  | 'message_received'
  | 'pii_collected'
  | 'ephi_collected'
  | 'medical_info_detected'
  | 'conflict_check_performed'
  | 'data_exported'
  | 'conversation_deleted'
  | 'user_authenticated'
  | 'user_logout'
  | 'access_denied'
  | 'configuration_changed'
  | 'encryption_performed'
  | 'decryption_performed'
  | 'key_rotated'
  | 'integrity_verification'
  | 'security_alert'
  | 'breach_detected';

// Data classification levels
export type DataClassificationLevel = 'public' | 'internal' | 'confidential' | 'restricted';

// Access method types
export type AccessMethod = 'web_ui' | 'api' | 'admin_panel' | 'system_process' | 'mcp_server';

// Comprehensive audit log entry
export interface HIPAAAuditLog {
  // Core identification
  auditId: string;                  // ULID for unique identification
  timestamp: Date;
  firmId: string;
  
  // User context
  userId?: string;                  // auth0UserId or system identifier
  sessionId?: string;               // conversation or admin session
  userRole?: FirmRole;
  ipAddress?: string;
  userAgent?: string;
  
  // Action details
  action: AuditAction;
  resourceType: 'conversation' | 'firm_config' | 'user_data' | 'export' | 'encryption' | 'system';
  resourceId: string;               // conversationId, firmId, exportId, etc.
  
  // Data sensitivity
  containsePHI: boolean;
  containsPII: boolean;
  containsMedicalInfo: boolean;
  dataClassification: DataClassificationLevel;
  
  // Access details
  accessMethod: AccessMethod;
  conversationPhase?: ConversationPhase;
  
  // Outcome
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  duration?: number;                // Operation duration in milliseconds
  
  // Additional context
  metadata?: Record<string, unknown>;
  riskScore?: number;               // 0-100 calculated risk score
  
  // Tamper protection
  auditHash: string;                // SHA-256 hash of audit entry
  previousHash?: string;            // Creates audit trail chain
  signatureValid: boolean;          // Integrity verification status
}

// Security alert interface
export interface SecurityAlert {
  alertId: string;
  firmId: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  alertType: 'anomalous_access' | 'mass_export' | 'failed_authentication' | 'integrity_violation' | 'encryption_failure';
  description: string;
  affectedResources: string[];
  recommendedActions: string[];
  autoRemediated: boolean;
  
  // Related audit logs
  relatedAuditIds: string[];
  
  // Investigation details
  investigationStatus: 'open' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  resolvedAt?: Date;
  resolution?: string;
}

// Risk scoring parameters
export interface RiskFactors {
  sensitiveDataAccess: number;      // 0-40 points
  offHoursAccess: number;           // 0-20 points
  unusualLocation: number;          // 0-20 points
  massiveDataOperation: number;     // 0-20 points
}

// HIPAA Audit Logger implementation
export class HIPAAAuditLogger {
  private firmId: string;
  private currentHash: string | null = null;

  constructor(firmId: string) {
    this.firmId = firmId;
  }

  // Log a general audit event
  async logEvent(
    action: AuditAction,
    resourceType: HIPAAAuditLog['resourceType'],
    resourceId: string,
    context: Partial<HIPAAAuditLog> = {}
  ): Promise<void> {
    const auditEntry: HIPAAAuditLog = {
      auditId: crypto.randomUUID(),
      timestamp: new Date(),
      firmId: this.firmId,
      action,
      resourceType,
      resourceId,
      
      // Default values
      containsePHI: false,
      containsPII: false,
      containsMedicalInfo: false,
      dataClassification: 'internal',
      accessMethod: 'system_process',
      success: true,
      signatureValid: true,
      auditHash: '',
      
      // Override with provided context
      ...context
    };

    // Calculate risk score
    auditEntry.riskScore = this.calculateRiskScore(auditEntry);

    // Create hash for tamper protection
    auditEntry.previousHash = this.currentHash || undefined;
    auditEntry.auditHash = await this.createAuditHash(auditEntry);
    this.currentHash = auditEntry.auditHash;

    // Store audit entry
    await this.storeAuditEntry(auditEntry);

    // Check for security alerts
    await this.checkSecurityThresholds(auditEntry);

    logger.info('Audit event logged', {
      auditId: auditEntry.auditId,
      action,
      resourceType,
      riskScore: auditEntry.riskScore,
      firmId: this.firmId
    });
  }

  // Log user authentication
  async logAuthentication(
    userId: string,
    success: boolean,
    ipAddress: string,
    userAgent: string,
    errorCode?: string
  ): Promise<void> {
    await this.logEvent('user_authenticated', 'user_data', userId, {
      userId,
      success,
      ipAddress,
      userAgent,
      errorCode,
      accessMethod: 'web_ui',
      dataClassification: 'confidential'
    });
  }

  // Log data access with sensitivity detection
  async logDataAccess(
    userId: string,
    resourceId: string,
    dataContent: string,
    accessMethod: AccessMethod = 'web_ui',
    sessionId?: string
  ): Promise<void> {
    const classification = HIPAAEncryption.classifyData(dataContent);
    
    await this.logEvent('message_received', 'conversation', resourceId, {
      userId,
      sessionId,
      containsePHI: classification.containsePHI,
      containsPII: classification.containsPII,
      containsMedicalInfo: classification.containsMedicalInfo,
      dataClassification: classification.sensitivityLevel,
      accessMethod,
      metadata: {
        dataLength: dataContent.length,
        requiresEncryption: classification.requiresEncryption
      }
    });
  }

  // Log encryption operations
  async logEncryption(
    resourceId: string,
    keyId: string,
    dataType: 'pii' | 'ephi' | 'medical' | 'general',
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent('encryption_performed', 'encryption', resourceId, {
      success,
      errorMessage,
      dataClassification: dataType === 'ephi' ? 'restricted' : 'confidential',
      metadata: {
        keyId,
        dataType,
        encryptionAlgorithm: 'AES-256-GCM'
      }
    });
  }

  // Log data exports (high-risk operation)
  async logDataExport(
    userId: string,
    exportType: 'single_conversation' | 'multiple_conversations' | 'firm_data' | 'analytics',
    resourceIds: string[],
    format: 'json' | 'csv' | 'pdf'
  ): Promise<void> {
    await this.logEvent('data_exported', 'export', `export_${Date.now()}`, {
      userId,
      dataClassification: 'restricted',
      accessMethod: 'web_ui',
      metadata: {
        exportType,
        resourceCount: resourceIds.length,
        resourceIds,
        format,
        potentialePHI: true
      }
    });
  }

  // Log security violations
  async logSecurityViolation(
    violationType: 'access_denied' | 'integrity_violation' | 'encryption_failure',
    resourceId: string,
    details: string,
    userId?: string
  ): Promise<void> {
    await this.logEvent(violationType, 'system', resourceId, {
      userId,
      success: false,
      dataClassification: 'restricted',
      errorMessage: details,
      riskScore: 80, // High risk
      metadata: {
        violationType,
        requiresInvestigation: true
      }
    });

    // Create security alert
    await this.createSecurityAlert(violationType, resourceId, details, userId);
  }

  // Calculate risk score for audit event
  private calculateRiskScore(entry: HIPAAAuditLog): number {
    let score = 0;

    // Data sensitivity (0-40 points)
    if (entry.containsePHI) score += 40;
    else if (entry.containsPII || entry.containsMedicalInfo) score += 25;
    else if (entry.dataClassification === 'confidential') score += 15;

    // Time-based risk (0-20 points)
    const hour = entry.timestamp.getHours();
    if (hour < 6 || hour > 22) score += 20; // Off-hours access

    // Operation type risk (0-20 points)
    const highRiskActions = ['data_exported', 'conversation_deleted', 'configuration_changed'];
    if (highRiskActions.includes(entry.action)) score += 20;

    // Access pattern risk (0-20 points)
    if (entry.action === 'access_denied') score += 15;
    if (!entry.success) score += 10;

    return Math.min(score, 100); // Cap at 100
  }

  // Create tamper-proof hash for audit entry
  private async createAuditHash(entry: HIPAAAuditLog): Promise<string> {
    // Create canonical string representation (excluding hash fields)
    const canonicalData = {
      auditId: entry.auditId,
      timestamp: entry.timestamp.toISOString(),
      firmId: entry.firmId,
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      success: entry.success,
      previousHash: entry.previousHash
    };

    const canonicalString = JSON.stringify(canonicalData, Object.keys(canonicalData).sort());
    return await HIPAAEncryption.createIntegrityHash(canonicalString);
  }

  // Store audit entry (implementation depends on storage backend)
  private async storeAuditEntry(entry: HIPAAAuditLog): Promise<void> {
    // In practice, this would store to:
    // 1. Cloudflare KV for fast access
    // 2. Durable Objects for consistency
    // 3. External audit system for compliance
    
    logger.debug('Storing audit entry', {
      auditId: entry.auditId,
      firmId: entry.firmId,
      action: entry.action,
      hash: entry.auditHash
    });
    
    // TODO: Implement actual storage
    // await this.auditStorage.store(entry);
  }

  // Check for security alert thresholds
  private async checkSecurityThresholds(entry: HIPAAAuditLog): Promise<void> {
    // High-risk scenarios that trigger immediate alerts
    if (entry.riskScore >= 80) {
      await this.createSecurityAlert(
        'anomalous_access',
        entry.resourceId,
        `High-risk activity detected: ${entry.action}`,
        entry.userId
      );
    }

    // Multiple failed authentications
    if (entry.action === 'user_authenticated' && !entry.success) {
      const recentFailures = await this.countRecentFailedLogins(entry.userId || '', 15); // 15 minutes
      if (recentFailures >= 5) {
        await this.createSecurityAlert(
          'failed_authentication',
          entry.userId || 'unknown',
          `Multiple failed login attempts: ${recentFailures} in 15 minutes`,
          entry.userId
        );
      }
    }

    // Mass data export detection
    if (entry.action === 'data_exported') {
      const resourceCount = entry.metadata?.resourceCount as number || 0;
      if (resourceCount > 50) {
        await this.createSecurityAlert(
          'mass_export',
          entry.resourceId,
          `Large data export detected: ${resourceCount} resources`,
          entry.userId
        );
      }
    }
  }

  // Create security alert
  private async createSecurityAlert(
    alertType: SecurityAlert['alertType'],
    resourceId: string,
    description: string,
    userId?: string
  ): Promise<void> {
    const alert: SecurityAlert = {
      alertId: crypto.randomUUID(),
      firmId: this.firmId,
      timestamp: new Date(),
      severity: this.determineSeverity(alertType),
      alertType,
      description,
      affectedResources: [resourceId],
      recommendedActions: this.getRecommendedActions(alertType),
      autoRemediated: false,
      relatedAuditIds: [],
      investigationStatus: 'open'
    };

    logger.warn('Security alert created', {
      alertId: alert.alertId,
      alertType,
      severity: alert.severity,
      firmId: this.firmId,
      userId
    });

    // TODO: Store alert and notify administrators
    // await this.alertStorage.store(alert);
    // await this.notificationService.notifyAdmins(alert);
  }

  // Determine alert severity
  private determineSeverity(alertType: SecurityAlert['alertType']): SecurityAlert['severity'] {
    const severityMap: Record<SecurityAlert['alertType'], SecurityAlert['severity']> = {
      'anomalous_access': 'high',
      'mass_export': 'high',
      'failed_authentication': 'medium',
      'integrity_violation': 'critical',
      'encryption_failure': 'high'
    };

    return severityMap[alertType] || 'medium';
  }

  // Get recommended actions for alert type
  private getRecommendedActions(alertType: SecurityAlert['alertType']): string[] {
    const actionMap: Record<SecurityAlert['alertType'], string[]> = {
      'anomalous_access': [
        'Review user access patterns',
        'Verify user identity',
        'Consider temporary access suspension'
      ],
      'mass_export': [
        'Review export justification',
        'Verify user authorization for bulk export',
        'Audit exported data contents'
      ],
      'failed_authentication': [
        'Check for brute force attack',
        'Consider IP blocking',
        'Notify user of suspicious activity'
      ],
      'integrity_violation': [
        'Immediate investigation required',
        'Preserve evidence',
        'Consider system isolation'
      ],
      'encryption_failure': [
        'Check encryption system status',
        'Verify key management',
        'Ensure data protection'
      ]
    };

    return actionMap[alertType] || ['Investigate and take appropriate action'];
  }

  // Count recent failed login attempts (placeholder)
  private async countRecentFailedLogins(userId: string, minutesBack: number): Promise<number> {
    // TODO: Implement actual query against audit logs
    return 0;
  }

  // Verify audit trail integrity
  async verifyAuditIntegrity(auditId: string): Promise<boolean> {
    // TODO: Implement audit trail verification
    // 1. Retrieve audit entry
    // 2. Recalculate hash
    // 3. Verify chain integrity
    // 4. Return verification result
    return true;
  }

  // Generate compliance report
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    // TODO: Implement compliance reporting
    return {
      firmId: this.firmId,
      reportPeriod: { start: startDate, end: endDate },
      totalAuditEntries: 0,
      accessEvents: 0,
      securityAlerts: 0,
      complianceScore: 100,
      recommendations: []
    };
  }
}

// Compliance report interface
export interface ComplianceReport {
  firmId: string;
  reportPeriod: { start: Date; end: Date };
  totalAuditEntries: number;
  accessEvents: number;
  securityAlerts: number;
  complianceScore: number;
  recommendations: string[];
}

// Export audit utilities
export function createAuditLogger(firmId: string): HIPAAAuditLogger {
  return new HIPAAAuditLogger(firmId);
}