/**
 * Astro Middleware for Authentication
 * This middleware runs on the Astro server and handles authentication before pages render
 */

import { defineMiddleware } from 'astro:middleware';

// Configuration - will be moved to environment variables
const AUTH0_DOMAIN = 'dev-sv0pf6cz2530xz0o.us.auth0.com';
const AUTH0_CLIENT_ID = 'nI1qZf7RIHMfJTTrQQoosfWu9d204apX';

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard'
];

// Public routes that should never be protected
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/callback'
];

/**
 * Check if a route requires authentication
 */
function isProtectedRoute(pathname: string): boolean {
  // Check exact matches first
  if (PROTECTED_ROUTES.includes(pathname)) {
    return true;
  }
  
  // Check if path starts with protected route
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route + '/'));
}

/**
 * Check if a route should always be public
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
}

/**
 * Check if request is for static assets
 */
function isStaticAsset(pathname: string): boolean {
  return pathname.startsWith('/_astro/') ||
         pathname.startsWith('/_image') ||
         pathname.endsWith('.js') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.jpeg') ||
         pathname.endsWith('.ico') ||
         pathname.endsWith('.gif') ||
         pathname.endsWith('.webp') ||
         pathname.includes('favicon');
}

/**
 * Get session from cookie
 */
function getSessionFromCookie(request: Request): any {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = value;
    }
  });
  
  const sessionCookie = cookies['test_session'];
  if (!sessionCookie) return null;
  
  try {
    const session = JSON.parse(decodeURIComponent(sessionCookie));
    
    // Check if session is expired
    if (session.exp && session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Failed to parse session cookie:', error);
    return null;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, redirect } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  console.log(`🔍 Astro middleware checking: ${pathname}`);
  
  // Skip middleware for static assets
  if (isStaticAsset(pathname)) {
    console.log(`📁 Static asset, skipping: ${pathname}`);
    return next();
  }
  
  // Skip authentication for public routes
  if (isPublicRoute(pathname)) {
    console.log(`✅ Public route, skipping auth: ${pathname}`);
    return next();
  }
  
  // Check if route requires protection
  if (isProtectedRoute(pathname)) {
    console.log(`🔒 Protected route, checking authentication: ${pathname}`);
    
    // Check for valid session
    const session = getSessionFromCookie(request);
    
    console.log(`🔍 Session check result:`, session ? 'Found session' : 'No session found');
    
    if (!session) {
      console.log(`❌ No valid session, redirecting to login: ${pathname}`);
      const loginUrl = `/login?returnTo=${encodeURIComponent(pathname + url.search)}`;
      return redirect(loginUrl);
    }
    
    console.log(`✅ Valid session found for user: ${session.email} (expires: ${new Date(session.exp * 1000).toISOString()})`);
    
    // Add user info to locals for use in pages
    context.locals.user = {
      id: session.userId,
      email: session.email,
      name: session.name
    };
  }
  
  // Continue to the requested resource
  return next();
});