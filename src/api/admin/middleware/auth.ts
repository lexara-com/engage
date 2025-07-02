// Authentication middleware for Admin API

import { AdminEnv, AuthenticatedRequest } from '../types';
import { createLogger } from '@/utils/logger';
import jwt from '@tsndr/cloudflare-worker-jwt';

export async function handleAuth(request: Request, env: AdminEnv): Promise<AuthenticatedRequest | Response> {
  const logger = createLogger(env, { operation: 'auth-middleware' });
  
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid authorization header');
      return unauthorizedResponse('Missing authorization token');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const isValid = await jwt.verify(token, env.AUTH0_DOMAIN, {
      audience: env.AUTH0_AUDIENCE,
      throwError: false
    });

    if (!isValid) {
      logger.warn('Invalid JWT token');
      return unauthorizedResponse('Invalid token');
    }

    // Decode token to get user info
    const decoded = jwt.decode(token);
    
    // Extract user data from token
    const userSub = decoded.payload?.sub as string;
    const userEmail = decoded.payload?.email as string;
    const userPermissions = decoded.payload?.permissions as string[] || [];
    
    // Get user's firm and role from token metadata or custom claims
    // This would typically come from Auth0 app_metadata or custom claims
    const firmId = decoded.payload?.['https://engage.lexara.com/firm_id'] as string;
    const userRole = decoded.payload?.['https://engage.lexara.com/role'] as string || 'staff';

    if (!firmId) {
      logger.warn('User does not have firm assignment', { userSub });
      return forbiddenResponse('User not assigned to a firm');
    }

    // Validate role
    const validRoles = ['admin', 'attorney', 'staff'];
    if (!validRoles.includes(userRole)) {
      logger.warn('Invalid user role', { userSub, userRole });
      return forbiddenResponse('Invalid user role');
    }

    // Create authenticated request with user context
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = {
      sub: userSub,
      firmId,
      role: userRole as 'admin' | 'attorney' | 'staff',
      email: userEmail,
      permissions: userPermissions
    };

    logger.info('User authenticated', {
      userSub,
      firmId,
      role: userRole,
      email: userEmail
    });

    return authenticatedRequest;

  } catch (error) {
    logger.error('Authentication error', error as Error);
    return unauthorizedResponse('Authentication failed');
  }
}

function unauthorizedResponse(message: string): Response {
  return new Response(JSON.stringify({
    error: {
      code: 'UNAUTHORIZED',
      message
    }
  }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer'
    }
  });
}

function forbiddenResponse(message: string): Response {
  return new Response(JSON.stringify({
    error: {
      code: 'FORBIDDEN',
      message
    }
  }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Helper to check if user has required permission
export function hasPermission(user: AuthenticatedRequest['user'], permission: string): boolean {
  if (!user) return false;
  
  // Admins have all permissions
  if (user.role === 'admin') return true;
  
  // Check specific permissions
  return user.permissions.includes(permission);
}

// Helper to ensure user can only access their own firm's data
export function validateFirmAccess(user: AuthenticatedRequest['user'], firmId: string): boolean {
  if (!user) return false;
  
  // System admins can access any firm
  if (user.role === 'admin' && user.permissions.includes('system:admin')) {
    return true;
  }
  
  // Otherwise, user can only access their own firm
  return user.firmId === firmId;
}