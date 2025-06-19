// Authentication and authorization types

export type UserType = 'lexara_admin' | 'firm_admin' | 'firm_user' | 'client';

export interface AuthContext {
  userId: string;
  userType: UserType;
  roles: string[];
  permissions: string[];
  orgId: string;
  email: string;
  firmId?: string;
  firmSlug?: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  'https://lexara.app/user_type': UserType;
  'https://lexara.app/org_id': string;
  'https://lexara.app/roles': string[];
  'https://lexara.app/permissions': string[];
  'https://lexara.app/firm_id'?: string;
  'https://lexara.app/firm_slug'?: string;
  exp: number;
}

export interface SessionData {
  sessionId: string;
  auth0UserId: string;
  userEmail: string;
  userName: string;
  userType: UserType;
  roles: string[];
  permissions: string[];
  firmId?: string;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
}