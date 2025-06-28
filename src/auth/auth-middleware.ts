// Authentication & Authorization Middleware - Implementation Template
// This file shows how Auth0 integration will be implemented

/// <reference types="@cloudflare/workers-types" />

import { Env } from '@/types/shared';
import { createLogger } from '@/utils/logger';
import { EngageError } from '@/utils/errors';

// Auth context types
export interface AuthContext {
  userId: string;
  userType: 'lexara_admin' | 'firm_admin' | 'firm_user' | 'client';
  firmId?: string;
  firmSlug?: string;
  roles: string[];
  permissions: string[];
  orgId: string;
  email?: string;
  name?: string;
}

export interface JWTPayload {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  'https://lexara.app/user_type': string;
  'https://lexara.app/firm_id'?: string;
  'https://lexara.app/firm_slug'?: string;
  'https://lexara.app/org_id': string;
  'https://lexara.app/roles': string[];
  'https://lexara.app/permissions': string[];
  email?: string;
  name?: string;
}

// Permission definitions
export const FIRM_PERMISSIONS = {
  'firm:admin': {
    canManageUsers: true,
    canManageConflicts: true,
    canViewAnalytics: true,
    canManageBilling: true,
    canManageBranding: true,
    canViewConversations: true,
    canDeleteConversations: true
  },
  'firm:lawyer': {
    canManageUsers: false,
    canManageConflicts: true,
    canViewAnalytics: true,
    canManageBilling: false,
    canManageBranding: false,
    canViewConversations: true,
    canDeleteConversations: false
  },
  'firm:staff': {
    canManageUsers: false,
    canManageConflicts: true,
    canViewAnalytics: false,
    canManageBilling: false,
    canManageBranding: false,
    canViewConversations: true,
    canDeleteConversations: false
  },
  'firm:viewer': {
    canManageUsers: false,
    canManageConflicts: false,
    canViewAnalytics: true,
    canManageBilling: false,
    canManageBranding: false,
    canViewConversations: true,
    canDeleteConversations: false
  }
} as const;

export const PLATFORM_PERMISSIONS = {
  'platform:admin': {
    canManageAllFirms: true,
    canViewSystemAnalytics: true,
    canManageBilling: true,
    canAccessSupport: true
  },
  'platform:support': {
    canManageAllFirms: false,
    canViewSystemAnalytics: true,
    canManageBilling: false,
    canAccessSupport: true
  }
} as const;

// Extract Bearer token from Authorization header
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Cache for Auth0 JWKS to avoid repeated fetches
const jwksCache = new Map<string, { keys: any[], expiresAt: number }>();

