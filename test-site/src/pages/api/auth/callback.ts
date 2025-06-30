/**
 * Server-side Auth0 callback handler
 * This endpoint handles the Auth0 authorization code exchange
 */

import type { APIRoute } from 'astro';

const AUTH0_DOMAIN = 'dev-sv0pf6cz2530xz0o.us.auth0.com';
const AUTH0_CLIENT_ID = 'nI1qZf7RIHMfJTTrQQoosfWu9d204apX';
// Note: Client secret would come from environment variable in production
// const AUTH0_CLIENT_SECRET = import.meta.env.AUTH0_CLIENT_SECRET;

/**
 * Exchange Auth0 authorization code for tokens
 */
async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const tokenEndpoint = `https://${AUTH0_DOMAIN}/oauth/token`;
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: AUTH0_CLIENT_ID,
      // client_secret: AUTH0_CLIENT_SECRET,
      code: code,
      redirect_uri: redirectUri,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token exchange failed:', response.status, errorText);
    throw new Error(`Token exchange failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Get user info from Auth0
 */
async function getUserInfo(accessToken: string) {
  const userInfoEndpoint = `https://${AUTH0_DOMAIN}/userinfo`;
  
  const response = await fetch(userInfoEndpoint, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`User info request failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Create session cookie
 */
function createSessionCookie(userInfo: any, tokens: any) {
  const session = {
    userId: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    accessToken: tokens.access_token
  };
  
  return `test_session=${encodeURIComponent(JSON.stringify(session))}; HttpOnly; Secure; SameSite=Strict; Max-Age=${24 * 60 * 60}; Path=/`;
}

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  
  console.log('API Callback received:', { code: !!code, state: !!state, error });
  
  if (error) {
    console.error('Auth0 callback error:', error);
    return redirect(`/login?error=${encodeURIComponent(error)}`);
  }
  
  if (!code) {
    console.error('No authorization code in callback');
    return redirect('/login?error=missing_code');
  }
  
  try {
    // For SPA applications, we can use the client-side flow
    // This server-side handler is optional and could be used for additional security
    console.log('Redirecting to client-side callback handling');
    
    // Redirect to the client-side callback page with parameters intact
    return redirect(`/callback?code=${code}&state=${encodeURIComponent(state || '')}`);
    
    /* 
    // If using client secret (for confidential clients):
    const redirectUri = `${url.origin}/api/auth/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const userInfo = await getUserInfo(tokens.access_token);
    const sessionCookie = createSessionCookie(userInfo, tokens);
    
    // Redirect to original URL (from state) or default to dashboard
    const originalUrl = state ? decodeURIComponent(state) : '/dashboard';
    
    return new Response('Redirecting...', {
      status: 302,
      headers: {
        'Location': originalUrl,
        'Set-Cookie': sessionCookie
      }
    });
    */
    
  } catch (error) {
    console.error('Callback processing error:', error);
    return redirect('/login?error=callback_failed');
  }
};