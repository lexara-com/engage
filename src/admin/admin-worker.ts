// Admin Worker - Main entry point for admin API requests
// Routes requests to appropriate services and handles authentication

/// <reference types="@cloudflare/workers-types" />

import { Env } from '@/types/shared';
import { createLogger } from '@/utils/logger';
import { AdminAPIService } from '@/services/admin-api';
import { 
  UnauthorizedAccessError,
  EngageError 
} from '@/utils/errors';
import { adminAuthMiddleware, createAuthResponse } from '@/auth/middleware';
import { AuthContext, validateSessionAuth } from '@/auth/jwt-validator';
import { handleAuth0Callback, generateLogoutUrl } from '@/auth/callback-handler';

// Logger will be initialized per-request with proper environment context

// Main admin worker implementation
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize logger with environment context
    const logger = createLogger(env, { service: 'admin-worker' });
    
    // Add CORS headers for admin interface (environment-specific)
    const corsOrigin = env.CORS_ORIGINS || 'https://lexara.app';
    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth0-User-ID, X-User-Email, X-User-Role, X-Firm-ID',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: corsHeaders 
      });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      logger.info('Admin API request', { 
        method, 
        path,
        userAgent: request.headers.get('user-agent'),
        origin: request.headers.get('origin')
      });

      // Health check endpoint
      if (method === 'GET' && path === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      }

      // Root admin page - show login or dashboard based on auth status
      if (method === 'GET' && (path === '/admin' || path === '/admin/')) {
        try {
          // Check if user is authenticated via session
          const authContext = validateSessionAuth(request);
          if (authContext && authContext.isValid) {
            // Show admin dashboard
            return new Response(getAdminDashboardHTML(authContext), {
              headers: { 
                'Content-Type': 'text/html; charset=utf-8',
                ...corsHeaders 
              }
            });
          }
        } catch {
          // Not authenticated, fall through to login page
        }
        
        // Show login page
        return new Response(getLoginPageHTML(env), {
          headers: { 
            'Content-Type': 'text/html; charset=utf-8',
            ...corsHeaders 
          }
        });
      }

      // Auth0 login redirect
      if (method === 'GET' && path === '/admin/auth/login') {
        const authUrl = getAuth0LoginUrl(env, request.url);
        return Response.redirect(authUrl, 302);
      }

      // Demo login endpoint (for development/testing)
      if (method === 'GET' && path === '/admin/auth/demo-login') {
        const mockUser = {
          sub: 'auth0|demo-user-123',
          email: 'admin@lexara.app',
          name: 'Demo Admin',
          'https://engage.lexara.app/roles': ['super_admin'],
          'https://engage.lexara.app/firm_id': 'demo-firm-123'
        };

        const sessionData = {
          user: mockUser,
          timestamp: Date.now(),
          expires: Date.now() + (8 * 60 * 60 * 1000) // 8 hours
        };

        const redirectResponse = Response.redirect('/admin', 302);
        const sessionCookie = btoa(JSON.stringify(sessionData));
        redirectResponse.headers.set('Set-Cookie', 
          `engage_admin_session=${sessionCookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`
        );

        logger.info('Demo login successful');
        return redirectResponse;
      }

      // Auth0 callback endpoint (no auth required) - support both paths
      if (method === 'GET' && (path === '/auth/callback' || path === '/admin/auth/callback')) {
        return handleAuth0Callback(request, env);
      }

      // Logout endpoint (no auth required)
      if (method === 'POST' && path === '/auth/logout') {
        const logoutUrl = generateLogoutUrl(env);
        return new Response(JSON.stringify({
          logoutUrl
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      }

      // Authentication middleware using Auth0 JWT validation
      const authResult = await adminAuthMiddleware(request, env);
      if (!authResult.valid) {
        return createAuthResponse(env, authResult);
      }

      // Route API requests with auth context
      let response: Response;
      const authContext = authResult.context!;

      // Firm management endpoints
      if (path.startsWith('/api/admin/firms')) {
        response = await routeFirmRequests(request, env, method, path, authContext);
      }
      // User management endpoints
      else if (path.includes('/users')) {
        response = await routeUserRequests(request, env, method, path, authContext);
      }
      // Configuration endpoints
      else if (path.includes('/configuration')) {
        response = await routeConfigurationRequests(request, env, method, path, authContext);
      }
      // Analytics endpoints
      else if (path.includes('/analytics')) {
        response = await routeAnalyticsRequests(request, env, method, path, authContext);
      }
      // Subscription endpoints
      else if (path.includes('/subscription')) {
        response = await routeSubscriptionRequests(request, env, method, path, authContext);
      }
      else {
        response = new Response(JSON.stringify({
          error: 'NOT_FOUND',
          message: 'Endpoint not found',
          availableEndpoints: [
            'POST /api/admin/firms - Register new firm',
            'GET /api/admin/firms/{id} - Get firm details',
            'PUT /api/admin/firms/{id} - Update firm',
            'GET /api/admin/firms/{id}/users - List users',
            'POST /api/admin/firms/{id}/users - Add user',
            'PUT /api/admin/firms/{id}/users/{userId} - Update user',
            'DELETE /api/admin/firms/{id}/users/{userId} - Remove user'
          ]
        }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add CORS headers to response
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });

    } catch (error) {
      const err = error as Error;
      logger.error('Admin worker error', { 
        errorMessage: err.message,
        stack: err.stack 
      });

      return new Response(JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
  }
};


// Firm management request routing
async function routeFirmRequests(
  request: Request, 
  env: Env, 
  method: string, 
  path: string,
  authContext: AuthContext
): Promise<Response> {
  
  // POST /api/admin/firms - Register new firm
  if (method === 'POST' && path === '/api/admin/firms') {
    const registryId = env.FIRM_REGISTRY.idFromName('global');
    const registry = env.FIRM_REGISTRY.get(registryId);
    return registry.fetch(new Request(`http://internal/register`, {
      method: 'POST',
      headers: request.headers,
      body: request.body
    }));
  }

  // GET /api/admin/firms/{firmId} - Get firm details  
  if (method === 'GET' && path.match(/^\/api\/admin\/firms\/[^\/]+$/)) {
    return AdminAPIService.getFirmDetails(request, env);
  }

  // PUT /api/admin/firms/{firmId} - Update firm
  if (method === 'PUT' && path.match(/^\/api\/admin\/firms\/[^\/]+$/)) {
    return AdminAPIService.updateFirm(request, env);
  }

  // DELETE /api/admin/firms/{firmId} - Deactivate firm (admin only)
  if (method === 'DELETE' && path.match(/^\/api\/admin\/firms\/[^\/]+$/)) {
    return deactivateFirm(request, env);
  }

  return new Response('Firm endpoint not found', { status: 404 });
}

// User management request routing
async function routeUserRequests(
  request: Request, 
  env: Env, 
  method: string, 
  path: string,
  authContext: AuthContext
): Promise<Response> {
  
  // GET /api/admin/firms/{firmId}/users - List users
  if (method === 'GET' && path.match(/^\/api\/admin\/firms\/[^\/]+\/users$/)) {
    return AdminAPIService.getFirmUsers(request, env);
  }

  // POST /api/admin/firms/{firmId}/users - Add user
  if (method === 'POST' && path.match(/^\/api\/admin\/firms\/[^\/]+\/users$/)) {
    return AdminAPIService.addFirmUser(request, env);
  }

  // PUT /api/admin/firms/{firmId}/users/{userId} - Update user
  if (method === 'PUT' && path.match(/^\/api\/admin\/firms\/[^\/]+\/users\/[^\/]+$/)) {
    return updateFirmUser(request, env);
  }

  // DELETE /api/admin/firms/{firmId}/users/{userId} - Remove user
  if (method === 'DELETE' && path.match(/^\/api\/admin\/firms\/[^\/]+\/users\/[^\/]+$/)) {
    return removeFirmUser(request, env);
  }

  return new Response('User endpoint not found', { status: 404 });
}

// Configuration request routing
async function routeConfigurationRequests(
  request: Request, 
  env: Env, 
  method: string, 
  path: string,
  authContext: AuthContext
): Promise<Response> {
  
  // TODO: Implement configuration endpoints
  return new Response(JSON.stringify({
    message: 'Configuration endpoints coming soon',
    requestedPath: path
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Analytics request routing
async function routeAnalyticsRequests(
  request: Request, 
  env: Env, 
  method: string, 
  path: string,
  authContext: AuthContext
): Promise<Response> {
  
  // TODO: Implement analytics endpoints
  return new Response(JSON.stringify({
    message: 'Analytics endpoints coming soon',
    requestedPath: path
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Subscription request routing
async function routeSubscriptionRequests(
  request: Request, 
  env: Env, 
  method: string, 
  path: string,
  authContext: AuthContext
): Promise<Response> {
  
  // TODO: Implement subscription endpoints
  return new Response(JSON.stringify({
    message: 'Subscription endpoints coming soon',
    requestedPath: path
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Placeholder implementations for additional endpoints
async function deactivateFirm(request: Request, env: Env): Promise<Response> {
  // TODO: Implement firm deactivation
  return new Response(JSON.stringify({
    message: 'Firm deactivation coming soon'
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function updateFirmUser(request: Request, env: Env): Promise<Response> {
  // TODO: Implement user update
  return new Response(JSON.stringify({
    message: 'User update coming soon'
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function removeFirmUser(request: Request, env: Env): Promise<Response> {
  // TODO: Implement user removal
  return new Response(JSON.stringify({
    message: 'User removal coming soon'
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Auth0 helper functions

function getAuth0LoginUrl(env: Env, currentUrl: string): string {
  const baseUrl = env.ADMIN_BASE_URL || 'https://admin-dev.lexara.app';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.AUTH0_CLIENT_ID,
    redirect_uri: `${baseUrl}/auth/callback`,
    scope: 'openid profile email',
    audience: env.AUTH0_AUDIENCE || 'https://api.dev.lexara.app',
    state: btoa(JSON.stringify({ returnTo: currentUrl }))
  });

  return `https://${env.AUTH0_DOMAIN}/authorize?${params.toString()}`;
}

function getLoginPageHTML(env: Env): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Engage Admin - Login</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css" rel="stylesheet">
  <style>
    body { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      min-height: 100vh; 
    }
    .login-card { 
      backdrop-filter: blur(10px); 
      background: rgba(255, 255, 255, 0.95); 
      border: none;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .brand-logo {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.5rem;
      margin: 0 auto;
    }
  </style>
</head>
<body class="d-flex align-items-center">
  <div class="container">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-4">
        <div class="card login-card">
          <div class="card-body p-5">
            <div class="text-center mb-4">
              <div class="brand-logo mb-3">
                <i class="bi bi-shield-check"></i>
              </div>
              <h2 class="fw-bold text-dark mb-2">Engage Admin</h2>
              <p class="text-muted">Secure Legal AI Administration</p>
            </div>
            
            <div class="d-grid gap-3">
              <a href="/admin/auth/login" class="btn btn-primary btn-lg d-flex align-items-center justify-content-center">
                <i class="bi bi-shield-lock me-2"></i>
                Login with Auth0
              </a>
              <a href="/admin/auth/demo-login" class="btn btn-outline-secondary btn-lg d-flex align-items-center justify-content-center">
                <i class="bi bi-play-circle me-2"></i>
                Demo Login
              </a>
            </div>
            
            <div class="text-center mt-4">
              <small class="text-muted">
                <i class="bi bi-shield-check text-success me-1"></i>
                Secure authentication powered by Auth0<br>
                Contact your administrator for access
              </small>
            </div>

            <div class="mt-4 pt-3 border-top">
              <div class="row text-center">
                <div class="col">
                  <small class="text-muted">
                    <i class="bi bi-building text-primary me-1"></i>
                    <strong>Multi-Tenant</strong><br>
                    Firm Isolation
                  </small>
                </div>
                <div class="col">
                  <small class="text-muted">
                    <i class="bi bi-shield-fill-check text-success me-1"></i>
                    <strong>HIPAA Ready</strong><br>
                    Compliant
                  </small>
                </div>
                <div class="col">
                  <small class="text-muted">
                    <i class="bi bi-graph-up text-info me-1"></i>
                    <strong>Analytics</strong><br>
                    Insights
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="text-center mt-3">
          <small class="text-white-50">
            Environment: ${env.ENVIRONMENT || 'development'} | Version: 1.0.0
          </small>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function getAdminDashboardHTML(authContext: AuthContext): string {
  const user = authContext.user;
  const roles = authContext.roles || [];
  const firmId = authContext.firmId;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Engage Admin Portal</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css" rel="stylesheet">
  <style>
    .navbar-brand { font-weight: bold; }
    .sidebar { 
      min-height: calc(100vh - 56px); 
      background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
      border-right: 1px solid #dee2e6;
    }
    .main-content { padding: 2rem; background: #f8f9fa; min-height: calc(100vh - 56px); }
    .stat-card { 
      transition: all 0.3s ease; 
      border: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-card:hover { 
      transform: translateY(-2px); 
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    .nav-link {
      border-radius: 8px;
      margin-bottom: 4px;
    }
    .nav-link:hover {
      background-color: rgba(13, 110, 253, 0.1);
    }
    .nav-link.active {
      background-color: #0d6efd;
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <!-- Navigation -->
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
    <div class="container-fluid">
      <a class="navbar-brand" href="/admin">
        <i class="bi bi-shield-check me-2"></i>Engage Admin
      </a>
      
      <div class="navbar-nav ms-auto">
        <div class="nav-item dropdown">
          <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown">
            <div class="user-avatar me-2">
              ${user.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <span>${user.name || user.email || 'Admin'}</span>
          </a>
          <ul class="dropdown-menu dropdown-menu-end">
            <li class="dropdown-header">
              <small class="text-muted">
                ${roles.includes('super_admin') ? '🔥 Super Admin' : roles.includes('firm_admin') ? '👑 Firm Admin' : '👤 User'}
                ${firmId ? '<br>Firm: ' + firmId : ''}
              </small>
            </li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item" href="/admin/profile">
              <i class="bi bi-person me-2"></i>Profile
            </a></li>
            <li><a class="dropdown-item" href="/admin/settings">
              <i class="bi bi-gear me-2"></i>Settings
            </a></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item" href="/auth/logout">
              <i class="bi bi-box-arrow-right me-2"></i>Logout
            </a></li>
          </ul>
        </div>
      </div>
    </div>
  </nav>

  <div class="container-fluid">
    <div class="row">
      <!-- Sidebar -->
      <div class="col-md-3 col-lg-2 sidebar">
        <div class="d-flex flex-column p-3">
          <ul class="nav nav-pills flex-column mb-auto">
            <li class="nav-item">
              <a href="/admin" class="nav-link active">
                <i class="bi bi-house me-2"></i>Dashboard
              </a>
            </li>
            ${roles.includes('super_admin') || roles.includes('firm_admin') ? 
            '<li class="nav-item"><a href="/admin/firms" class="nav-link"><i class="bi bi-building me-2"></i>Firms</a></li>' : ''}
            <li class="nav-item">
              <a href="/admin/conversations" class="nav-link">
                <i class="bi bi-chat-dots me-2"></i>Conversations
              </a>
            </li>
            <li class="nav-item">
              <a href="/admin/conflicts" class="nav-link">
                <i class="bi bi-exclamation-triangle me-2"></i>Conflicts
              </a>
            </li>
            <li class="nav-item">
              <a href="/admin/analytics" class="nav-link">
                <i class="bi bi-graph-up me-2"></i>Analytics
              </a>
            </li>
            ${roles.includes('super_admin') || roles.includes('firm_admin') ? 
            '<li class="nav-item"><a href="/admin/settings" class="nav-link"><i class="bi bi-gear me-2"></i>Settings</a></li>' : ''}
          </ul>
          
          <div class="mt-auto">
            <div class="text-center p-2">
              <small class="text-muted">
                <i class="bi bi-shield-check text-success"></i>
                Secure Session Active
              </small>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="col-md-9 col-lg-10 main-content">
        <div id="main-content">
          <!-- Dashboard Header -->
          <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h1 class="mb-1">Welcome back, ${user.name || 'Admin'}!</h1>
              <p class="text-muted mb-0">
                <i class="bi bi-calendar-check me-1"></i>
                ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div class="btn-group" role="group">
              <button type="button" class="btn btn-outline-primary" onclick="exportData()">
                <i class="bi bi-download me-1"></i>Export
              </button>
              ${roles.includes('super_admin') || roles.includes('firm_admin') ? 
              '<button type="button" class="btn btn-primary" onclick="showNewFirmModal()"><i class="bi bi-plus me-1"></i>New Firm</button>' : ''}
            </div>
          </div>

          <!-- Stats Cards -->
          <div class="row mb-4">
            <div class="col-md-3">
              <div class="card stat-card border-primary">
                <div class="card-body text-center">
                  <i class="bi bi-building fs-1 text-primary"></i>
                  <h5 class="card-title mt-2 mb-0">Active Firms</h5>
                  <h2 class="text-primary" id="active-firms">Loading...</h2>
                  <small class="text-muted">+2 this month</small>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card stat-card border-success">
                <div class="card-body text-center">
                  <i class="bi bi-chat-dots fs-1 text-success"></i>
                  <h5 class="card-title mt-2 mb-0">Conversations</h5>
                  <h2 class="text-success" id="total-conversations">Loading...</h2>
                  <small class="text-muted">+15% vs last week</small>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card stat-card border-warning">
                <div class="card-body text-center">
                  <i class="bi bi-exclamation-triangle fs-1 text-warning"></i>
                  <h5 class="card-title mt-2 mb-0">Conflicts</h5>
                  <h2 class="text-warning" id="total-conflicts">Loading...</h2>
                  <small class="text-muted">2 resolved today</small>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card stat-card border-info">
                <div class="card-body text-center">
                  <i class="bi bi-person-check fs-1 text-info"></i>
                  <h5 class="card-title mt-2 mb-0">Active Users</h5>
                  <h2 class="text-info" id="active-users">Loading...</h2>
                  <small class="text-muted">Online now</small>
                </div>
              </div>
            </div>
          </div>

          <!-- Main Dashboard Content -->
          <div class="row">
            <div class="col-md-8">
              <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">Recent Activity</h5>
                  <button class="btn btn-sm btn-outline-primary" onclick="refreshActivity()">
                    <i class="bi bi-arrow-clockwise"></i>
                  </button>
                </div>
                <div class="card-body">
                  <div class="table-responsive">
                    <table class="table table-hover">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Type</th>
                          <th>User/Firm</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody id="recent-activity">
                        <tr>
                          <td colspan="5" class="text-center text-muted">
                            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                            Loading recent activity...
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="col-md-4">
              <!-- System Status -->
              <div class="card mb-3">
                <div class="card-header">
                  <h5 class="mb-0">System Status</h5>
                </div>
                <div class="card-body">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span><i class="bi bi-cpu me-2"></i>API Health</span>
                    <span class="badge bg-success">Healthy</span>
                  </div>
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span><i class="bi bi-database me-2"></i>Database</span>
                    <span class="badge bg-success">Connected</span>
                  </div>
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span><i class="bi bi-shield-check me-2"></i>Auth Service</span>
                    <span class="badge bg-success">Online</span>
                  </div>
                  <div class="d-flex justify-content-between align-items-center">
                    <span><i class="bi bi-robot me-2"></i>AI Services</span>
                    <span class="badge bg-warning">Degraded</span>
                  </div>
                </div>
              </div>

              <!-- Quick Actions -->
              <div class="card">
                <div class="card-header">
                  <h5 class="mb-0">Quick Actions</h5>
                </div>
                <div class="card-body">
                  <div class="d-grid gap-2">
                    <button class="btn btn-outline-primary btn-sm" onclick="viewLogs()">
                      <i class="bi bi-file-text me-2"></i>View System Logs
                    </button>
                    <button class="btn btn-outline-success btn-sm" onclick="runHealthCheck()">
                      <i class="bi bi-heart-pulse me-2"></i>Run Health Check
                    </button>
                    <button class="btn btn-outline-info btn-sm" onclick="viewMetrics()">
                      <i class="bi bi-graph-up me-2"></i>View Metrics
                    </button>
                    ${roles.includes('super_admin') ? 
                    '<button class="btn btn-outline-warning btn-sm" onclick="systemMaintenance()"><i class="bi bi-tools me-2"></i>Maintenance Mode</button>' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // Load dashboard data
    async function loadDashboard() {
      try {
        const response = await fetch('/api/admin/dashboard');
        if (response.ok) {
          const data = await response.json();
          document.getElementById('active-firms').textContent = data.activeFirms || 0;
          document.getElementById('total-conversations').textContent = data.totalConversations || 0;
          document.getElementById('total-conflicts').textContent = data.totalConflicts || 0;
          document.getElementById('active-users').textContent = data.activeUsers || 0;
        } else {
          console.error('Failed to load dashboard data');
        }
      } catch (error) {
        console.error('Dashboard load error:', error);
      }
    }

    // Placeholder functions for UI interactions
    function exportData() { alert('Export functionality coming soon!'); }
    function showNewFirmModal() { alert('New firm creation coming soon!'); }
    function refreshActivity() { loadDashboard(); }
    function viewLogs() { alert('System logs viewer coming soon!'); }
    function runHealthCheck() { alert('Health check functionality coming soon!'); }
    function viewMetrics() { alert('Metrics dashboard coming soon!'); }
    function systemMaintenance() { alert('Maintenance mode coming soon!'); }

    // Load dashboard data on page load
    document.addEventListener('DOMContentLoaded', loadDashboard);
  </script>
</body>
</html>`;
}