// Fetch Auth0 JWKS (JSON Web Key Set)
async function fetchJWKS(auth0Domain: string): Promise<any[]> {
  const cacheKey = auth0Domain;
  const cached = jwksCache.get(cacheKey);
  
  // Return cached JWKS if still valid (cache for 1 hour)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.keys;
  }
  
  try {
    const jwksUrl = `https://${auth0Domain}/.well-known/jwks.json`;
    const response = await fetch(jwksUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.status} ${response.statusText}`);
    }
    
    const jwks = await response.json() as { keys?: any[] };
    const keys = jwks.keys || [];
    
    // Cache for 1 hour
    jwksCache.set(cacheKey, {
      keys,
      expiresAt: Date.now() + 60 * 60 * 1000
    });
    
    return keys;
  } catch (error) {
    throw new Error(`JWKS fetch failed: ${(error as Error).message}`);
  }
}

// Find the correct JWK for token verification
function findJWK(keys: any[], kid: string): any {
  const key = keys.find(k => k.kid === kid && k.use === 'sig' && k.kty === 'RSA');
  if (!key) {
    throw new Error(`No suitable JWK found for kid: ${kid}`);
  }
  return key;
}

// Convert JWK to crypto key for verification
async function jwkToCryptoKey(jwk: any): Promise<CryptoKey> {
  // Base64url decode the modulus and exponent
  const n = base64urlDecode(jwk.n);
  const e = base64urlDecode(jwk.e);
  
  // Import the RSA public key
  return await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'RSA',
      n: jwk.n,
      e: jwk.e,
      alg: 'RS256',
      use: 'sig'
    },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

// Base64url decode helper
function base64urlDecode(str: string): Uint8Array {
  // Add padding if needed
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  
  const bytes = new Uint8Array(
    atob(str).split('').map(c => c.charCodeAt(0))
  );
  return bytes;
}

// Decode JWT without verification (for header/payload inspection)
function decodeJWT(token: string): { header: any; payload: any; signature: string } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  
  try {
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { header, payload, signature: parts[2] };
  } catch (error) {
    throw new Error('Invalid JWT encoding');
  }
}

// Verify JWT token with Auth0 JWKS
export async function verifyJWT(token: string, auth0Domain: string): Promise<JWTPayload> {
  try {
    // Decode JWT to get header and payload
    const { header, payload } = decodeJWT(token);
    
    // Validate basic JWT structure
    if (!header.kid || !header.alg || header.alg !== 'RS256') {
      throw new Error('Invalid JWT header');
    }
    
    // Validate basic claims
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      throw new Error('JWT expired');
    }
    
    if (!payload.iss || !payload.iss.includes(auth0Domain)) {
      throw new Error('Invalid issuer');
    }
    
    if (!payload.sub) {
      throw new Error('Missing subject claim');
    }
    
    // Fetch JWKS and find the correct key
    const keys = await fetchJWKS(auth0Domain);
    const jwk = findJWK(keys, header.kid);
    const cryptoKey = await jwkToCryptoKey(jwk);
    
    // Verify signature
    const encodedHeader = token.split('.')[0];
    const encodedPayload = token.split('.')[1];
    const signature = base64urlDecode(token.split('.')[2]);
    const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    
    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signature,
      data
    );
    
    if (!isValid) {
      throw new Error('Invalid JWT signature');
    }
    
    // Return validated payload
    return payload as JWTPayload;
    
  } catch (error) {
    throw new Error(`JWT verification failed: ${(error as Error).message}`);
  }
}

// Validate JWT and extract auth context
export async function validateJWT(request: Request, env: Env): Promise<AuthContext | null> {
  const logger = createLogger(env, { operation: 'validateJWT' });
  
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }
  
  try {
    const decoded = await verifyJWT(token, env.AUTH0_DOMAIN || '');
    
    const authContext: AuthContext = {
      userId: decoded.sub,
      userType: decoded['https://lexara.app/user_type'] as any,
      firmId: decoded['https://lexara.app/firm_id'],
      firmSlug: decoded['https://lexara.app/firm_slug'],
      roles: decoded['https://lexara.app/roles'] || [],
      permissions: decoded['https://lexara.app/permissions'] || [],
      orgId: decoded['https://lexara.app/org_id'],
      email: decoded.email,
      name: decoded.name
    };
    
    logger.info('JWT validated successfully', {
      userId: authContext.userId,
      userType: authContext.userType,
      firmId: authContext.firmId,
      roles: authContext.roles
    });
    
    return authContext;
    
  } catch (error) {
    logger.warn('JWT validation failed', { error: (error as Error).message });
    return null;
  }
}

// Authorization guards
export function requireFirmAccess(requiredFirmId: string) {
  return (authContext: AuthContext): boolean => {
    // Platform admins can access any firm
    if (authContext.userType === 'lexara_admin') {
      return true;
    }
    
    // Users must belong to the required firm
    return authContext.firmId === requiredFirmId;
  };
}

export function requirePermission(permission: string) {
  return (authContext: AuthContext): boolean => {
    return authContext.permissions.includes(permission);
  };
}

export function requireRole(role: string) {
  return (authContext: AuthContext): boolean => {
    return authContext.roles.includes(role);
  };
}

export function requireUserType(userType: AuthContext['userType']) {
  return (authContext: AuthContext): boolean => {
    return authContext.userType === userType;
  };
}

// Check if user has specific firm permission
export function hasFirmPermission(authContext: AuthContext, permission: keyof typeof FIRM_PERMISSIONS['firm:admin']): boolean {
  // Platform admins have all permissions
  if (authContext.userType === 'lexara_admin') {
    return true;
  }
  
  // Check firm-specific permissions
  for (const role of authContext.roles) {
    if (role in FIRM_PERMISSIONS) {
      const rolePermissions = FIRM_PERMISSIONS[role as keyof typeof FIRM_PERMISSIONS];
      if (rolePermissions[permission]) {
        return true;
      }
    }
  }
  
  return false;
}

// Check if user has platform permission
export function hasPlatformPermission(authContext: AuthContext, permission: keyof typeof PLATFORM_PERMISSIONS['platform:admin']): boolean {
  if (authContext.userType !== 'lexara_admin') {
    return false;
  }
  
  for (const role of authContext.roles) {
    if (role in PLATFORM_PERMISSIONS) {
      const rolePermissions = PLATFORM_PERMISSIONS[role as keyof typeof PLATFORM_PERMISSIONS];
      if (rolePermissions[permission]) {
        return true;
      }
    }
  }
  
  return false;
}

// Middleware factory for API endpoints
export function createAuthMiddleware(options: {
  required?: boolean;
  firmId?: string;
  permission?: string;
  role?: string;
  userType?: AuthContext['userType'];
}) {
  return async (request: Request, env: Env): Promise<{ authContext?: AuthContext; error?: Response }> => {
    const authContext = await validateJWT(request, env);
    
    // If auth is required but not provided
    if (options.required && !authContext) {
      return {
        error: new Response(JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      };
    }
    
    // If we have auth context, check additional requirements
    if (authContext) {
      // Check firm access
      if (options.firmId && !requireFirmAccess(options.firmId)(authContext)) {
        return {
          error: new Response(JSON.stringify({
            error: 'FORBIDDEN',
            message: 'Access to this firm is not allowed'
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          })
        };
      }
      
      // Check permission
      if (options.permission && !requirePermission(options.permission)(authContext)) {
        return {
          error: new Response(JSON.stringify({
            error: 'FORBIDDEN',
            message: `Permission '${options.permission}' required`
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          })
        };
      }
      
      // Check role
      if (options.role && !requireRole(options.role)(authContext)) {
        return {
          error: new Response(JSON.stringify({
            error: 'FORBIDDEN',
            message: `Role '${options.role}' required`
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          })
        };
      }
      
      // Check user type
      if (options.userType && !requireUserType(options.userType)(authContext)) {
        return {
          error: new Response(JSON.stringify({
            error: 'FORBIDDEN',
            message: `User type '${options.userType}' required`
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          })
        };
      }
    }
    
    return { authContext };
  };
}

// Conversation access validation
export async function validateConversationAccess(
  sessionId: string,
  authContext: AuthContext | null,
  env: Env
): Promise<boolean> {
  // Get conversation context from Durable Object
  const conversationStub = env.CONVERSATION_SESSION.get(
    env.CONVERSATION_SESSION.idFromName(sessionId)
  );
  
  try {
    const response = await conversationStub.fetch(new Request('http://durable-object/context', {
      method: 'GET'
    }));
    
    if (!response.ok) {
      return false;
    }
    
    const conversationContext = await response.json() as {
      sessionId: string;
      userId: string;
      firmId: string;
      isSecured: boolean;
      allowedAuth0Users: string[];
    };
    
    // If conversation is not secured, anyone with session ID can access
    if (!conversationContext.isSecured) {
      return true;
    }
    
    // If conversation is secured, user must be authenticated and authorized
    if (!authContext) {
      return false;
    }
    
    // Check if user is in allowed list for this conversation
    if (!conversationContext.allowedAuth0Users.includes(authContext.userId)) {
      return false;
    }
    
    // For firm users, also check they belong to the same firm
    if (authContext.userType === 'firm_admin' || authContext.userType === 'firm_user') {
      return authContext.firmId === conversationContext.firmId;
    }
    
    // Platform admins can access any conversation
    if (authContext.userType === 'lexara_admin') {
      return true;
    }
    
    return true;
    
  } catch (error) {
    return false;
  }
}

// Helper to add auth context to request headers for Durable Object calls
export function addAuthHeaders(request: Request, authContext: AuthContext): Request {
  const headers = new Headers(request.headers);
  
  headers.set('x-auth0-user-id', authContext.userId);
  headers.set('x-user-email', authContext.email || '');
  headers.set('x-user-type', authContext.userType);
  headers.set('x-firm-id', authContext.firmId || '');
  headers.set('x-user-roles', JSON.stringify(authContext.roles));
  headers.set('x-user-permissions', JSON.stringify(authContext.permissions));
  
  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.body
  });
}