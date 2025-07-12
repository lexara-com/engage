import type { APIRoute } from 'astro';
import { getD1Binding } from '../../../../utils/get-d1-binding';

export const POST: APIRoute = async (context) => {
  const { request } = context;

  try {
    const data = await request.json();
    const { auth0UserId, email } = data;

    if (!auth0UserId && !email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing auth0UserId or email'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get D1 binding
    const db = getD1Binding(context);
    if (!db) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Database not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch user by auth0UserId or email
    let user;
    if (auth0UserId) {
      user = await db.prepare(`
        SELECT id, firm_id, auth0_user_id, email, name, role, is_active
        FROM firm_users
        WHERE auth0_user_id = ?
      `).bind(auth0UserId).first();
    }
    
    // If not found by auth0UserId, try by email
    if (!user && email) {
      user = await db.prepare(`
        SELECT id, firm_id, auth0_user_id, email, name, role, is_active
        FROM firm_users
        WHERE email = ?
      `).bind(email).first();
    }

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('User info error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fetch user info'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};