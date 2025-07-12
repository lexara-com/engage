/**
 * User Management Types
 */

export interface FirmUser {
  id: string;
  firmId: string;
  auth0UserId: string;
  email: string;
  name: string;
  role: FirmUserRole;
  isActive: boolean;
  lastSyncedAt?: string;
  deletedAt?: string;
  deletionReason?: string;
  createdAt: string;
  updatedAt: string;
  // Additional fields from Auth0
  emailVerified?: boolean;
  lastLogin?: string;
  loginsCount?: number;
  blocked?: boolean;
}

export type FirmUserRole = 'firm:admin' | 'firm:lawyer' | 'firm:staff' | 'firm:viewer' | 'admin' | 'lawyer' | 'staff' | 'viewer';

export interface UserAuditLog {
  id: string;
  firmId: string;
  userId: string;
  performedBy: string;
  action: UserAction;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export type UserAction = 
  | 'created'
  | 'updated'
  | 'deleted'
  | 'blocked'
  | 'unblocked'
  | 'role_changed'
  | 'password_reset';

export interface UserListFilters {
  search?: string;
  role?: FirmUserRole;
  status?: 'active' | 'inactive' | 'blocked';
  includeDeleted?: boolean;
}

export interface UserListResponse {
  users: FirmUser[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: FirmUserRole;
  sendInvitation?: boolean;
}

export interface UpdateUserRequest {
  role?: FirmUserRole;
  isActive?: boolean;
}

export interface UserDetailResponse {
  user: FirmUser;
  auditLogs: UserAuditLog[];
  permissions: string[];
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  ticketUrl?: string;
}

export interface BulkUserOperation {
  userIds: string[];
  action: 'activate' | 'deactivate' | 'delete';
  reason?: string;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  usersByRole: Record<string, number>;
  recentActivity: UserAuditLog[];
}

// Helper functions for role management
export const roleLabels: Record<string, string> = {
  'firm:admin': 'Administrator',
  'firm:lawyer': 'Lawyer',
  'firm:staff': 'Staff',
  'firm:viewer': 'Viewer',
  'admin': 'Administrator',
  'lawyer': 'Lawyer',
  'staff': 'Staff',
  'viewer': 'Viewer',
};

export const roleColors: Record<string, string> = {
  'firm:admin': 'bg-purple-100 text-purple-800',
  'firm:lawyer': 'bg-blue-100 text-blue-800',
  'firm:staff': 'bg-green-100 text-green-800',
  'firm:viewer': 'bg-gray-100 text-gray-800',
  'admin': 'bg-purple-100 text-purple-800',
  'lawyer': 'bg-blue-100 text-blue-800',
  'staff': 'bg-green-100 text-green-800',
  'viewer': 'bg-gray-100 text-gray-800',
};

export const rolePermissions: Record<string, string[]> = {
  'firm:admin': [
    'manage_users',
    'manage_settings',
    'view_analytics',
    'manage_conversations',
    'manage_billing',
  ],
  'firm:lawyer': [
    'view_conversations',
    'manage_own_conversations',
    'view_analytics',
  ],
  'firm:staff': [
    'view_conversations',
    'create_conversations',
  ],
  'firm:viewer': [
    'view_conversations',
  ],
  'admin': [
    'manage_users',
    'manage_settings',
    'view_analytics',
    'manage_conversations',
    'manage_billing',
  ],
  'lawyer': [
    'view_conversations',
    'manage_own_conversations',
    'view_analytics',
  ],
  'staff': [
    'view_conversations',
    'create_conversations',
  ],
  'viewer': [
    'view_conversations',
  ],
};

export function canManageUsers(role: FirmUserRole): boolean {
  return role === 'firm:admin' || role === 'admin';
}

export function getStatusColor(user: FirmUser): string {
  if (user.deletedAt) return 'bg-red-100 text-red-800';
  if (user.blocked) return 'bg-orange-100 text-orange-800';
  if (!user.isActive) return 'bg-gray-100 text-gray-800';
  return 'bg-green-100 text-green-800';
}

export function getStatusLabel(user: FirmUser): string {
  if (user.deletedAt) return 'Deleted';
  if (user.blocked) return 'Blocked';
  if (!user.isActive) return 'Inactive';
  return 'Active';
}