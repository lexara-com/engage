// Authentication middleware for Engage platform
// Handles JWT validation and user authorization

import { Env } from '@/types/shared';
import { validateAuth0Token, AuthContext } from './jwt-validator';
import { UnauthorizedAccessError } from '@/utils/errors';

export interface AuthResult {
  valid: boolean;
  context?: AuthContext;
  error?: string;
  requiresAuth?: boolean;
}

export interface AuthOptions {
  required?: boolean;
  requiredRole?: string;
  requiredPermissions?: string[];
  allowAnonymous?: boolean;
}

/**
 * Main authentication middleware
 */
export async function authMiddleware(
  request: Request, 
  env: Env,
  options: AuthOptions = { required: true }
): Promise<AuthResult> {
  
  try {
    // Extract authorization header
    const authHeader = request.headers.get('authorization');
    
    // Handle missing auth header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (options.allowAnonymous || !options.required) {
        return { valid: true, requiresAuth: false };
      }
      
      return { 
        valid: false, 
        error: 'Missing authorization header',
        requiresAuth: true
      };
    }

    // Extract and validate token
    const token = authHeader.substring(7);
    const context = await validateAuth0Token(token, env);
    
    if (!context) {
      return { 
        valid: false, 
        error: 'Invalid or expired token',
        requiresAuth: true
      };
    }

    // Check role requirements
    if (options.requiredRole && !context.roles.includes(options.requiredRole)) {
      return {
        valid: false,
        error: `Insufficient role: required ${options.requiredRole}, has ${context.roles.join(', ') || 'none'}`
      };
    }

    // Check permission requirements
    if (options.requiredPermissions && context.permissions) {
      const hasAllPermissions = options.requiredPermissions.every(permission => 
        (context.permissions as any)[permission] === true
      );
      
      if (!hasAllPermissions) {
        return {
          valid: false,
          error: `Insufficient permissions: required ${options.requiredPermissions.join(', ')}`
        };
      }
    }
    
    return { valid: true, context };
    
  } catch (error) {
    return { 
      valid: false, 
      error: `Authentication error: ${error}`,
      requiresAuth: true
    };
  }
}

/**
 * Create authentication response for unauthorized requests
 */
export function createAuthResponse(
  env: Env, 
  authResult: AuthResult,
  firmId?: string
): Response {
  
  const loginUrl = generateLoginUrl(env, firmId);
  
  const responseBody = {
    error: 'AUTHENTICATION_REQUIRED',
    message: authResult.error || 'Authentication required',
    loginUrl,
    auth: {
      domain: env.AUTH0_DOMAIN,
      clientId: env.AUTH0_CLIENT_ID
    }
  };

  return new Response(JSON.stringify(responseBody), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getCorsOrigin(env),
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}

/**
 * Generate Auth0 login URL with state
 */
export function generateLoginUrl(env: Env, firmId?: string, sessionId?: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.AUTH0_CLIENT_ID!,
    redirect_uri: getRedirectUri(env),
    scope: 'openid profile email',
    audience: env.AUTH0_AUDIENCE || `https://${env.AUTH0_DOMAIN}/userinfo`
  });

  // Add state for firm context and session resumption
  if (firmId || sessionId) {
    const state = btoa(JSON.stringify({
      firmId,
      sessionId,
      timestamp: Date.now()
    }));
    params.set('state', state);
  }

  return `https://${env.AUTH0_DOMAIN}/authorize?${params.toString()}`;
}

/**
 * Parse state parameter from Auth0 callback
 */
export function parseAuthState(state?: string): { firmId?: string; sessionId?: string; timestamp?: number } | null {
  if (!state) return null;
  
  try {
    return JSON.parse(atob(state));
  } catch (error) {
    console.error('Failed to parse auth state:', error);
    return null;
  }
}

/**
 * Get redirect URI based on environment
 */
function getRedirectUri(env: Env): string {
  // Determine environment from AUTH0_DOMAIN
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
 * Get CORS origin based on environment
 */
function getCorsOrigin(env: Env): string {
  return env.CORS_ORIGINS || 'https://lexara.app';
}

/**
 * Admin-specific authentication middleware
 */
export async function adminAuthMiddleware(
  request: Request,
  env: Env
): Promise<AuthResult> {
  
  return authMiddleware(request, env, {
    required: true,
    requiredPermissions: ['canManageFirm'] // Basic admin permission
  });
}

/**
 * Lawyer authentication middleware (for accessing conversations)
 */
export async function lawyerAuthMiddleware(
  request: Request,
  env: Env
): Promise<AuthResult> {
  
  return authMiddleware(request, env, {
    required: true,
    requiredPermissions: ['canViewConversations']
  });
}

/**
 * Client intake authentication middleware (optional auth)
 */
export async function clientIntakeAuthMiddleware(
  request: Request,
  env: Env
): Promise<AuthResult> {
  
  return authMiddleware(request, env, {
    required: false,
    allowAnonymous: true
  });
}

/**
 * Require specific firm access
 */
export function requireFirmAccess(authContext: AuthContext, firmId: string): void {
  if (!authContext.firmId || authContext.firmId !== firmId) {
    throw new UnauthorizedAccessError(
      `Access denied: user belongs to firm ${authContext.firmId}, requested ${firmId}`
    );
  }
}

/**
 * Check if user has permission for action
 */
export function hasPermission(authContext: AuthContext, permission: string): boolean {
  if (!authContext.permissions) return false;
  return (authContext.permissions as any)[permission] === true;
}

/**
 * Require specific permission
 */
export function requirePermission(authContext: AuthContext, permission: string): void {
  if (!hasPermission(authContext, permission)) {
    throw new UnauthorizedAccessError(
      `Insufficient permissions: required ${permission}`
    );
  }
}

/**
 * Extract firm ID from request (header, query param, or URL)
 */
export function extractFirmId(request: Request): string | null {
  const url = new URL(request.url);
  
  // Check X-Firm-ID header
  const headerFirmId = request.headers.get('X-Firm-ID');
  if (headerFirmId) return headerFirmId;
  
  // Check firmId query parameter
  const queryFirmId = url.searchParams.get('firmId');
  if (queryFirmId) return queryFirmId;
  
  // Check URL path segments for firm ID
  const pathSegments = url.pathname.split('/').filter(Boolean);
  if (pathSegments.length >= 2 && pathSegments[0] === 'firms') {
    return pathSegments[1];
  }
  
  return null;
}

/**
 * Enhanced authentication middleware with firm context
 */
export async function firmAwareAuthMiddleware(
  request: Request,
  env: Env,
  options: AuthOptions = { required: true }
): Promise<AuthResult & { firmId?: string }> {
  
  const authResult = await authMiddleware(request, env, options);
  
  if (!authResult.valid || !authResult.context) {
    return authResult;
  }
  
  // Extract firm ID from request
  const requestedFirmId = extractFirmId(request);
  
  // Validate firm access if firm ID specified in request
  if (requestedFirmId && authResult.context.firmId) {
    if (authResult.context.firmId !== requestedFirmId) {
      return {
        valid: false,
        error: `Access denied: user belongs to different firm`
      };
    }
  }
  
  return {
    ...authResult,
    firmId: authResult.context.firmId || requestedFirmId || undefined
  };
}