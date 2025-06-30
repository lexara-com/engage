/**
 * Debug endpoint to check specific user metadata
 */

import type { APIRoute } from 'astro';
import { createAuth0ManagementClient } from '../../../../utils/auth0-management.js';

export const GET: APIRoute = async (context) => {
  try {
    const url = new URL(context.request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Email parameter required' }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`🔍 Checking user: ${email}`);
    
    // Create Auth0 client
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    
    const managementToken = await auth0Client.getAccessToken();
    
    console.log(`Searching for email: "${email}"`);
    
    // Try multiple search strategies
    let users = [];
    
    // Strategy 1: Exact email with quotes and v3
    let searchResponse = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users?q=email:"${encodeURIComponent(email)}"&search_engine=v3`, {
      headers: {
        'Authorization': `Bearer ${managementToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (searchResponse.ok) {
      users = await searchResponse.json();
      console.log(`Strategy 1: Found ${users.length} users`);
    }
    
    // Strategy 2: Email without quotes
    if (users.length === 0) {
      searchResponse = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users?q=email:${encodeURIComponent(email)}&search_engine=v3`, {
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (searchResponse.ok) {
        users = await searchResponse.json();
        console.log(`Strategy 2: Found ${users.length} users`);
      }
    }
    
    // Strategy 3: Get all users and filter
    if (users.length === 0) {
      searchResponse = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users?per_page=100`, {
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (searchResponse.ok) {
        const allUsers = await searchResponse.json();
        users = allUsers.filter(user => user.email === email);
        console.log(`Strategy 3: Found ${users.length} users by filtering ${allUsers.length} total users`);
        
        // Log all emails for debugging
        console.log('All emails in system:', allUsers.map(u => u.email));
      }
    }
    
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: `User not found with email: ${email}` }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user = users[0];
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        email_verified: user.email_verified,
        created_at: user.created_at,
        last_login: user.last_login,
        user_metadata: user.user_metadata || {},
        app_metadata: user.app_metadata || {}
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to check user:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to check user'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};