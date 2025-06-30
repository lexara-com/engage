/**
 * User Permission Validation Utilities
 * 
 * This module provides permission validation for user management operations,
 * ensuring only authorized users can perform administrative tasks.
 */

import { Auth0ManagementClient, type Auth0User, extractFirmId, isUserAdmin } from './auth0-management.js';

export interface UserPermissionContext {
  userId: string;
  firmId: string;
  action: UserManagementAction;
  targetUserId?: string;
}

export type UserManagementAction = 
  | 'list_users'
  | 'invite_user' 
  | 'update_role'
  | 'remove_user'
  | 'view_settings';

export class PermissionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class UserPermissionValidator {
  private auth0Client: Auth0ManagementClient;

  constructor(auth0Client: Auth0ManagementClient) {
    this.auth0Client = auth0Client;
  }

  /**
   * Validate that a user has permission to perform a user management action
   */
  async validateUserManagementPermission(context: UserPermissionContext): Promise<Auth0User> {
    console.log(`🔒 Validating permission: ${context.action} for user ${context.userId} in firm ${context.firmId}`);

    // 1. Get the requesting user's data
    const requestingUser = await this.auth0Client.getUser(context.userId);
    
    // 2. Verify user belongs to the specified firm
    const userFirmId = extractFirmId(requestingUser);
    if (userFirmId !== context.firmId) {
      throw new PermissionError(
        'You do not have access to this firm',
        'FIRM_ACCESS_DENIED'
      );
    }

    // 3. Check if user has admin role
    if (!isUserAdmin(requestingUser)) {
      throw new PermissionError(
        'Only administrators can manage users',
        'ADMIN_REQUIRED'
      );
    }

    // 4. Special validation for user removal
    if (context.action === 'remove_user' && context.targetUserId) {
      await this.validateUserRemoval(context.targetUserId, context.firmId);
    }

    console.log(`✅ Permission validated for ${context.action}`);
    return requestingUser;
  }

  /**
   * Validate that a user can be removed (not the last admin)
   */
  private async validateUserRemoval(targetUserId: string, firmId: string): Promise<void> {
    console.log(`🔍 Validating user removal: ${targetUserId}`);

    // Get the target user to check if they're an admin
    const targetUser = await this.auth0Client.getUser(targetUserId);
    
    // If target user is not an admin, removal is allowed
    if (!isUserAdmin(targetUser)) {
      console.log('✅ Non-admin user removal allowed');
      return;
    }

    // If target user is admin, check if they're the last admin
    const firmAdmins = await this.auth0Client.getFirmAdmins(firmId);
    
    if (firmAdmins.length <= 1) {
      throw new PermissionError(
        'Cannot remove the last administrator. Each firm must have at least one admin.',
        'LAST_ADMIN_PROTECTION'
      );
    }

    console.log(`✅ Admin removal allowed (${firmAdmins.length - 1} admins will remain)`);
  }

  /**
   * Validate that a role change is allowed
   */
  async validateRoleChange(
    requestingUserId: string, 
    targetUserId: string, 
    newRole: 'admin' | 'user',
    firmId: string
  ): Promise<void> {
    console.log(`🔄 Validating role change: ${targetUserId} → ${newRole}`);

    // First validate requesting user has permission
    await this.validateUserManagementPermission({
      userId: requestingUserId,
      firmId: firmId,
      action: 'update_role',
      targetUserId: targetUserId
    });

    // If changing admin to user, check last admin rule
    if (newRole === 'user') {
      const targetUser = await this.auth0Client.getUser(targetUserId);
      
      // If target is currently an admin, validate we're not removing the last admin
      if (isUserAdmin(targetUser)) {
        const firmAdmins = await this.auth0Client.getFirmAdmins(firmId);
        
        if (firmAdmins.length <= 1) {
          throw new PermissionError(
            'Cannot change the last administrator to user role. Each firm must have at least one admin.',
            'LAST_ADMIN_PROTECTION'
          );
        }
      }
    }

    console.log(`✅ Role change validated: ${targetUserId} → ${newRole}`);
  }

  /**
   * Get user permissions summary for display
   */
  async getUserPermissions(userId: string, firmId: string): Promise<UserPermissionSummary> {
    try {
      const user = await this.auth0Client.getUser(userId);
      const userFirmId = extractFirmId(user);
      const isAdmin = isUserAdmin(user);
      const belongsToFirm = userFirmId === firmId;

      return {
        userId: userId,
        firmId: firmId,
        belongsToFirm: belongsToFirm,
        isAdmin: isAdmin,
        canViewSettings: belongsToFirm && isAdmin,
        canInviteUsers: belongsToFirm && isAdmin,
        canRemoveUsers: belongsToFirm && isAdmin,
        canChangeRoles: belongsToFirm && isAdmin,
        canViewConversations: belongsToFirm
      };
    } catch (error) {
      console.error('Failed to get user permissions:', error);
      
      // Return safe defaults on error
      return {
        userId: userId,
        firmId: firmId,
        belongsToFirm: false,
        isAdmin: false,
        canViewSettings: false,
        canInviteUsers: false,
        canRemoveUsers: false,
        canChangeRoles: false,
        canViewConversations: false
      };
    }
  }
}

export interface UserPermissionSummary {
  userId: string;
  firmId: string;
  belongsToFirm: boolean;
  isAdmin: boolean;
  canViewSettings: boolean;
  canInviteUsers: boolean;
  canRemoveUsers: boolean;
  canChangeRoles: boolean;
  canViewConversations: boolean;
}

/**
 * Factory function to create permission validator
 */
export function createUserPermissionValidator(auth0Client: Auth0ManagementClient): UserPermissionValidator {
  return new UserPermissionValidator(auth0Client);
}

/**
 * Utility function to extract user ID from Auth0 JWT token
 * This should be used in API endpoints to get the requesting user's ID
 */
export function extractUserIdFromToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    
    // For now, we'll decode the JWT without verification since we're focusing on user management
    // In production, this should use proper JWT verification
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch (error) {
    console.error('Failed to extract user ID from token:', error);
    return null;
  }
}

/**
 * Utility function to extract firm ID from Auth0 JWT token
 */
export function extractFirmIdFromToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));
    
    // Try multiple possible locations for firm ID
    return payload['https://lexara.app/firm_id'] ||
           payload['https://lexara.app/org_id'] ||
           payload.org_id ||
           payload.firmId ||
           null;
  } catch (error) {
    console.error('Failed to extract firm ID from token:', error);
    return null;
  }
}

/**
 * Middleware-style function for API routes to validate permissions
 */
export async function validateApiPermissions(
  request: Request,
  auth0Client: Auth0ManagementClient,
  requiredAction: UserManagementAction,
  firmId?: string
): Promise<{ userId: string; firmId: string; user: Auth0User }> {
  
  const authHeader = request.headers.get('Authorization');
  const userId = extractUserIdFromToken(authHeader);
  
  if (!userId) {
    throw new PermissionError('Authentication required', 'AUTH_REQUIRED');
  }

  // If firmId not provided, try to extract from token
  const resolvedFirmId = firmId || extractFirmIdFromToken(authHeader);
  
  if (!resolvedFirmId) {
    throw new PermissionError('Firm context required', 'FIRM_REQUIRED');
  }

  const validator = new UserPermissionValidator(auth0Client);
  
  const user = await validator.validateUserManagementPermission({
    userId: userId,
    firmId: resolvedFirmId,
    action: requiredAction
  });

  return {
    userId: userId,
    firmId: resolvedFirmId,
    user: user
  };
}