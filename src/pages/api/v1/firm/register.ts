import type { APIRoute } from 'astro';
import { getD1Binding } from '../../../../utils/get-d1-binding';
import { createAuth0ManagementClient } from '../../../../utils/auth0-management-client';

export const POST: APIRoute = async (context) => {
  const { request } = context;

  try {
    const data = await request.json();
    const {
      firmName,
      firmSize,
      practiceAreas,
      firstName,
      lastName,
      email,
      password,
      plan
    } = data;

    // Get D1 binding
    const db = getD1Binding(context);
    if (!db) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Database not configured' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if firm already exists
    const existingFirm = await db.prepare(
      'SELECT id FROM firms WHERE email = ?'
    ).bind(email).first();

    if (existingFirm) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'A firm with this email already exists' }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Auth0 user
    const auth0Client = createAuth0ManagementClient(context);
    let auth0User;
    
    try {
      auth0User = await auth0Client.createUser({
        email,
        password,
        email_verified: false,
        name: `${firstName} ${lastName}`,
        connection: 'Username-Password-Authentication',
        app_metadata: {
          firmId: null, // Will be updated after firm creation
          role: 'firm:admin'
        }
      });
    } catch (auth0Error: any) {
      console.error('Auth0 user creation failed:', auth0Error);
      return new Response(JSON.stringify({
        success: false,
        error: { 
          message: auth0Error.message || 'Failed to create user account',
          details: auth0Error.response?.data
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create firm in database
    const firmId = `firm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    try {
      await db.prepare(`
        INSERT INTO firms (
          id, name, email, subscription_tier, subscription_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        firmId,
        firmName,
        email,
        plan || 'trial',
        'active',
        now,
        now
      ).run();

      // Create firm user
      const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.prepare(`
        INSERT INTO firm_users (
          id, firm_id, auth0_user_id, email, name, role, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        firmId,
        auth0User.user_id,
        email,
        `${firstName} ${lastName}`,
        'firm:admin',
        1,
        now,
        now
      ).run();

      // Update Auth0 user with firmId
      await auth0Client.updateUser(auth0User.user_id, {
        app_metadata: {
          firmId,
          role: 'firm:admin'
        }
      });

      // Send verification email
      try {
        await auth0Client.sendVerificationEmail(auth0User.user_id);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Continue - user can request verification email later
      }

      return new Response(JSON.stringify({
        success: true,
        firm: {
          id: firmId,
          name: firmName
        },
        user: {
          id: userId,
          email
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError: any) {
      console.error('Database operation failed:', dbError);
      
      // Try to clean up Auth0 user if database operation failed
      try {
        await auth0Client.deleteUser(auth0User.user_id);
      } catch (cleanupError) {
        console.error('Failed to cleanup Auth0 user:', cleanupError);
      }

      return new Response(JSON.stringify({
        success: false,
        error: { 
          message: 'Failed to create firm',
          details: dbError.message
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('Registration error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { 
        message: error.message || 'Registration failed',
        details: error.toString()
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};