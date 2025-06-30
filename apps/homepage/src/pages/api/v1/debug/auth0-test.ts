import type { APIRoute } from 'astro';
import { createAuth0ManagementClient } from '../../../../utils/auth0-management.js';

export const GET: APIRoute = async (context) => {
  try {
    console.log('🧪 Debug: Testing Auth0 Management API');
    
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    
    // Test API access and scopes
    const result = await auth0Client.testApiAccess();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Auth0 Management API test completed - check server logs for details',
      data: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Auth0 test failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'AUTH0_TEST_FAILED',
        message: error instanceof Error ? error.message : 'Auth0 test failed'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};