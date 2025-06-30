/**
 * Debug endpoint to check Auth0 token and permission status
 */

import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  try {
    console.log('🔍 Debug: Checking auth status...');
    
    const authHeader = context.request.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        debug: {
          hasAuthHeader: false,
          error: 'No Authorization header found'
        }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        debug: {
          hasAuthHeader: true,
          authHeaderFormat: authHeader.substring(0, 20) + '...',
          error: 'Authorization header does not start with Bearer'
        }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.slice(7);
    
    // Try to decode the token (without verification for debugging)
    let tokenPayload = null;
    let tokenError = null;
    
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        tokenPayload = JSON.parse(atob(parts[1]));
      } else {
        tokenError = 'Token does not have 3 parts';
      }
    } catch (error) {
      tokenError = error instanceof Error ? error.message : 'Failed to decode token';
    }

    // Check environment variables
    const env = context.locals?.runtime?.env;
    const envDebug = {
      hasAuth0Domain: !!env?.AUTH0_DOMAIN,
      hasAuth0ClientId: !!env?.AUTH0_CLIENT_ID,
      hasAuth0ClientSecret: !!env?.AUTH0_CLIENT_SECRET,
      auth0Domain: env?.AUTH0_DOMAIN || 'Not set',
      auth0ClientId: env?.AUTH0_CLIENT_ID || 'Not set'
    };

    return new Response(JSON.stringify({
      success: true,
      debug: {
        hasAuthHeader: true,
        tokenLength: token.length,
        tokenPayload: tokenPayload ? {
          sub: tokenPayload.sub,
          aud: tokenPayload.aud,
          iss: tokenPayload.iss,
          exp: tokenPayload.exp,
          iat: tokenPayload.iat,
          hasMetadata: !!(tokenPayload.user_metadata || tokenPayload.app_metadata)
        } : null,
        tokenError,
        environment: envDebug,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Debug auth status failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      debug: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};