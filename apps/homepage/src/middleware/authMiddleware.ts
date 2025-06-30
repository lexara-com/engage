/**
 * Authentication Middleware - Enterprise Authorization System
 * 
 * Provides consistent authentication and authorization for all API endpoints.
 * Replaces scattered Auth0 Management API calls with centralized permission validation.
 */

import { PermissionService, PermissionError, type PermissionAction } from '../services/PermissionService.js';
import { createDatabaseClient } from '../db/client.js';
import type { User, Firm, UserPermissions } from '../db/types.js';

// Authentication context passed to API handlers
export interface AuthContext {
  user: User;
  firm: Firm;
  permissions: UserPermissions;
  isAuthenticated: true;
}

// Unauthenticated context
export interface UnauthenticatedContext {
  isAuthenticated: false;
  error: string;
}

// Combined context type
export type AuthenticationContext = AuthContext | UnauthenticatedContext;

// Configuration for the auth middleware
export interface AuthMiddlewareConfig {
  requiredPermission?: PermissionAction;
  resourceId?: string;
  allowUnauthenticated?: boolean;
}

/**
 * Extract Auth0 JWT token from request headers
 */
function extractAuth0Token(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.slice(7); // Remove 'Bearer ' prefix
}

/**
 * Extract user ID from Auth0 JWT token
 * In production, this should properly validate and decode the JWT
 * For now, we'll use a simple extraction method
 */
async function extractUserIdFromToken(token: string): Promise<string | null> {
  try {
    // This is a simplified token extraction
    // In production, use a proper JWT library to validate the token
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Main authentication middleware function
 */
export async function authMiddleware(
  request: Request,
  env: any, // Cloudflare environment
  config: AuthMiddlewareConfig = {}
): Promise<AuthenticationContext> {
  
  const { requiredPermission, resourceId, allowUnauthenticated = false } = config;

  try {
    // Extract token from request
    const token = extractAuth0Token(request);
    if (!token) {
      if (allowUnauthenticated) {
        return { isAuthenticated: false, error: 'No token provided' };
      }
      throw new PermissionError('NO_TOKEN', 'Authentication token required');
    }

    // Extract Auth0 user ID from token
    const auth0UserId = await extractUserIdFromToken(token);
    if (!auth0UserId) {
      throw new PermissionError('INVALID_TOKEN', 'Invalid authentication token');
    }

    // Initialize database and permission service
    const database = createDatabaseClient(env.DB);
    const permissionService = new PermissionService(database);

    // Get user from database using Auth0 ID
    const user = await database.getUserByAuth0Id(auth0UserId);
    if (!user) {
      throw new PermissionError('USER_NOT_FOUND', 'User not found in database');
    }

    // If specific permission is required, validate it
    if (requiredPermission) {
      const permissionResult = await permissionService.validatePermission(
        user.id,
        requiredPermission,
        resourceId
      );

      if (!permissionResult.allowed) {
        throw new PermissionError(
          'PERMISSION_DENIED',
          permissionResult.reason || 'Permission denied',
          requiredPermission,
          resourceId
        );
      }
    }

    // Get firm information
    const firm = await database.getFirm(user.firm_id);
    if (!firm) {
      throw new PermissionError('FIRM_NOT_FOUND', 'Firm not found');
    }

    // Get user permissions
    const permissions = await permissionService.getUserPermissions(user);

    // Update last login time
    await database.updateUser(user.id, { 
      last_login: Math.floor(Date.now() / 1000) 
    });

    // Return authenticated context
    return {
      isAuthenticated: true,
      user,
      firm,
      permissions
    };

  } catch (error) {
    console.error('Authentication middleware error:', error);
    
    if (allowUnauthenticated) {
      return { 
        isAuthenticated: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      };
    }
    
    // Re-throw permission errors for proper handling
    if (error instanceof PermissionError) {
      throw error;
    }
    
    throw new PermissionError(
      'AUTH_ERROR',
      'Authentication failed',
      config.requiredPermission,
      config.resourceId
    );
  }
}

/**
 * Higher-order function to create API route handlers with authentication
 */
export function withAuth<T = any>(
  handler: (request: Request, context: AuthContext, env: any) => Promise<Response>,
  config: AuthMiddlewareConfig = {}
) {
  return async (request: Request, env: any): Promise<Response> => {
    try {
      const authContext = await authMiddleware(request, env, config);
      
      if (!authContext.isAuthenticated) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: authContext.error
          }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return await handler(request, authContext, env);
      
    } catch (error) {
      console.error('API handler error:', error);
      
      if (error instanceof PermissionError) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            action: error.action,
            resourceId: error.resourceId
          }
        }), {
          status: error.code === 'PERMISSION_DENIED' ? 403 : 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
}

/**
 * Create a simplified auth check for non-API routes
 */
export async function checkAuthentication(
  request: Request,
  env: any
): Promise<{ user: User; firm: Firm } | null> {
  try {
    const authContext = await authMiddleware(request, env, { allowUnauthenticated: true });
    
    if (!authContext.isAuthenticated) {
      return null;
    }
    
    return {
      user: authContext.user,
      firm: authContext.firm
    };
    
  } catch {
    return null;
  }
}

/**
 * Helper function to create standardized error responses
 */
export function createErrorResponse(
  error: PermissionError | Error,
  status: number = 500
): Response {
  const errorData = error instanceof PermissionError ? {
    code: error.code,
    message: error.message,
    action: error.action,
    resourceId: error.resourceId
  } : {
    code: 'INTERNAL_ERROR',
    message: error.message
  };

  return new Response(JSON.stringify({
    success: false,
    error: errorData
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Helper function to create standardized success responses
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): Response {
  return new Response(JSON.stringify({
    success: true,
    data,
    message
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Export types for use in API handlers
export type { AuthMiddlewareConfig, AuthContext };