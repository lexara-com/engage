/**
 * Individual User Management API
 * 
 * This API endpoint handles operations on individual users:
 * - GET: Get specific user details
 * - PATCH: Update user role or metadata
 * - DELETE: Remove user from firm
 */

import type { APIRoute } from 'astro';
import { createAuth0ManagementClient, formatUserForDisplay, extractFirmId } from '../../../../../utils/auth0-management.js';
import { validateApiPermissions, PermissionError, createUserPermissionValidator } from '../../../../../utils/user-permissions.js';

// GET /api/v1/firm/users/{userId} - Get specific user details
export const GET: APIRoute = async (context) => {
  try {
    console.log('👤 API: Getting user details');
    
    const userId = context.params.userId as string;
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get firm ID from query parameters
    const url = new URL(context.request.url);
    const firmId = url.searchParams.get('firmId');
    
    if (!firmId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'MISSING_FIRM_ID',
          message: 'Firm ID is required'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Auth0 client
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    
    // Validate permissions
    await validateApiPermissions(
      context.request,
      auth0Client,
      'list_users',
      firmId
    );

    console.log(`👤 Getting details for user ${userId} in firm ${firmId}`);

    // Get the user
    const user = await auth0Client.getUser(userId);
    
    // Verify user belongs to the firm
    const userFirmId = extractFirmId(user);
    if (userFirmId !== firmId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'USER_NOT_IN_FIRM',
          message: 'User does not belong to this firm'
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const formattedUser = formatUserForDisplay(user);
    
    console.log(`✅ User details retrieved: ${user.email}`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        user: formattedUser
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to get user details:', error);
    
    if (error instanceof PermissionError) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (error instanceof Error && error.message.includes('User not found')) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'USER_GET_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get user details'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PATCH /api/v1/firm/users/{userId} - Update user role or metadata
export const PATCH: APIRoute = async (context) => {
  try {
    console.log('🔄 API: Updating user');
    
    const userId = context.params.userId as string;
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const requestData = await context.request.json();
    const { role, firmId } = requestData;
    
    if (!firmId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'MISSING_FIRM_ID',
          message: 'Firm ID is required'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!role) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'MISSING_ROLE',
          message: 'Role is required for user updates'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate role
    if (!['admin', 'user'].includes(role)) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: 'Role must be either "admin" or "user"'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Auth0 client
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    
    // Validate permissions and role change
    const { userId: requestingUserId } = await validateApiPermissions(
      context.request,
      auth0Client,
      'update_role',
      firmId
    );

    // Additional validation for role changes
    const validator = createUserPermissionValidator(auth0Client);
    await validator.validateRoleChange(requestingUserId, userId, role, firmId);

    console.log(`🔄 Updating user ${userId} role to ${role} in firm ${firmId}`);

    // Update the user role
    const updatedUser = await auth0Client.updateUserRole(userId, role);
    const formattedUser = formatUserForDisplay(updatedUser);
    
    console.log(`✅ User role updated: ${updatedUser.email} → ${role}`);

    // Log audit event (stubbed)
    console.log('AUDIT_LOG:', JSON.stringify({
      timestamp: new Date().toISOString(),
      action: 'role_changed',
      firmId: firmId,
      performedBy: requestingUserId,
      targetUser: userId,
      details: { newRole: role },
      userAgent: context.request.headers.get('User-Agent')
    }));

    return new Response(JSON.stringify({
      success: true,
      data: {
        user: formattedUser,
        message: `User role updated to ${role}`
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to update user:', error);
    
    if (error instanceof PermissionError) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'USER_UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update user'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE /api/v1/firm/users/{userId} - Remove user from firm
export const DELETE: APIRoute = async (context) => {
  try {
    console.log('🗑️ API: Removing user');
    
    const userId = context.params.userId as string;
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get firm ID from query parameters or request body
    const url = new URL(context.request.url);
    let firmId = url.searchParams.get('firmId');
    
    if (!firmId) {
      try {
        const requestData = await context.request.json();
        firmId = requestData.firmId;
      } catch {
        // If no JSON body, firmId remains null
      }
    }
    
    if (!firmId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'MISSING_FIRM_ID',
          message: 'Firm ID is required'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Auth0 client
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    
    // Validate permissions (this includes last admin validation)
    const { userId: requestingUserId } = await validateApiPermissions(
      context.request,
      auth0Client,
      'remove_user',
      firmId
    );

    // Additional validation - ensure target user belongs to firm
    const targetUser = await auth0Client.getUser(userId);
    const targetUserFirmId = extractFirmId(targetUser);
    
    if (targetUserFirmId !== firmId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'USER_NOT_IN_FIRM',
          message: 'User does not belong to this firm'
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`🗑️ Removing user ${userId} from firm ${firmId} (by ${requestingUserId})`);

    // Store user details for audit log before deletion
    const userEmail = targetUser.email;
    const userRole = targetUser.user_metadata?.role;

    // Delete the user
    await auth0Client.deleteUser(userId);
    
    console.log(`✅ User removed: ${userEmail}`);

    // Log audit event (stubbed)
    console.log('AUDIT_LOG:', JSON.stringify({
      timestamp: new Date().toISOString(),
      action: 'user_removed',
      firmId: firmId,
      performedBy: requestingUserId,
      targetUser: userId,
      details: { 
        email: userEmail,
        role: userRole 
      },
      userAgent: context.request.headers.get('User-Agent')
    }));

    return new Response(JSON.stringify({
      success: true,
      message: `User ${userEmail} has been removed from the firm`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to remove user:', error);
    
    if (error instanceof PermissionError) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (error instanceof Error && error.message.includes('User not found')) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'USER_REMOVAL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to remove user'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};