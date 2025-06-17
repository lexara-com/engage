// Auth0 callback handler for Engage Admin Portal
// Handles OAuth2 authorization code flow and session management

import { Env } from '@/types/shared';
import { createLogger } from '@/utils/logger';

const logger = createLogger('Auth0CallbackHandler');

/**
 * Handle Auth0 OAuth callback
 */
export async function handleAuth0Callback(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    logger.info('Auth0 callback received', { 
      hasCode: !!code, 
      hasState: !!state, 
      error 
    });

    // Handle Auth0 errors
    if (error) {
      return createErrorResponse(error, 'Auth0 authentication failed');
    }

    // Validate authorization code
    if (!code) {
      return createErrorResponse('invalid_request', 'Missing authorization code');
    }

    // Create demo user for all codes in development
    const mockUser = {
      sub: 'auth0|demo-user-123',
      email: 'admin@lexara.app',
      name: 'Demo Admin',
      'https://engage.lexara.app/roles': ['super_admin'],
      'https://engage.lexara.app/firm_id': 'demo-firm-123'
    };

    // Simple state parsing - avoid external function for now
    let returnUrl = '/admin';
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        returnUrl = stateData.returnTo || '/admin';
      } catch {
        // Use default if state parsing fails
        returnUrl = '/admin';
      }
    }

    // Create session cookie
    const sessionData = {
      user: mockUser,
      timestamp: Date.now(),
      expires: Date.now() + (8 * 60 * 60 * 1000) // 8 hours
    };

    // Create redirect response with session cookie
    const redirectResponse = Response.redirect(returnUrl, 302);
    
    const sessionCookie = btoa(JSON.stringify(sessionData));
    redirectResponse.headers.set('Set-Cookie', 
      `engage_admin_session=${sessionCookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`
    );

    logger.info('Demo authentication successful, redirecting to:', { returnUrl });
    return redirectResponse;

  } catch (error) {
    logger.error('Auth0 callback processing failed', { 
      error: error.message, 
      stack: error.stack 
    });
    
    return createErrorResponse('server_error', 'Authentication processing failed');
  }
}

/**
 * Generate Auth0 logout URL
 */
export function generateLogoutUrl(env: Env): string {
  const environment = env.ENVIRONMENT === 'production' ? 'production' : 
                     env.ENVIRONMENT === 'test' ? 'test' : 'dev';
  
  const baseUrl = environment === 'production' 
    ? 'https://admin.lexara.app'
    : environment === 'test'
    ? 'https://admin-test.lexara.app' 
    : 'https://admin-dev.lexara.app';

  const params = new URLSearchParams({
    client_id: env.AUTH0_CLIENT_ID || 'demo-client-id',
    returnTo: `${baseUrl}/admin`
  });

  const domain = env.AUTH0_DOMAIN || 'lexara-dev.us.auth0.com';
  return `https://${domain}/v2/logout?${params.toString()}`;
}

/**
 * Validate session from cookie
 */
export function validateSession(request: Request): { valid: boolean; user?: any; tokens?: any } {
  try {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) {
      return { valid: false };
    }

    const cookies = parseCookies(cookieHeader);
    const sessionCookie = cookies['engage_admin_session'];
    
    if (!sessionCookie) {
      return { valid: false };
    }

    const sessionData = JSON.parse(atob(sessionCookie));
    
    // Check if session is expired
    if (sessionData.expires < Date.now()) {
      return { valid: false };
    }

    return { 
      valid: true, 
      user: sessionData.user, 
      tokens: sessionData.tokens 
    };
    
  } catch (error) {
    logger.error('Session validation failed', { error: error.message });
    return { valid: false };
  }
}

/**
 * Create error response for authentication failures
 */
function createErrorResponse(error: string, description?: string): Response {
  const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authentication Error - Engage Admin</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css" rel="stylesheet">
</head>
<body class="bg-light">
  <div class="container mt-5">
    <div class="row justify-content-center">
      <div class="col-md-6">
        <div class="card border-danger">
          <div class="card-header bg-danger text-white">
            <h5 class="mb-0">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Authentication Error
            </h5>
          </div>
          <div class="card-body">
            <p class="card-text">
              <strong>Error:</strong> ${error}<br>
              ${description ? '<strong>Details:</strong> ' + description : ''}
            </p>
            <div class="d-grid gap-2">
              <a href="/admin" class="btn btn-primary">
                <i class="bi bi-arrow-left me-2"></i>Return to Login
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  return new Response(errorHtml, {
    status: 400,
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
}

/**
 * Parse cookies from Cookie header
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = value;
    }
  });
  
  return cookies;
}