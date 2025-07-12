import type { APIRoute } from 'astro';
import { UserManagementService } from '../../../../services/user-management-service';
import type { UpdateUserRequest } from '../../../../types/user-management';

/**
 * GET /api/firm/users/[id] - Get single user details
 */
export const GET: APIRoute = async (context) => {
  const { locals, params } = context;
  const userId = params.id;

  // Check authentication
  if (!locals.isAuthenticated || !locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check permissions
  const userRoles = locals.user.roles || [];
  const canViewUsers = userRoles.includes('FirmAdmin') || userRoles.includes('firm:admin');
  
  if (!canViewUsers) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: 'User ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Initialize service
    const service = new UserManagementService(context, {
      id: locals.user.userId,
      email: locals.user.email,
      firmId: locals.user.firmId,
    });

    // Get user details
    const response = await service.getUserDetail(userId);

    return new Response(JSON.stringify({
      success: true,
      ...response,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to get user details:', error);
    
    if (error instanceof Error && error.message === 'User not found') {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Failed to get user details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * PATCH /api/firm/users/[id] - Update user
 */
export const PATCH: APIRoute = async (context) => {
  const { locals, params, request } = context;
  const userId = params.id;

  // Check authentication
  if (!locals.isAuthenticated || !locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check permissions - only admins can update users
  const userRoles = locals.user.roles || [];
  const isAdmin = userRoles.includes('FirmAdmin') || userRoles.includes('firm:admin');
  
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: 'User ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const updates: UpdateUserRequest = await request.json();

    // Validate updates
    if (updates.role && !['firm:admin', 'firm:lawyer', 'firm:staff', 'firm:viewer'].includes(updates.role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize service
    const service = new UserManagementService(context, {
      id: locals.user.userId,
      email: locals.user.email,
      firmId: locals.user.firmId,
    });

    // Update user
    const user = await service.updateUser(userId, updates);

    return new Response(JSON.stringify({
      success: true,
      user,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to update user:', error);
    
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (error.message.includes('Cannot demote the last administrator')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ 
      error: 'Failed to update user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * DELETE /api/firm/users/[id] - Delete user
 */
export const DELETE: APIRoute = async (context) => {
  const { locals, params, request } = context;
  const userId = params.id;

  // Check authentication
  if (!locals.isAuthenticated || !locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check permissions - only admins can delete users
  const userRoles = locals.user.roles || [];
  const isAdmin = userRoles.includes('FirmAdmin') || userRoles.includes('firm:admin');
  
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: 'User ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Prevent self-deletion
  if (userId === locals.user.userId) {
    return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get deletion reason from body if provided
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // Body parsing failed, continue without reason
    }

    // Initialize service
    const service = new UserManagementService(context, {
      id: locals.user.userId,
      email: locals.user.email,
      firmId: locals.user.firmId,
    });

    // Delete user
    await service.deleteUser(userId, reason);

    return new Response(JSON.stringify({
      success: true,
      message: 'User deleted successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to delete user:', error);
    
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (error.message.includes('Cannot delete the last administrator')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ 
      error: 'Failed to delete user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};