import type { APIRoute } from 'astro';
import { UserManagementService } from '../../../../services/user-management-service';
import type { UserListFilters } from '../../../../types/user-management';

/**
 * GET /api/firm/users - List users with pagination and filters
 */
export const GET: APIRoute = async (context) => {
  const { locals, url } = context;

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

  try {
    // Parse query parameters
    const searchParams = url.searchParams;
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    
    const filters: UserListFilters = {
      search: searchParams.get('search') || undefined,
      role: searchParams.get('role') as any || undefined,
      status: searchParams.get('status') as any || undefined,
      includeDeleted: searchParams.get('includeDeleted') === 'true',
    };

    // Initialize service
    const service = new UserManagementService(context, {
      id: locals.user.userId,
      email: locals.user.email,
      firmId: locals.user.firmId,
    });

    // Get users
    const response = await service.listUsers(filters, page, pageSize);

    return new Response(JSON.stringify({
      success: true,
      ...response,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to list users:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to list users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};