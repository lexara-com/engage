import type { APIRoute } from 'astro';
import { UserManagementService } from '../../../../services/user-management-service';

/**
 * GET /api/firm/users/stats - Get user statistics
 */
export const GET: APIRoute = async (context) => {
  const { locals } = context;

  // Check authentication
  if (!locals.isAuthenticated || !locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check permissions
  const userRoles = locals.user.roles || [];
  const canViewStats = userRoles.includes('FirmAdmin') || userRoles.includes('firm:admin');
  
  if (!canViewStats) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
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

    // Get stats
    const stats = await service.getUserStats();

    return new Response(JSON.stringify({
      success: true,
      stats,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to get user stats:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get user statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};