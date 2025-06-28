// Firm and organization types

export type SubscriptionTier = 'starter' | 'professional' | 'enterprise';
export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'cancelled';
export type FirmRole = 'admin' | 'lawyer' | 'staff' | 'viewer';

export interface FirmBranding {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily?: string;
  customCss?: string;
}

export interface FirmSubscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  trialEndsAt?: Date;
  monthlyConversationLimit: number;
  currentUsage: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface FirmCompliance {
  hipaaEnabled: boolean;
  retentionPolicyDays: number;
  allowAnonymousChats: boolean;
  requireAuth0Login: boolean;
  enableConflictChecking: boolean;
}

export interface Firm {
  id: string;
  name: string;
  slug: string;
  domain: string;
  isActive: boolean;
  practiceAreas: string[];
  jurisdiction: string;
  
  subscription: FirmSubscription;
  branding: FirmBranding;
  compliance: FirmCompliance;
  
  createdAt: Date;
  updatedAt: Date;
  
  contactInfo: {
    address: string;
    phone: string;
    email: string;
    website?: string;
  };
  
  auth0Config: {
    domain: string;
    clientId: string;
    audience: string;
    organizationId: string;
  };
}

export interface FirmUser {
  id: string;
  firmId: string;
  auth0UserId: string;
  email: string;
  name: string;
  role: FirmRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FirmSettings {
  firmId: string;
  intakeSettings: {
    enableConflictChecking: boolean;
    requireClientAuth: boolean;
    sessionTimeoutMinutes: number;
    maxConcurrentSessions: number;
  };
  notificationSettings: {
    emailNotifications: boolean;
    newConversationEmail: string[];
    conflictAlertEmail: string[];
  };
  dataRetention: {
    conversationRetentionDays: number;
    autoDeleteAfterRetention: boolean;
    enableDataExport: boolean;
  };
}