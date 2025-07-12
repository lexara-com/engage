import type { APIRoute } from 'astro';
import { UserManagementService } from '../../../../../services/user-management-service';

/**
 * POST /api/firm/users/[id]/reset-password - Send password reset email
 */
export const POST: APIRoute = async (context) => {
  const { locals, params } = context;
  const userId = params.id;

  // Check authentication
  if (!locals.isAuthenticated || !locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check permissions - only admins can send password resets
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
    // Initialize service
    const service = new UserManagementService(context, {
      id: locals.user.userId,
      email: locals.user.email,
      firmId: locals.user.firmId,
    });

    // Send password reset
    const response = await service.sendPasswordReset(userId);

    return new Response(JSON.stringify({
      success: true,
      ...response,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to send password reset:', error);
    
    if (error instanceof Error && error.message === 'User not found') {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Failed to send password reset',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};