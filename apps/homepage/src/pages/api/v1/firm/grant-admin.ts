/**
 * Temporary Admin Grant API
 * 
 * This is a temporary endpoint to grant admin access to a user for testing purposes.
 * In production, this should be removed or secured with proper authentication.
 */

import type { APIRoute } from 'astro';
import { createAuth0ManagementClient } from '../../../../utils/auth0-management.js';
import { extractUserIdFromToken } from '../../../../utils/user-permissions.js';

export const POST: APIRoute = async (context) => {
  try {
    console.log('🔐 API: Granting admin access (TEMPORARY)');
    
    const requestData = await context.request.json();
    const { email, firmId } = requestData;
    
    if (!email || !firmId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'email and firmId are required'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Auth0 client
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    
    console.log(`🔐 Granting admin access to ${email} for firm ${firmId}`);

    // For now, let's create a simple method that directly makes the Auth0 API call
    const managementToken = await auth0Client.getAccessToken();
    
    // Try multiple search strategies to find the user
    let usersData = [];
    
    // Strategy 1: Exact email match with v3 search
    console.log('Searching for user with exact email match...');
    let searchResponse = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users?q=email:"${email}"&search_engine=v3`, {
      headers: {
        'Authorization': `Bearer ${managementToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (searchResponse.ok) {
      usersData = await searchResponse.json();
      console.log(`Found ${usersData.length} users with exact email match`);
    }
    
    // Strategy 2: If not found, try without quotes
    if (usersData.length === 0) {
      console.log('Trying email search without quotes...');
      searchResponse = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users?q=email:${email}&search_engine=v3`, {
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (searchResponse.ok) {
        usersData = await searchResponse.json();
        console.log(`Found ${usersData.length} users without quotes`);
      }
    }
    
    // Strategy 3: If still not found, try v2 search engine
    if (usersData.length === 0) {
      console.log('Trying v2 search engine...');
      searchResponse = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users?q=email:${email}&search_engine=v2`, {
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (searchResponse.ok) {
        usersData = await searchResponse.json();
        console.log(`Found ${usersData.length} users with v2 search`);
      }
    }
    
    // Strategy 4: If still not found, get all users and filter (for small datasets)
    if (usersData.length === 0) {
      console.log('Trying full user list filtering...');
      searchResponse = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users?per_page=100`, {
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (searchResponse.ok) {
        const allUsers = await searchResponse.json();
        usersData = allUsers.filter(user => user.email === email);
        console.log(`Found ${usersData.length} users by filtering ${allUsers.length} total users`);
        
        // Also log all emails for debugging
        console.log('All user emails found:', allUsers.map(u => u.email));
      }
    }
    
    if (!usersData || usersData.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found with that email address'
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = usersData[0];
    const userId = user.user_id;

    console.log('Current user data:', user);
    
    // Update user metadata to grant admin access
    const updatePayload = {
      user_metadata: {
        ...(user.user_metadata || {}),
        firmId: firmId,
        role: 'admin'
      },
      app_metadata: {
        ...(user.app_metadata || {}),
        organization: firmId,
        permissions: ['firm:admin']
      }
    };
    
    console.log('Update payload:', JSON.stringify(updatePayload, null, 2));
    
    const updateResponse = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${managementToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update user: ${error}`);
    }

    const updatedUser = await updateResponse.json();
    
    console.log(`✅ Admin access granted to ${email}`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        userId: userId,
        email: email,
        firmId: firmId,
        role: 'admin',
        message: 'Admin access granted successfully'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to grant admin access:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'ADMIN_GRANT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to grant admin access'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};