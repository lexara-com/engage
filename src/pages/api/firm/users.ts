import type { APIRoute } from 'astro';
import { getD1Binding } from '../../../utils/get-d1-binding';

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
  const canViewUsers = userRoles.includes('FirmAdmin') || userRoles.includes('firm:admin');
  
  if (!canViewUsers) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const firmId = locals.user.firmId;
    if (!firmId) {
      return new Response(JSON.stringify({ error: 'Firm ID not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get D1 database binding
    const db = getD1Binding(context);
    
    if (!db) {
      console.error('D1 binding not found');
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch users for the firm
    const users = await db.prepare(`
      SELECT 
        id,
        firm_id,
        auth0_user_id,
        email,
        name,
        role,
        is_active,
        created_at,
        updated_at
      FROM firm_users
      WHERE firm_id = ?
      ORDER BY created_at DESC
    `).bind(firmId).all();

    return new Response(JSON.stringify({
      success: true,
      users: users.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to fetch users:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};