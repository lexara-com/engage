import type { APIRoute } from 'astro';

// Test endpoint to debug authentication
export const GET: APIRoute = async ({ request, locals }) => {
  const cookieHeader = request.headers.get('cookie');
  
  // Parse cookies manually to compare
  const cookies: Record<string, string> = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const trimmed = cookie.trim();
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const name = trimmed.substring(0, equalIndex);
        const value = trimmed.substring(equalIndex + 1);
        cookies[name] = value;
      }
    });
  }
  
  let sessionData = null;
  if (cookies['firm_session']) {
    try {
      sessionData = JSON.parse(decodeURIComponent(cookies['firm_session']));
    } catch (e) {
      sessionData = { error: 'Failed to parse', message: e.message };
    }
  }
  
  return new Response(JSON.stringify({
    success: true,
    debug: {
      // Request info
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      
      // Cookie info
      hasCookieHeader: !!cookieHeader,
      cookieHeaderLength: cookieHeader?.length || 0,
      cookieNames: Object.keys(cookies),
      hasFirmSession: !!cookies['firm_session'],
      sessionData: sessionData,
      
      // Locals info
      localsIsAuthenticated: locals.isAuthenticated,
      localsUser: locals.user,
      localsFirm: locals.firm,
      
      // Timing
      timestamp: new Date().toISOString()
    }
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};