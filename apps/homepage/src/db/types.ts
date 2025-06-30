/**
 * Database types for the Authorization System
 * 
 * These types represent the database schema for enterprise-grade
 * user management, replacing Auth0 metadata with proper database tables.
 */

// Enums for type safety
export type FirmStatus = 'active' | 'suspended' | 'trial';
export type FirmPlan = 'starter' | 'professional' | 'enterprise';
export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'pending' | 'inactive' | 'suspended';

// Base interface for database entities
interface BaseEntity {
  id: string;
  created_at: number;
  updated_at: number;
}

// Firm entity
export interface Firm extends BaseEntity {
  name: string;
  domain: string;
  plan: FirmPlan;
  settings: FirmSettings;
  status: FirmStatus;
}

// Firm settings (stored as JSON)
export interface FirmSettings {
  timezone?: string;
  dateFormat?: string;
  allowUserInvites?: boolean;
  requireEmailVerification?: boolean;
  sessionTimeout?: number; // minutes
  [key: string]: any; // Allow additional settings
}

// User entity
export interface User extends BaseEntity {
  auth0_id: string; // Link to Auth0 for authentication only
  firm_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  status: UserStatus;
  permissions: UserPermissions;
  invited_by?: string; // User ID of inviter
  last_login?: number;
}

// User permissions (stored as JSON)
export interface UserPermissions {
  canManageUsers?: boolean;
  canViewSettings?: boolean;
  canManageFirm?: boolean;
  canViewAnalytics?: boolean;
  canManageIntegrations?: boolean;
  [key: string]: boolean | undefined; // Allow additional permissions
}

// User session entity
export interface UserSession extends BaseEntity {
  user_id: string;
  token_hash: string; // SHA-256 hash of JWT token
  permissions: UserPermissions; // Cached permissions at session creation
  ip_address?: string;
  user_agent?: string;
  expires_at: number;
}

// Audit log entity
export interface AuditLogEntry extends BaseEntity {
  user_id?: string; // User performing the action
  firm_id?: string;
  action: AuditAction;
  target_user_id?: string; // User being acted upon
  details: AuditDetails;
  ip_address?: string;
  user_agent?: string;
}

// Audit action types
export type AuditAction = 
  | 'user_created'
  | 'user_invited'
  | 'user_activated'
  | 'user_deactivated'
  | 'user_suspended'
  | 'role_changed'
  | 'permission_granted'
  | 'permission_revoked'
  | 'firm_created'
  | 'firm_updated'
  | 'settings_changed'
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'session_expired';

// Audit details (stored as JSON)
export interface AuditDetails {
  previousValue?: any;
  newValue?: any;
  reason?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

// Database query result types
export interface DatabaseQueryResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rowsAffected?: number;
}

// User with firm information (for API responses)
export interface UserWithFirm extends User {
  firm: Firm;
}

// Display-friendly user type (for UI)
export interface DisplayUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  lastLogin?: string;
  invitedBy?: string;
  firm: {
    id: string;
    name: string;
  };
}

// Permission validation context
export interface PermissionContext {
  user: User;
  firm: Firm;
  session: UserSession;
  requiredAction: string;
  resourceId?: string;
}

// Database connection interface
export interface DatabaseClient {
  // Firm operations
  createFirm(firm: Omit<Firm, 'id' | 'created_at' | 'updated_at'>): Promise<Firm>;
  getFirm(id: string): Promise<Firm | null>;
  getFirmByDomain(domain: string): Promise<Firm | null>;
  updateFirm(id: string, updates: Partial<Firm>): Promise<Firm>;
  
  // User operations
  createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByAuth0Id(auth0Id: string): Promise<User | null>;
  getUserByEmail(email: string, firmId: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  listFirmUsers(firmId: string): Promise<User[]>;
  
  // Session operations
  createSession(session: Omit<UserSession, 'id' | 'created_at'>): Promise<UserSession>;
  getSession(id: string): Promise<UserSession | null>;
  getSessionByTokenHash(tokenHash: string): Promise<UserSession | null>;
  deleteSession(id: string): Promise<void>;
  deleteExpiredSessions(): Promise<number>;
  
  // Audit operations
  logAudit(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<AuditLogEntry>;
  getAuditLog(firmId: string, limit?: number): Promise<AuditLogEntry[]>;
}

// Helper type for creating new entities
export type CreateEntity<T extends BaseEntity> = Omit<T, 'id' | 'created_at' | 'updated_at'>;

// Helper type for updating entities
export type UpdateEntity<T extends BaseEntity> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>;