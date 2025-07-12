/**
 * Firm Portal Authentication Middleware
 * 
 * Uses proven Auth0 authentication pattern from test-site implementation:
 * - Client-side Auth0 SDK handles PKCE properly
 * - SessionStorage for return URL management  
 * - Simple cookie-based sessions
 * - Server-side route protection
 */

import { defineMiddleware } from 'astro/middleware';

interface User {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  firmId: string;
  exp: number;
  isAuthenticated: boolean;
}

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/firm/dashboard',
  '/firm/conversations', 
  '/firm/settings',
  '/firm/settings-new',
  '/firm/settings-old',
  '/firm/users'
];

// Routes that should skip authentication (public routes)
const PUBLIC_ROUTES = [
  '/firm/login',
  '/firm/signup', 
  '/firm/callback',
  '/firm/index',
  '/firm',
  '/',
  // API routes will be checked individually
];

/**
 * Check if a route requires authentication
 */
function isProtectedRoute(pathname: string): boolean {
  // Exact match for protected routes
  if (PROTECTED_ROUTES.includes(pathname)) {
    return true;
  }
  
  // Exact match for public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    return false;
  }
  
  // Check if any public route is a prefix of the current path
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return false;
  }
  
  // API routes under /api/firm/ require authentication
  if (pathname.startsWith('/api/firm/')) {
    return true;
  }
  
  // For any other /firm/ routes, require auth unless explicitly public
  if (pathname.startsWith('/firm/')) {
    return true;
  }
  
  return false;
}

/**
 * Check if request is for static assets
 */
function isStaticAsset(pathname: string): boolean {
  // Astro generated assets
  if (pathname.startsWith('/_astro/')) return true;
  
  // Public directory assets
  if (pathname.startsWith('/js/')) return true;
  if (pathname.startsWith('/css/')) return true;
  if (pathname.startsWith('/images/')) return true;
  if (pathname.startsWith('/fonts/')) return true;
  if (pathname.startsWith('/static/')) return true;
  
  // Specific static files
  if (pathname === '/favicon.svg') return true;
  if (pathname === '/lexara-logo.svg') return true;
  if (pathname === '/robots.txt') return true;
  if (pathname === '/sitemap.xml') return true;
  
  // File extensions that are static assets
  const staticExtensions = [
    '.js', '.mjs', '.css', '.svg', '.png', '.jpg', '.jpeg', 
    '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map'
  ];
  
  if (staticExtensions.some(ext => pathname.endsWith(ext))) return true;
  if (pathname.includes('/hoisted.')) return true;
  
  return false;
}

/**
 * Get session from cookie
 */
function getSessionFromCookie(request: Request): User | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    console.log('❌ No cookie header found');
    return null;
  }

  // Parse cookies more carefully
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const trimmed = cookie.trim();
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex > 0) {
      const name = trimmed.substring(0, equalIndex);
      const value = trimmed.substring(equalIndex + 1);
      cookies[name] = value;
    }
  });

  const sessionCookie = cookies['firm_session'];
  if (!sessionCookie) {
    console.log('❌ No firm_session cookie found. Available cookies:', Object.keys(cookies));
    return null;
  }

  try {
    // The session cookie is URL-encoded when set by document.cookie
    const decodedCookie = decodeURIComponent(sessionCookie);
    console.log('🔍 Decoded session cookie length:', decodedCookie.length);
    
    const sessionData = JSON.parse(decodedCookie);
    console.log('✅ Successfully parsed session for user:', sessionData.email);
    
    // Check if session is expired
    const now = Math.floor(Date.now() / 1000);
    if (sessionData.exp && sessionData.exp < now) {
      console.log('❌ Session expired:', new Date(sessionData.exp * 1000));
      return null;
    }

    // Validate session has required fields
    if (!sessionData.userId || !sessionData.email || !sessionData.isAuthenticated) {
      console.log('❌ Session missing required fields:', {
        hasUserId: !!sessionData.userId,
        hasEmail: !!sessionData.email,
        isAuthenticated: sessionData.isAuthenticated
      });
      return null;
    }

    console.log('✅ Valid session found for:', sessionData.email);
    return sessionData;
  } catch (error) {
    console.error('❌ Error parsing session cookie:', error);
    console.error('Cookie value (first 100 chars):', sessionCookie.substring(0, 100));
    return null;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, redirect } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  console.log(`🔍 Firm portal middleware checking: ${pathname}`);
  
  // Log cookie header for API routes
  if (pathname.startsWith('/api/')) {
    console.log(`📍 API Route - Cookie header:`, request.headers.get('cookie')?.substring(0, 100));
  }
  
  // Skip middleware for static assets
  if (isStaticAsset(pathname)) {
    console.log(`📁 Static asset, skipping auth: ${pathname}`);
    return next();
  }
  
  // Always check for session, even on public routes (for API access)
  const session = getSessionFromCookie(request);
  
  if (session) {
    console.log(`✅ Valid session found for user: ${session.email}`);
    
    // Add user context to Astro locals for pages to use
    context.locals.user = {
      id: session.userId,
      email: session.email,
      name: session.name,
      firmId: session.firmId,
      roles: session.roles || ['User']
    };
    
    context.locals.firm = {
      id: session.firmId
    };
    
    context.locals.isAuthenticated = true;
    context.locals.sessionExpiry = session.exp;
  } else {
    context.locals.isAuthenticated = false;
    context.locals.user = null;
    context.locals.firm = null;
  }
  
  // Skip authentication requirement for public routes
  if (!isProtectedRoute(pathname)) {
    console.log(`✅ Public route, allowing access: ${pathname}`);
    return next();
  }
  
  // For protected routes, enforce authentication
  if (!session) {
    console.log(`❌ No valid session found for protected route: ${pathname}`);
    
    // For API routes, return 401 instead of redirecting
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // For non-API routes, redirect to login
    const loginUrl = `/firm/login?returnTo=${encodeURIComponent(pathname + url.search)}`;
    return redirect(loginUrl);
  }
  
  console.log(`🔒 Protected route authenticated: ${pathname}`);
  return next();
});