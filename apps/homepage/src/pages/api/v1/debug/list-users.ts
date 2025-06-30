/**
 * Debug endpoint to list all users in Auth0
 * This is temporary for debugging purposes
 */

import type { APIRoute } from 'astro';
import { createAuth0ManagementClient } from '../../../../utils/auth0-management.js';

export const GET: APIRoute = async (context) => {
  try {
    console.log('🔍 API: Listing all users for debug');
    
    // Create Auth0 client
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    
    const managementToken = await auth0Client.getAccessToken();
    
    // Get all users
    const response = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users?per_page=100`, {
      headers: {
        'Authorization': `Bearer ${managementToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list users: ${error}`);
    }
    
    const users = await response.json();
    
    // Return sanitized user info for debugging
    const sanitizedUsers = users.map(user => ({
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      email_verified: user.email_verified,
      created_at: user.created_at,
      last_login: user.last_login,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata
    }));
    
    console.log(`✅ Found ${users.length} total users`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        users: sanitizedUsers,
        total: users.length
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to list users:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'USER_LIST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to list users'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};