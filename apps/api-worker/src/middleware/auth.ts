/**
 * Authentication Middleware
 * 
 * Handles Auth0 JWT validation and extracts firm context from the organization claim.
 * This middleware ensures all API requests are properly authenticated and scoped to a firm.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '@/api/api-worker';
import type { AuthenticatedFirm, AuthenticatedUser, RequestContext } from '@/types/api';
import { AuthenticationError, AuthorizationError } from '@/api/error-handler';
import { validateJWT } from '@lexara/auth-lib';
import { nanoid } from 'nanoid';

export const authMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  // Skip auth for health check and docs
  if (c.req.path === '/health' || c.req.path === '/docs' || c.req.path === '/api-docs.json') {
    return next();
  }
  
  // Extract JWT token
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid Authorization header');
  }
  
  const token = authHeader.slice(7); // Remove "Bearer " prefix
  
  try {
    // Validate JWT with Auth0
    const payload = await validateJWT(token, {
      domain: c.env.AUTH0_DOMAIN,
      audience: c.env.AUTH0_AUDIENCE
    });
    
    // Extract firm context from organization claim
    const firmId = payload.org;
    if (!firmId) {
      throw new AuthenticationError('No organization claim in JWT');
    }
    
    // Get firm details
    const firm = await getFirmContext(firmId, c.env);
    if (!firm) {
      throw new AuthorizationError('Firm not found or inactive');
    }
    
    // Get user details
    const user = await getUserContext(payload.sub, firmId, c.env);
    if (!user) {
      throw new AuthorizationError('User not found or inactive in firm');
    }
    
    // Create request context
    const requestContext: RequestContext = {
      requestId: nanoid(),
      timestamp: new Date().toISOString(),
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      userAgent: c.req.header('User-Agent') || 'unknown',
      firm,
      user
    };
    
    // Add context to Hono context
    c.set('requestId', requestContext.requestId);
    c.set('firm', firm);
    c.set('user', user);
    c.set('requestContext', requestContext);
    
    // Add request ID to response headers
    c.header('X-Request-ID', requestContext.requestId);
    
    await next();
    
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      throw error;
    }
    
    // JWT validation failed
    throw new AuthenticationError('Invalid or expired token');
  }
};

async function getFirmContext(firmId: string, env: Env): Promise<AuthenticatedFirm | null> {
  try {
    // Query firm registry (could be from D1 or Durable Object)
    const firmRegistryId = env.FIRM_REGISTRY.idFromName('global');
    const firmRegistry = env.FIRM_REGISTRY.get(firmRegistryId);
    
    const response = await firmRegistry.fetch(`https://firm-registry/firms/${firmId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const firmData = await response.json() as any;
    
    return {
      firmId: firmData.firmId,
      legalName: firmData.legalName,
      subscription: firmData.subscription,
      status: firmData.status,
      permissions: getFirmPermissions(firmData.subscription),
      rateLimit: getRateLimitConfig(firmData.subscription)
    };
    
  } catch (error) {
    console.error('Failed to get firm context:', error);
    return null;
  }
}

async function getUserContext(auth0UserId: string, firmId: string, env: Env): Promise<AuthenticatedUser | null> {
  try {
    // Query user from D1 index first (faster)
    const userQuery = await env.FIRM_INDEX_DB.prepare(`
      SELECT userId, email, name, role, status, lastLogin
      FROM user_index 
      WHERE firmId = ? AND auth0UserId = ? AND status = 'active'
    `).bind(firmId, auth0UserId).first();
    
    if (!userQuery) {
      return null;
    }
    
    return {
      userId: userQuery.userId as string,
      auth0UserId,
      email: userQuery.email as string,
      name: userQuery.name as string,
      role: userQuery.role as string,
      permissions: getUserPermissions(userQuery.role as string),
      lastLogin: userQuery.lastLogin as string | undefined
    };
    
  } catch (error) {
    console.error('Failed to get user context:', error);
    return null;
  }
}

function getFirmPermissions(subscription: string): string[] {
  // Base permissions by subscription tier
  const basePermissions = ['view_assigned_conversations', 'view_analytics'];
  
  switch (subscription) {
    case 'starter':
      return [...basePermissions, 'manage_conversations'];
    
    case 'professional':
      return [
        ...basePermissions,
        'view_all_conversations',
        'manage_conversations',
        'assign_conversations',
        'view_advanced_analytics',
        'manage_users'
      ];
    
    case 'enterprise':
      return [
        ...basePermissions,
        'view_all_conversations',
        'manage_conversations',
        'assign_conversations',
        'delete_conversations',
        'view_advanced_analytics',
        'manage_users',
        'manage_firm_settings',
        'view_audit_logs',
        'manage_conflicts',
        'export_data'
      ];
    
    default:
      return basePermissions;
  }
}

function getUserPermissions(role: string): string[] {
  // Role-based permissions (intersection with firm permissions)
  switch (role.toLowerCase()) {
    case 'managing_partner':
    case 'partner':
      return [
        'view_all_conversations',
        'manage_conversations',
        'assign_conversations',
        'delete_conversations',
        'view_advanced_analytics',
        'manage_users',
        'manage_firm_settings',
        'view_audit_logs',
        'manage_conflicts',
        'export_data'
      ];
    
    case 'senior_associate':
    case 'associate':
      return [
        'view_assigned_conversations',
        'manage_conversations',
        'view_analytics'
      ];
    
    case 'paralegal':
      return [
        'view_assigned_conversations',
        'manage_conversations',
        'view_analytics'
      ];
    
    case 'administrator':
      return [
        'view_all_conversations',
        'manage_users',
        'manage_firm_settings',
        'view_audit_logs',
        'export_data'
      ];
    
    case 'receptionist':
    case 'legal_assistant':
      return [
        'view_assigned_conversations'
      ];
    
    default:
      return ['view_assigned_conversations'];
  }
}

function getRateLimitConfig(subscription: string) {
  switch (subscription) {
    case 'starter':
      return {
        requestsPerMinute: 100,
        requestsPerHour: 2000,
        requestsPerDay: 10000,
        burstLimit: 20
      };
    
    case 'professional':
      return {
        requestsPerMinute: 500,
        requestsPerHour: 10000,
        requestsPerDay: 50000,
        burstLimit: 50
      };
    
    case 'enterprise':
      return {
        requestsPerMinute: 2000,
        requestsPerHour: 50000,
        requestsPerDay: 500000,
        burstLimit: 100
      };
    
    default:
      return {
        requestsPerMinute: 50,
        requestsPerHour: 1000,
        requestsPerDay: 5000,
        burstLimit: 10
      };
  }
}

/**
 * Permission checking helper
 */
export function requirePermissions(permissions: string[]): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const user = c.get('user') as AuthenticatedUser;
    const firm = c.get('firm') as AuthenticatedFirm;
    
    if (!user || !firm) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check if user has all required permissions
    const userPermissions = new Set([...user.permissions, ...firm.permissions]);
    const hasAllPermissions = permissions.every(permission => userPermissions.has(permission));
    
    if (!hasAllPermissions) {
      throw new AuthorizationError(`Required permissions: ${permissions.join(', ')}`);
    }
    
    await next();
  };
}

/**
 * Platform admin only middleware
 */
export const requirePlatformAdmin: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const user = c.get('user') as AuthenticatedUser;
  const firm = c.get('firm') as AuthenticatedFirm;
  
  // Check if this is a Lexara platform admin request
  if (firm.firmId !== 'lexara-platform' || !user.permissions.includes('platform_admin')) {
    throw new AuthorizationError('Platform admin access required');
  }
  
  await next();
};