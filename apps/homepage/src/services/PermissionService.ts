/**
 * Permission Service - Enterprise Authorization System
 * 
 * Centralized service for all authorization decisions. This is the single
 * source of truth for permission validation and role-based access control.
 * 
 * Replaces scattered Auth0 metadata checks with proper RBAC implementation.
 */

import type { 
  User, 
  Firm, 
  UserPermissions, 
  UserRole,
  PermissionContext,
  AuditAction,
  DatabaseClient
} from '../db/types.js';

// Permission actions that can be performed
export type PermissionAction = 
  | 'list_users'
  | 'invite_user'
  | 'remove_user'
  | 'change_user_role'
  | 'view_settings'
  | 'manage_firm'
  | 'view_analytics'
  | 'manage_integrations'
  | 'view_conversations'
  | 'manage_billing';

// Result of permission validation
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  user?: User;
  firm?: Firm;
}

// Permission error class
export class PermissionError extends Error {
  constructor(
    public code: string,
    message: string,
    public action?: string,
    public resourceId?: string
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class PermissionService {
  private db: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.db = database;
  }

  /**
   * Main permission validation method
   * This is the single entry point for all authorization decisions
   */
  async validatePermission(
    userId: string,
    action: PermissionAction,
    resourceId?: string
  ): Promise<PermissionResult> {
    try {
      // Get user and firm data
      const user = await this.db.getUser(userId);
      if (!user) {
        return {
          allowed: false,
          reason: 'User not found'
        };
      }

      const firm = await this.db.getFirm(user.firm_id);
      if (!firm) {
        return {
          allowed: false,
          reason: 'Firm not found'
        };
      }

      // Check if user is active
      if (user.status !== 'active') {
        return {
          allowed: false,
          reason: `User status is ${user.status}`,
          user,
          firm
        };
      }

      // Check if firm is active
      if (firm.status !== 'active') {
        return {
          allowed: false,
          reason: `Firm status is ${firm.status}`,
          user,
          firm
        };
      }

      // Validate the specific permission
      const hasPermission = await this.checkRoleBasedPermission(user, action, resourceId);
      
      if (!hasPermission) {
        return {
          allowed: false,
          reason: `Insufficient permissions for action: ${action}`,
          user,
          firm
        };
      }

      // Log successful permission check
      await this.logPermissionCheck(user, firm, action, resourceId, true);

      return {
        allowed: true,
        user,
        firm
      };

    } catch (error) {
      console.error('Permission validation failed:', error);
      return {
        allowed: false,
        reason: 'Permission validation error'
      };
    }
  }

  /**
   * Role-based permission checking
   */
  private async checkRoleBasedPermission(
    user: User,
    action: PermissionAction,
    resourceId?: string
  ): Promise<boolean> {
    // Admin users have access to everything within their firm
    if (user.role === 'admin') {
      return true;
    }

    // Regular users have limited permissions
    if (user.role === 'user') {
      const userPermissions = this.getUserPermissions(user);
      
      switch (action) {
        case 'view_settings':
          return userPermissions.canViewSettings || false;
        
        case 'view_conversations':
          return true; // All users can view conversations
        
        case 'view_analytics':
          return userPermissions.canViewAnalytics || false;
        
        // These actions require admin role
        case 'list_users':
        case 'invite_user':
        case 'remove_user':
        case 'change_user_role':
        case 'manage_firm':
        case 'manage_integrations':
        case 'manage_billing':
          return false;
        
        default:
          return false;
      }
    }

    return false;
  }

  /**
   * Get computed permissions for a user
   */
  async getUserPermissions(user: User): Promise<UserPermissions> {
    // Start with role-based defaults
    const rolePermissions = this.getRolePermissions(user.role);
    
    // Merge with user-specific permissions
    const userSpecificPermissions = user.permissions || {};
    
    return {
      ...rolePermissions,
      ...userSpecificPermissions
    };
  }

  /**
   * Get default permissions for a role
   */
  private getRolePermissions(role: UserRole): UserPermissions {
    switch (role) {
      case 'admin':
        return {
          canManageUsers: true,
          canViewSettings: true,
          canManageFirm: true,
          canViewAnalytics: true,
          canManageIntegrations: true
        };
      
      case 'user':
        return {
          canManageUsers: false,
          canViewSettings: true,
          canManageFirm: false,
          canViewAnalytics: false,
          canManageIntegrations: false
        };
      
      default:
        return {};
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, role: UserRole, assignedByUserId: string): Promise<void> {
    const user = await this.db.getUser(userId);
    if (!user) {
      throw new PermissionError('USER_NOT_FOUND', 'User not found');
    }

    const assignedBy = await this.db.getUser(assignedByUserId);
    if (!assignedBy) {
      throw new PermissionError('ASSIGNER_NOT_FOUND', 'Assigning user not found');
    }

    // Only admins can assign roles
    if (assignedBy.role !== 'admin') {
      throw new PermissionError('INSUFFICIENT_PERMISSIONS', 'Only admins can assign roles');
    }

    // Cannot assign role to users in different firms
    if (user.firm_id !== assignedBy.firm_id) {
      throw new PermissionError('CROSS_FIRM_ASSIGNMENT', 'Cannot assign roles across firms');
    }

    const oldRole = user.role;
    
    // Update user role
    await this.db.updateUser(userId, { role });

    // Log the role change
    await this.db.logAudit({
      user_id: assignedByUserId,
      firm_id: user.firm_id,
      action: 'role_changed',
      target_user_id: userId,
      details: {
        previousValue: oldRole,
        newValue: role,
        reason: 'Role assignment'
      }
    });
  }

  /**
   * Remove user from firm
   */
  async removeUserFromFirm(userId: string, removedByUserId: string): Promise<void> {
    const user = await this.db.getUser(userId);
    if (!user) {
      throw new PermissionError('USER_NOT_FOUND', 'User not found');
    }

    const removedBy = await this.db.getUser(removedByUserId);
    if (!removedBy) {
      throw new PermissionError('REMOVER_NOT_FOUND', 'Removing user not found');
    }

    // Only admins can remove users
    if (removedBy.role !== 'admin') {
      throw new PermissionError('INSUFFICIENT_PERMISSIONS', 'Only admins can remove users');
    }

    // Cannot remove users from different firms
    if (user.firm_id !== removedBy.firm_id) {
      throw new PermissionError('CROSS_FIRM_REMOVAL', 'Cannot remove users from other firms');
    }

    // Cannot remove yourself
    if (userId === removedByUserId) {
      throw new PermissionError('SELF_REMOVAL', 'Cannot remove yourself');
    }

    // Check if this is the last admin
    const firmUsers = await this.db.listFirmUsers(user.firm_id);
    const admins = firmUsers.filter(u => u.role === 'admin' && u.status === 'active');
    
    if (user.role === 'admin' && admins.length === 1) {
      throw new PermissionError('LAST_ADMIN', 'Cannot remove the last admin from the firm');
    }

    // Log the removal
    await this.db.logAudit({
      user_id: removedByUserId,
      firm_id: user.firm_id,
      action: 'user_removed',
      target_user_id: userId,
      details: {
        removedUser: {
          email: user.email,
          role: user.role
        },
        reason: 'User removal'
      }
    });

    // Delete the user
    await this.db.deleteUser(userId);
  }

  /**
   * Get the first admin for a firm (used for onboarding)
   */
  async getFirstAdminForFirm(firmId: string): Promise<User | null> {
    const users = await this.db.listFirmUsers(firmId);
    const admins = users.filter(u => u.role === 'admin' && u.status === 'active');
    
    if (admins.length === 0) {
      return null;
    }

    // Return the oldest admin (first created)
    return admins.sort((a, b) => a.created_at - b.created_at)[0];
  }

  /**
   * Check if a firm has any admins
   */
  async firmHasAdmins(firmId: string): Promise<boolean> {
    const admin = await this.getFirstAdminForFirm(firmId);
    return admin !== null;
  }

  /**
   * Make user admin if they're the first user in firm
   */
  async ensureFirstUserIsAdmin(userId: string): Promise<boolean> {
    const user = await this.db.getUser(userId);
    if (!user) return false;

    const hasAdmins = await this.firmHasAdmins(user.firm_id);
    
    if (!hasAdmins) {
      await this.db.updateUser(userId, { 
        role: 'admin',
        status: 'active'
      });

      await this.db.logAudit({
        user_id: userId,
        firm_id: user.firm_id,
        action: 'role_changed',
        target_user_id: userId,
        details: {
          previousValue: 'user',
          newValue: 'admin',
          reason: 'First user auto-promotion to admin'
        }
      });

      return true;
    }

    return false;
  }

  /**
   * Validate JWT token and get user context
   */
  async validateToken(tokenHash: string): Promise<PermissionResult> {
    const session = await this.db.getSessionByTokenHash(tokenHash);
    
    if (!session) {
      return {
        allowed: false,
        reason: 'Invalid or expired token'
      };
    }

    const user = await this.db.getUser(session.user_id);
    if (!user) {
      return {
        allowed: false,
        reason: 'User not found'
      };
    }

    const firm = await this.db.getFirm(user.firm_id);
    if (!firm) {
      return {
        allowed: false,
        reason: 'Firm not found'
      };
    }

    return {
      allowed: true,
      user,
      firm
    };
  }

  /**
   * Log permission check for audit purposes
   */
  private async logPermissionCheck(
    user: User,
    firm: Firm,
    action: PermissionAction,
    resourceId?: string,
    success: boolean = true
  ): Promise<void> {
    // Only log failed permission checks to avoid spam
    if (!success) {
      await this.db.logAudit({
        user_id: user.id,
        firm_id: firm.id,
        action: 'permission_denied',
        details: {
          action,
          resourceId,
          reason: 'Permission check failed'
        }
      });
    }
  }

  /**
   * Health check for the permission service
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.db.healthCheck();
    } catch {
      return false;
    }
  }
}

// Factory function to create permission service
export function createPermissionService(database: DatabaseClient): PermissionService {
  return new PermissionService(database);
}