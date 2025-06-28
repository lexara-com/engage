// HIPAA compliance and encryption types

export interface EncryptedMessage {
  id: string;
  role: 'user' | 'agent';
  content?: string;
  encryptedContent?: {
    encryptedData: string;
    iv: string;
    authTag: string;
    algorithm: 'AES-256-GCM';
    keyId: string;
  };
  isEncrypted: boolean;
  isPII: boolean;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface EncryptionKey {
  keyId: string;
  algorithm: 'AES-256-GCM';
  createdAt: Date;
  isActive: boolean;
  firmId: string;
}

export interface AuditLogEntry {
  id: string;
  firmId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface DataRetentionPolicy {
  firmId: string;
  retentionPeriodDays: number;
  autoDeleteEnabled: boolean;
  lastCleanupDate?: Date;
  exemptionRules?: {
    resourceType: string;
    condition: string;
    extendedRetentionDays: number;
  }[];
}