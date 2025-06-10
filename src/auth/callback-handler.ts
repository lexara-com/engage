// Auth0 callback handler for admin authentication
// Exchanges authorization code for tokens and handles user session

import { Env } from '@/types/shared';
import { createLogger } from '@/utils/logger';
import { EngageError } from '@/utils/errors';
import { parseAuthState } from './middleware';

const logger = createLogger('Auth0CallbackHandler');

interface Auth0TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface Auth0UserInfo {
  sub: string;
  email: string;
  name: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;
  email_verified?: boolean;
}

/**
 * Handle Auth0 authorization callback
 */
export async function handleAuth0Callback(
  request: Request,
  env: Env
): Promise<Response> {
  
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    // Handle authorization errors
    if (error) {
      const errorDescription = url.searchParams.get('error_description');
      logger.error('Auth0 authorization error', { error, errorDescription });
      
      return new Response(JSON.stringify({
        error: 'AUTHORIZATION_FAILED',
        message: errorDescription || error,
        redirectUrl: getErrorRedirectUrl(env)
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate required parameters
    if (!code) {
      return new Response(JSON.stringify({
        error: 'MISSING_CODE',
        message: 'Authorization code is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse state parameter for context
    const authState = parseAuthState(state);
    
    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, env);
    
    // Get user information
    const userInfo = await getUserInfo(tokens.access_token, env);
    
    // Create user session
    const sessionResult = await createUserSession(userInfo, tokens, authState, env);
    
    // Generate redirect URL with session
    const redirectUrl = generateSuccessRedirectUrl(sessionResult, authState, env);
    
    return new Response(JSON.stringify({
      success: true,
      redirectUrl,
      sessionId: sessionResult.sessionId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    logger.error('Auth0 callback error', { error: error.message, stack: error.stack });
    
    return new Response(JSON.stringify({
      error: 'CALLBACK_ERROR',
      message: 'Authentication callback failed',
      redirectUrl: getErrorRedirectUrl(env)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Exchange authorization code for access tokens
 */
async function exchangeCodeForTokens(
  code: string,
  env: Env
): Promise<Auth0TokenResponse> {
  
  const tokenEndpoint = `https://${env.AUTH0_DOMAIN}/oauth/token`;
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.AUTH0_CLIENT_ID!,
      client_secret: env.AUTH0_CLIENT_SECRET!,
      code,
      redirect_uri: getRedirectUri(env)
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new EngageError(
      `Token exchange failed: ${response.status} ${errorText}`,
      'TOKEN_EXCHANGE_FAILED',
      response.status
    );
  }
  
  return response.json() as Promise<Auth0TokenResponse>;
}

/**
 * Get user information from Auth0
 */
async function getUserInfo(
  accessToken: string,
  env: Env
): Promise<Auth0UserInfo> {
  
  const userInfoEndpoint = `https://${env.AUTH0_DOMAIN}/userinfo`;
  
  const response = await fetch(userInfoEndpoint, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new EngageError(
      `Failed to get user info: ${response.status}`,
      'USER_INFO_FAILED',
      response.status
    );
  }
  
  return response.json() as Promise<Auth0UserInfo>;
}

/**
 * Create user session after successful authentication
 */
async function createUserSession(
  userInfo: Auth0UserInfo,
  tokens: Auth0TokenResponse,
  authState: any,
  env: Env
): Promise<{ sessionId: string; expiresAt: Date }> {
  
  // For now, return a simple session
  // TODO: Store session in KV or Durable Object
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  
  logger.info('User session created', {
    sessionId,
    userId: userInfo.sub,
    email: userInfo.email,
    expiresAt
  });
  
  return { sessionId, expiresAt };
}

/**
 * Generate redirect URI based on environment
 */
function getRedirectUri(env: Env): string {
  const environment = env.ENVIRONMENT || 'development';
  
  switch (environment) {
    case 'production':
      return 'https://admin.lexara.app/auth/callback';
    case 'test':
      return 'https://admin-test.lexara.app/auth/callback';
    default:
      return 'https://admin-dev.lexara.app/auth/callback';
  }
}

/**
 * Generate success redirect URL
 */
function generateSuccessRedirectUrl(
  session: { sessionId: string; expiresAt: Date },
  authState: any,
  env: Env
): string {
  
  const environment = env.ENVIRONMENT || 'development';
  let baseUrl: string;
  
  switch (environment) {
    case 'production':
      baseUrl = 'https://admin.lexara.app';
      break;
    case 'test':
      baseUrl = 'https://admin-test.lexara.app';
      break;
    default:
      baseUrl = 'https://admin-dev.lexara.app';
      break;
  }
  
  const params = new URLSearchParams({
    session: session.sessionId
  });
  
  // Add firm context if available
  if (authState?.firmId) {
    params.set('firmId', authState.firmId);
  }
  
  return `${baseUrl}/dashboard?${params.toString()}`;
}

/**
 * Generate error redirect URL
 */
function getErrorRedirectUrl(env: Env): string {
  const environment = env.ENVIRONMENT || 'development';
  
  switch (environment) {
    case 'production':
      return 'https://admin.lexara.app/auth/error';
    case 'test':
      return 'https://admin-test.lexara.app/auth/error';
    default:
      return 'https://admin-dev.lexara.app/auth/error';
  }
}

/**
 * Generate logout URL
 */
export function generateLogoutUrl(env: Env): string {
  const returnTo = encodeURIComponent(getLogoutReturnUrl(env));
  
  return `https://${env.AUTH0_DOMAIN}/v2/logout?client_id=${env.AUTH0_CLIENT_ID}&returnTo=${returnTo}`;
}

/**
 * Get logout return URL
 */
function getLogoutReturnUrl(env: Env): string {
  const environment = env.ENVIRONMENT || 'development';
  
  switch (environment) {
    case 'production':
      return 'https://admin.lexara.app/';
    case 'test':
      return 'https://admin-test.lexara.app/';
    default:
      return 'https://admin-dev.lexara.app/';
  }
}