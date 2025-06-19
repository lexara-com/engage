// JWT validation for Auth0 tokens in Cloudflare Workers
// Handles token validation and user context extraction

import { Env } from '@/types/shared';
import { createLogger } from '@/utils/logger';
import { validateSession } from './callback-handler';

// Logger will be initialized per-request with proper environment context

export interface AuthContext {
  user: {
    sub: string;
    email: string;
    name?: string;
    email_verified?: boolean;
  };
  roles: string[];
  permissions: Record<string, boolean>;
  firmId?: string;
  tokenType: 'jwt' | 'session';
  isValid: boolean;
}

/**
 * Validate Auth0 JWT token or session cookie
 */
export async function validateAuth0Token(token: string, env: Env): Promise<AuthContext | null> {
  const logger = createLogger(env, { service: 'jwt-validator', operation: 'validate-token' });
  
  try {
    // For development, we'll use session-based authentication instead of JWT validation
    // This is simpler and avoids complex JWT verification in workers
    
    logger.info('Validating Auth0 token/session');
    
    // Try JWT validation first (for API access tokens)
    if (token.includes('.')) {
      return await validateJWTToken(token, env);
    }
    
    // Fall back to session validation (not applicable here, but for completeness)
    return null;
    
  } catch (error) {
    logger.error('Token validation failed', { error: error.message });
    return null;
  }
}

/**
 * Validate JWT token (simplified version for demo)
 */
async function validateJWTToken(token: string, env: Env): Promise<AuthContext | null> {
  const logger = createLogger(env, { service: 'jwt-validator', operation: 'validate-jwt' });
  
  try {
    // In production, this would properly validate the JWT signature
    // For development, we'll do basic validation
    
    const [header, payload, signature] = token.split('.');
    
    if (!header || !payload || !signature) {
      throw new Error('Invalid JWT format');
    }

    // Decode payload
    const decodedPayload = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );

    // Basic validation
    const now = Math.floor(Date.now() / 1000);
    
    if (decodedPayload.exp && decodedPayload.exp < now) {
      throw new Error('Token expired');
    }

    // Extract user information and custom claims
    const roles = decodedPayload['https://engage.lexara.app/roles'] || [];
    const firmId = decodedPayload['https://engage.lexara.app/firm_id'];
    const permissions = decodedPayload['https://engage.lexara.app/permissions'] || [];

    // Convert permissions array to boolean map
    const permissionMap: Record<string, boolean> = {};
    permissions.forEach((permission: string) => {
      permissionMap[permission] = true;
    });

    return {
      user: {
        sub: decodedPayload.sub,
        email: decodedPayload.email || decodedPayload.sub,
        name: decodedPayload.name,
        email_verified: decodedPayload.email_verified
      },
      roles,
      permissions: permissionMap,
      firmId,
      tokenType: 'jwt',
      isValid: true
    };
    
  } catch (error) {
    logger.error('JWT validation failed', { error: error.message });
    return null;
  }
}

/**
 * Validate session-based authentication using cookies
 */
export function validateSessionAuth(request: Request): AuthContext | null {
  try {
    const sessionData = validateSession(request);
    
    if (!sessionData.valid || !sessionData.user) {
      return null;
    }

    const user = sessionData.user;
    const roles = user['https://engage.lexara.app/roles'] || [];
    const firmId = user['https://engage.lexara.app/firm_id'];

    // Generate permissions based on roles
    const permissions = generatePermissionsFromRoles(roles);

    return {
      user: {
        sub: user.sub,
        email: user.email,
        name: user.name,
        email_verified: user.email_verified
      },
      roles,
      permissions,
      firmId,
      tokenType: 'session',
      isValid: true
    };
    
  } catch (error) {
    console.error('Session validation failed:', error);
    return null;
  }
}

/**
 * Generate permissions map from user roles
 */
function generatePermissionsFromRoles(roles: string[]): Record<string, boolean> {
  const permissions: Record<string, boolean> = {};

  roles.forEach(role => {
    switch (role) {
      case 'super_admin':
        permissions['canManageFirm'] = true;
        permissions['canViewConversations'] = true;
        permissions['canManageUsers'] = true;
        permissions['canViewAnalytics'] = true;
        permissions['canManageSettings'] = true;
        permissions['canManageConflicts'] = true;
        permissions['canDeleteConversations'] = true;
        break;
        
      case 'firm_admin':
        permissions['canManageFirm'] = true;
        permissions['canViewConversations'] = true;
        permissions['canManageUsers'] = true;
        permissions['canViewAnalytics'] = true;
        permissions['canManageConflicts'] = true;
        permissions['canDeleteConversations'] = true;
        break;
        
      case 'firm_user':
        permissions['canViewConversations'] = true;
        permissions['canViewAnalytics'] = true;
        break;
        
      case 'lawyer':
        permissions['canViewConversations'] = true;
        permissions['canManageConflicts'] = true;
        break;
    }
  });

  return permissions;
}

/**
 * Check if auth context has specific permission
 */
export function hasPermission(context: AuthContext, permission: string): boolean {
  return context.permissions[permission] === true;
}

/**
 * Check if auth context has specific role
 */
export function hasRole(context: AuthContext, role: string): boolean {
  return context.roles.includes(role);
}

/**
 * Check if user can access specific firm
 */
export function canAccessFirm(context: AuthContext, firmId: string): boolean {
  // Super admins can access any firm
  if (hasRole(context, 'super_admin')) {
    return true;
  }
  
  // Other users can only access their own firm
  return context.firmId === firmId;
}

/**
 * Extract Auth context from request (JWT or session)
 */
export async function extractAuthContext(request: Request, env: Env): Promise<AuthContext | null> {
  // Try JWT from Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtContext = await validateAuth0Token(token, env);
    if (jwtContext) {
      return jwtContext;
    }
  }
  
  // Fall back to session-based authentication
  return validateSessionAuth(request);
}

/**
 * Create mock admin context for development/testing
 */
export function createMockAdminContext(role: 'super_admin' | 'firm_admin' | 'firm_user' = 'super_admin'): AuthContext {
  const roles = [role];
  const permissions = generatePermissionsFromRoles(roles);
  
  return {
    user: {
      sub: 'auth0|mock-admin-123',
      email: 'admin@lexara.app',
      name: 'Mock Admin User',
      email_verified: true
    },
    roles,
    permissions,
    firmId: role === 'super_admin' ? undefined : 'demo-firm-123',
    tokenType: 'session',
    isValid: true
  };
}