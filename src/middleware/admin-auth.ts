import type { MiddlewareHandler } from 'astro';
import jwt from '@tsndr/cloudflare-worker-jwt';

export interface AdminUser {
  sub: string;
  email: string;
  firmId: string;
  role: 'admin' | 'attorney' | 'staff';
  permissions: string[];
}

export const adminAuth: MiddlewareHandler = async ({ request, locals, redirect }, next) => {
  // Skip auth for non-admin routes
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/admin')) {
    return next();
  }

  // Allow access to login page
  if (url.pathname === '/admin/login') {
    return next();
  }

  // Check for JWT token in cookie or Authorization header
  const cookies = request.headers.get('cookie');
  const authHeader = request.headers.get('authorization');
  
  let token: string | null = null;
  
  // Try to get token from cookie first
  if (cookies) {
    const match = cookies.match(/admin_token=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }
  
  // Fall back to Authorization header
  if (!token && authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  if (!token) {
    return redirect('/admin/login?redirect=' + encodeURIComponent(url.pathname));
  }

  try {
    // Verify JWT token
    // In production, these would come from environment variables
    const AUTH0_DOMAIN = import.meta.env.AUTH0_DOMAIN || 'your-tenant.auth0.com';
    const AUTH0_AUDIENCE = import.meta.env.AUTH0_AUDIENCE || 'https://api.engage.lexara.com';
    
    // For development, allow a test token
    if (import.meta.env.DEV && token === 'test-token') {
      locals.user = {
        sub: 'test-user',
        email: 'admin@lawfirm.com',
        firmId: 'test-firm-id',
        role: 'admin',
        permissions: ['read:conversations', 'write:conversations', 'delete:conversations']
      } as AdminUser;
      return next();
    }
    
    // Verify real JWT token
    const isValid = await jwt.verify(token, import.meta.env.AUTH0_SECRET || 'secret');
    
    if (!isValid) {
      return redirect('/admin/login?error=invalid_token');
    }
    
    // Decode token to get user info
    const payload = jwt.decode(token);
    
    // Extract user information from token
    locals.user = {
      sub: payload.sub as string,
      email: payload.email as string,
      firmId: payload['https://engage.lexara.com/firmId'] as string || 'test-firm-id',
      role: payload['https://engage.lexara.com/role'] as 'admin' | 'attorney' | 'staff' || 'staff',
      permissions: payload.permissions as string[] || []
    } as AdminUser;
    
    // Verify user has access to their firm
    const requestedFirmId = url.pathname.match(/\/firms\/([^\/]+)/)?.[1];
    if (requestedFirmId && requestedFirmId !== locals.user.firmId && locals.user.role !== 'admin') {
      return redirect('/admin/unauthorized');
    }
    
  } catch (error) {
    console.error('Auth error:', error);
    return redirect('/admin/login?error=auth_failed');
  }

  return next();
};

// Helper function to check permissions
export function hasPermission(user: AdminUser | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true; // Admins have all permissions
  return user.permissions.includes(permission);
}

// Helper function to require permission
export function requirePermission(user: AdminUser | undefined, permission: string): void {
  if (!hasPermission(user, permission)) {
    throw new Error(`Unauthorized: Missing permission ${permission}`);
  }
}