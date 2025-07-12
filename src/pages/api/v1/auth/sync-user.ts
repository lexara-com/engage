import type { APIRoute } from 'astro';
import { getD1Binding } from '../../../../utils/get-d1-binding';
import { createAuth0ManagementClient } from '../../../../utils/auth0-management-client';

export const POST: APIRoute = async (context) => {
  const { request } = context;

  try {
    const data = await request.json();
    const { 
      email, 
      auth0UserId,
      firmName,
      firstName,
      lastName,
      plan = 'professional'
    } = data;

    if (!email || !auth0UserId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: email and auth0UserId'
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

    console.log('Syncing user:', { email, auth0UserId, firmName });

    // Check if user already exists
    const existingUser = await db.prepare(
      'SELECT id, firm_id FROM firm_users WHERE auth0_user_id = ? OR email = ?'
    ).bind(auth0UserId, email).first();

    if (existingUser) {
      console.log('User already exists:', existingUser);
      return new Response(JSON.stringify({
        success: true,
        message: 'User already exists',
        user: existingUser
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if firm exists
    let firm = await db.prepare(
      'SELECT id, name FROM firms WHERE email = ?'
    ).bind(email).first();

    const now = new Date().toISOString();
    let firmId;

    if (!firm) {
      // Create new firm
      firmId = `firm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('Creating new firm:', { firmId, firmName, email });

      await db.prepare(`
        INSERT INTO firms (
          id, name, email, subscription_tier, subscription_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        firmId,
        firmName || `${firstName} ${lastName} Law Firm`,
        email,
        plan,
        'active',
        now,
        now
      ).run();
    } else {
      firmId = firm.id;
      console.log('Using existing firm:', firmId);
    }

    // Create firm user
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('Creating firm user:', { userId, firmId, auth0UserId, email });

    await db.prepare(`
      INSERT INTO firm_users (
        id, firm_id, auth0_user_id, email, name, role, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      firmId,
      auth0UserId,
      email,
      `${firstName || 'Unknown'} ${lastName || 'User'}`,
      'admin', // Changed from 'firm:admin' to match DB constraint
      1,
      now,
      now
    ).run();

    // Update Auth0 user metadata
    try {
      const auth0Client = createAuth0ManagementClient(context);
      await auth0Client.updateUser(auth0UserId, {
        app_metadata: {
          firmId,
          role: 'firm:admin',
          roles: ['admin', 'firm:admin'] // Include both formats
        }
      });
      console.log('Updated Auth0 user metadata');
    } catch (auth0Error) {
      console.error('Failed to update Auth0 metadata:', auth0Error);
      // Continue - the user is already created in D1
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'User synced successfully',
      firm: {
        id: firmId,
        name: firmName || `${firstName} ${lastName} Law Firm`
      },
      user: {
        id: userId,
        email,
        firmId
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to sync user',
      details: error.toString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};