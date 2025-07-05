/**
 * Secure Individual User Management API
 * 
 * Database-backed operations on individual users with multi-tenant isolation.
 */

import type { APIRoute } from 'astro';
import { withAuth, createSuccessResponse, createErrorResponse, type AuthContext } from '../../../../../middleware/authMiddleware.js';
import { createDatabaseClient } from '../../../../../db/client.js';
import type { UpdateEntity, User } from '../../../../../db/types.js';

// GET /api/v1/secure/users/{userId} - Get specific user details
export const GET: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm } = authContext;
  
  try {
    const userId = request.params.userId as string;
    if (!userId) {
      return createErrorResponse(
        new Error('User ID is required'),
        400
      );
    }

    console.log(`👤 Getting details for user ${userId} in firm ${firm.id}`);

    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Get the user - automatically scoped to firm
    const targetUser = await db.getUser(firm.id, userId);
    
    if (!targetUser) {
      return createErrorResponse(
        new Error('User not found or access denied'),
        404
      );
    }

    // Format user for response
    const formattedUser = {
      id: targetUser.id,
      email: targetUser.email,
      firstName: targetUser.first_name,
      lastName: targetUser.last_name,
      role: targetUser.role,
      status: targetUser.status,
      lastLogin: targetUser.last_login ? new Date(targetUser.last_login * 1000).toISOString() : null,
      createdAt: new Date(targetUser.created_at * 1000).toISOString(),
      updatedAt: new Date(targetUser.updated_at * 1000).toISOString(),
      permissions: targetUser.permissions,
      invitedBy: targetUser.invited_by
    };
    
    console.log(`✅ User details retrieved: ${targetUser.email}`);

    return createSuccessResponse({
      user: formattedUser
    });

  } catch (error) {
    console.error('❌ Failed to get user details:', error);
    return createErrorResponse(error as Error, 500);
  }
}, { requiredPermission: 'list_users' });

// PATCH /api/v1/secure/users/{userId} - Update user role or metadata
export const PATCH: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm } = authContext;
  
  try {
    const userId = request.params.userId as string;
    if (!userId) {
      return createErrorResponse(
        new Error('User ID is required'),
        400
      );
    }

    const requestData = await request.json();
    const { role, firstName, lastName, status } = requestData;
    
    console.log(`🔄 Updating user ${userId} in firm ${firm.id}`);

    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Build update data
    const updateData: UpdateEntity<User> = {};
    
    if (role) {
      if (!['admin', 'staff'].includes(role)) {
        return createErrorResponse(
          new Error('Role must be either "admin" or "staff"'),
          400
        );
      }
      
      // Check if this would remove the last admin
      if (role !== 'admin') {
        const currentUser = await db.getUser(firm.id, userId);
        if (currentUser && currentUser.role === 'admin') {
          const users = await db.listFirmUsers(firm.id);
          const activeAdmins = users.filter(u => u.role === 'admin' && u.status === 'active' && u.id !== userId);
          
          if (activeAdmins.length === 0) {
            return createErrorResponse(
              new Error('Cannot change role - this would remove the last admin'),
              400
            );
          }
        }
      }
      
      updateData.role = role;
      updateData.permissions = role === 'admin' 
        ? { 'firm:admin': true, 'firm:manage_users': true, 'firm:manage_settings': true }
        : { 'firm:view_conversations': true };
    }
    
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (status) updateData.status = status;

    // Update the user
    const updatedUser = await db.updateUser(firm.id, userId, updateData);
    
    // Log audit event
    await db.logAudit({
      user_id: user.id,
      firm_id: firm.id,
      action: 'user.role_changed',
      target_user_id: userId,
      details: { newRole: role, updates: updateData },
      ip_address: request.headers.get('CF-Connecting-IP') || null,
      user_agent: request.headers.get('User-Agent') || null
    });
    
    console.log(`✅ User role updated: ${updatedUser.email} → ${role || updatedUser.role}`);

    return createSuccessResponse({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        role: updatedUser.role,
        status: updatedUser.status,
        permissions: updatedUser.permissions,
        updatedAt: new Date(updatedUser.updated_at * 1000).toISOString()
      },
      message: `User ${updatedUser.email} updated successfully`
    });

  } catch (error) {
    console.error('❌ Failed to update user:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return createErrorResponse(
        new Error('User not found or access denied'),
        404
      );
    }
    
    return createErrorResponse(error as Error, 500);
  }
}, { requiredPermission: 'change_user_role' });

// DELETE /api/v1/secure/users/{userId} - Remove user from firm
export const DELETE: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm } = authContext;
  
  try {
    const userId = request.params.userId as string;
    if (!userId) {
      return createErrorResponse(
        new Error('User ID is required'),
        400
      );
    }

    // Prevent self-removal
    if (userId === user.id) {
      return createErrorResponse(
        new Error('You cannot remove your own account'),
        400
      );
    }

    console.log(`🗑️ Removing user ${userId} from firm ${firm.id}`);

    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Get user details before deletion
    const userToRemove = await db.getUser(firm.id, userId);
    if (!userToRemove) {
      return createErrorResponse(
        new Error('User not found or access denied'),
        404
      );
    }

    // Check if this is the last admin
    if (userToRemove.role === 'admin') {
      const users = await db.listFirmUsers(firm.id);
      const activeAdmins = users.filter(u => u.role === 'admin' && u.status === 'active');
      
      if (activeAdmins.length <= 1) {
        return createErrorResponse(
          new Error('Cannot remove the last admin from the firm'),
          400
        );
      }
    }

    // Delete the user
    const deleted = await db.deleteUser(firm.id, userId);
    
    if (!deleted) {
      return createErrorResponse(
        new Error('Failed to remove user'),
        500
      );
    }
    
    // Log audit event
    await db.logAudit({
      user_id: user.id,
      firm_id: firm.id,
      action: 'user.removed',
      target_user_id: userId,
      details: { 
        email: userToRemove.email,
        role: userToRemove.role 
      },
      ip_address: request.headers.get('CF-Connecting-IP') || null,
      user_agent: request.headers.get('User-Agent') || null
    });
    
    console.log(`✅ User removed: ${userToRemove.email}`);

    return createSuccessResponse({
      message: `User ${userToRemove.email} has been removed from the firm`
    });

  } catch (error) {
    console.error('❌ Failed to remove user:', error);
    return createErrorResponse(error as Error, 500);
  }
}, { requiredPermission: 'remove_user' });