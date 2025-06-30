/**
 * Debug endpoint to test token parsing without Auth0 dependencies
 */

import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  try {
    console.log('🔍 Token Test Debug Endpoint');
    
    const authHeader = context.request.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        debug: { error: 'No Authorization header' }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        debug: { 
          error: 'Authorization header does not start with Bearer',
          authHeader: authHeader.substring(0, 20) + '...'
        }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const token = authHeader.slice(7);
    const parts = token.split('.');
    
    let tokenInfo = {
      tokenLength: token.length,
      partCount: parts.length,
      isJWE: parts.length === 5,
      isJWT: parts.length === 3,
      firstPart: parts[0] ? parts[0].substring(0, 20) + '...' : 'none'
    };
    
    let decodedInfo = null;
    
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1]));
        decodedInfo = {
          sub: payload.sub,
          aud: payload.aud,
          iss: payload.iss,
          exp: payload.exp,
          iat: payload.iat
        };
      } catch (decodeError) {
        decodedInfo = { error: 'Failed to decode JWT payload' };
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      debug: {
        tokenInfo,
        decodedInfo,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Token test failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      debug: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack',
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};