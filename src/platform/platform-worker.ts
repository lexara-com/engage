// Platform Admin Worker - Enterprise-grade platform administration portal
// Security: Multi-layer authentication, audit logging, and access controls

/// <reference types="@cloudflare/workers-types" />

import { Env } from '@/types/shared';
import { createLogger } from '@/utils/logger';
import { PlatformAuthManager, PlatformAuthResult } from './auth/platform-auth-manager';
import { PlatformAuditLogger } from './audit/platform-audit-logger';
import { PlatformSecurityGuard, SecurityValidationResult } from './security/platform-security-guard';
import { AuthContext } from '@/auth/auth-middleware';

// Import and alias Durable Object classes to avoid naming conflicts
import { PlatformSession as PlatformSessionDO } from './durable-objects/platform-session';
import { PlatformAuditLog as PlatformAuditLogDO } from './durable-objects/platform-audit-log';

// Re-export with original names for wrangler configuration
export class PlatformSession extends PlatformSessionDO {}
export class PlatformAuditLog extends PlatformAuditLogDO {}

// Logger will be initialized per-request to include proper context

// Dashboard template with placeholder replacement
const DASHBOARD_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Platform Administration - Lexara</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f8fafc;
            color: #334155;
            line-height: 1.6;
        }
        
        .platform-header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .logo-section h1 {
            font-size: 1.5rem;
            font-weight: 700;
        }
        
        .logo-section p {
            opacity: 0.9;
            font-size: 0.875rem;
        }
        
        .user-info {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .user-details {
            text-align: right;
        }
        
        .user-name {
            font-weight: 600;
        }
        
        .user-role {
            font-size: 0.75rem;
            opacity: 0.8;
        }
        
        .logout-btn {
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            text-decoration: none;
            font-size: 0.875rem;
            transition: background-color 0.2s;
        }
        
        .logout-btn:hover {
            background: rgba(255,255,255,0.3);
        }
        
        .dashboard-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .metric-card {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid #e2e8f0;
        }
        
        .metric-card.primary {
            border-left: 4px solid #3b82f6;
        }
        
        .metric-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        
        .metric-content h3 {
            font-size: 0.875rem;
            font-weight: 600;
            color: #64748b;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .metric-value {
            font-size: 2rem;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 0.25rem;
        }
        
        .metric-trend {
            font-size: 0.875rem;
            color: #64748b;
        }
        
        .trend-indicator {
            font-weight: 600;
        }
        
        .trend-indicator.up {
            color: #10b981;
        }
        
        .metric-subtitle {
            font-size: 0.875rem;
            color: #64748b;
        }
        
        .metric-status {
            font-size: 0.875rem;
            font-weight: 500;
        }
        
        .metric-status.healthy {
            color: #10b981;
        }
        
        .quick-actions {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid #e2e8f0;
            margin-bottom: 2rem;
        }
        
        .quick-actions h2 {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: #1e293b;
        }
        
        .action-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }
        
        .action-btn {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            background: white;
            text-decoration: none;
            color: #334155;
            transition: all 0.2s;
            cursor: pointer;
        }
        
        .action-btn:hover {
            border-color: #3b82f6;
            background: #f8fafc;
            transform: translateY(-1px);
        }
        
        .action-btn.primary {
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
        }
        
        .action-btn.primary:hover {
            background: #2563eb;
        }
        
        .action-icon {
            font-size: 1.25rem;
        }
        
        .action-text {
            font-weight: 500;
        }
        
        .coming-soon {
            background: white;
            border-radius: 8px;
            padding: 2rem;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid #e2e8f0;
            margin-top: 2rem;
        }
        
        .coming-soon h3 {
            font-size: 1.125rem;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 0.5rem;
        }
        
        .coming-soon p {
            color: #64748b;
        }
    </style>
</head>
<body>
    <header class="platform-header">
        <div class="logo-section">
            <h1>Lexara Platform Administration</h1>
            <p>Manage law firm customers and platform operations</p>
        </div>
        <div class="user-info">
            <div class="user-details">
                <div class="user-name">{{userName}}</div>
                <div class="user-role">{{userRole}}</div>
            </div>
            <a href="/logout" class="logout-btn">Logout</a>
        </div>
    </header>

    <main class="dashboard-content">
        <!-- Key Metrics Grid -->
        <section class="metrics-grid">
            <div class="metric-card primary">
                <div class="metric-icon">🏢</div>
                <div class="metric-content">
                    <h3>Active Law Firms</h3>
                    <div class="metric-value">{{activeFirms}}</div>
                    <div class="metric-trend">
                        <span class="trend-indicator up">+{{firmGrowth}}%</span>
                        <span>vs last month</span>
                    </div>
                </div>
            </div>
            
            <div class="metric-card">
                <div class="metric-icon">💬</div>
                <div class="metric-content">
                    <h3>Platform Conversations</h3>
                    <div class="metric-value">{{totalConversations}}</div>
                    <div class="metric-subtitle">{{monthlyConversations}} this month</div>
                </div>
            </div>
            
            <div class="metric-card">
                <div class="metric-icon">💰</div>
                <div class="metric-content">
                    <h3>Monthly Revenue</h3>
                    <div class="metric-value">{{monthlyRevenue}}</div>
                    <div class="metric-trend">
                        <span class="trend-indicator up">+{{revenueGrowth}}%</span>
                        <span>vs last month</span>
                    </div>
                </div>
            </div>
            
            <div class="metric-card">
                <div class="metric-icon">⚡</div>
                <div class="metric-content">
                    <h3>System Health</h3>
                    <div class="metric-value">{{systemUptime}}%</div>
                    <div class="metric-status healthy">All Systems Operational</div>
                </div>
            </div>
        </section>

        <!-- Quick Actions -->
        <section class="quick-actions">
            <h2>Quick Actions</h2>
            <div class="action-grid">
                <button class="action-btn primary" onclick="alert('Create New Firm feature coming soon!')">
                    <span class="action-icon">➕</span>
                    <span class="action-text">Create New Firm</span>
                </button>
                <a href="/firms" class="action-btn">
                    <span class="action-icon">👥</span>
                    <span class="action-text">Manage Firms</span>
                </a>
                <a href="/analytics" class="action-btn">
                    <span class="action-icon">📊</span>
                    <span class="action-text">View Analytics</span>
                </a>
                <button class="action-btn" onclick="alert('System Health details coming soon!')">
                    <span class="action-icon">🔧</span>
                    <span class="action-text">System Health</span>
                </button>
            </div>
        </section>

        <!-- Coming Soon Section -->
        <section class="coming-soon">
            <h3>Advanced Features Coming Soon</h3>
            <p>Firm management interface, detailed analytics, and customer support tools are currently in development.</p>
        </section>
    </main>

    <script>
        // Auto-refresh dashboard every 5 minutes
        setTimeout(() => {
            window.location.reload();
        }, 300000);
    </script>
</body>
</html>`;

// Simple login page template
const LOGIN_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Platform Login - Lexara</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .login-container {
            background: white;
            border-radius: 12px;
            padding: 3rem;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 100%;
        }
        
        .logo {
            font-size: 2rem;
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 0.5rem;
        }
        
        .subtitle {
            color: #64748b;
            margin-bottom: 2rem;
        }
        
        .login-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: background-color 0.2s;
        }
        
        .login-btn:hover {
            background: #2563eb;
        }
        
        .security-notice {
            margin-top: 2rem;
            padding: 1rem;
            background: #f8fafc;
            border-radius: 6px;
            border-left: 4px solid #3b82f6;
            text-align: left;
        }
        
        .security-notice h4 {
            color: #1e293b;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
        }
        
        .security-notice p {
            color: #64748b;
            font-size: 0.75rem;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">Lexara Platform</div>
        <p class="subtitle">Secure Administration Portal</p>
        
        <a href="{{authUrl}}" class="login-btn">
            Login with Auth0
        </a>
        
        <div class="security-notice">
            <h4>🔒 Security Notice</h4>
            <p>This portal is restricted to authorized Lexara employees only. All access is logged and monitored for security purposes.</p>
        </div>
    </div>
</body>
</html>`;

// Main platform admin worker implementation
const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      console.log('Platform worker starting...');
      
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;
      
      console.log('URL parsed, path:', path);
      
      // Initialize logger first
      console.log('Initializing logger...');
      const logger = createLogger(env, {
        operation: 'platform-admin',
        service: 'platform-worker'
      });
      console.log('Logger initialized');
      
      // Initialize services
      console.log('Initializing audit logger...');
      const auditLogger = new PlatformAuditLogger(env, logger);
      console.log('Audit logger initialized');
      
      console.log('Initializing auth manager...');
      const authManager = new PlatformAuthManager(env, auditLogger);
      console.log('Auth manager initialized');
      
      console.log('Initializing security guard...');
      const securityGuard = new PlatformSecurityGuard(env, auditLogger);
      console.log('Security guard initialized');
      
      logger.info('Platform admin request', {
        method,
        path,
        origin: request.headers.get('origin'),
        userAgent: request.headers.get('user-agent')?.substring(0, 100)
      });
      
      // 1. Security validation (except for public routes)
      const publicRoutes = ['/health', '/', '/login', '/callback'];
      if (!publicRoutes.includes(path)) {
        const securityResult = await securityGuard.validateRequest(request);
        if (!securityResult.valid) {
          await auditLogger.logSecurityEvent({
            event: 'request_blocked',
            reason: securityResult.reason || 'Security validation failed',
            severity: securityResult.riskLevel || 'medium',
            request,
            metadata: {
              blockedReason: securityResult.blockedReason,
              path,
              method
            }
          });
          
          return new Response(JSON.stringify({
            error: 'ACCESS_DENIED',
            message: 'Request blocked by security policy'
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // 2. Route handling
      switch (path) {
        case '/health':
          return handleHealthCheck();
          
        case '/login':
          return handleLogin(authManager);
          
        case '/callback':
          console.log('=== CALLBACK HANDLER STARTING ===');
          try {
            return await handleCallback(request, authManager, auditLogger);
          } catch (error) {
            console.error('Callback handler error:', error);
            throw error;
          }
          
        case '/logout':
          return handleLogout(request, authManager, auditLogger);
          
        case '/':
          // Redirect root to login page
          return redirectToLogin();
          
        case '/dashboard':
          return handleDashboard(request, authManager, auditLogger);
          
        default:
          // Protected routes that require authentication
          const authResult = await authManager.requirePlatformAuth(request);
          if (!authResult.success) {
            return redirectToLogin();
          }
          
          return handleProtectedRoute(path, request, method, authResult.authContext!, auditLogger);
      }
      
    } catch (error) {
      console.error('Platform worker error:', error);
      
      // Try to use logger if it was initialized
      try {
        logger.error('Platform worker error', error as Error, {
          path,
          method,
          errorName: (error as Error).name,
          errorMessage: (error as Error).message
        });
        
        // Log error to audit trail
        await auditLogger.logSecurityEvent({
          event: 'request_error',
          reason: `Unhandled error: ${(error as Error).message}`,
          severity: 'high',
          request,
          metadata: {
            errorName: (error as Error).name,
            errorStack: (error as Error).stack?.substring(0, 500)
          }
        });
      } catch (loggingError) {
        // Don't throw on logging errors
        console.error('Logging error:', loggingError);
      }
      
      return new Response(JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

// Health check endpoint
function handleHealthCheck(): Response {
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'platform-admin',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Login page
async function handleLogin(authManager: PlatformAuthManager): Promise<Response> {
  const authUrl = await authManager.generateAuthUrl('/dashboard');
  const html = LOGIN_TEMPLATE.replace('{{authUrl}}', authUrl);
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Auth0 callback handler
async function handleCallback(
  request: Request,
  authManager: PlatformAuthManager,
  auditLogger: PlatformAuditLogger
): Promise<Response> {
  console.log('=== HANDLE CALLBACK FUNCTION ENTERED ===');
  
  const url = new URL(request.url);
  console.log('Callback URL parsed:', {
    pathname: url.pathname,
    search: url.search,
    searchParams: Array.from(url.searchParams.entries())
  });
  
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  
  console.log('Callback parameters:', {
    hasCode: !!code,
    codeLength: code?.length,
    hasState: !!state,
    stateLength: state?.length,
    hasError: !!error,
    error,
    errorDescription
  });
  
  // Handle Auth0 errors
  if (error) {
    await auditLogger.logSecurityEvent({
      event: 'auth_callback_error',
      reason: `Auth0 error: ${error} - ${errorDescription}`,
      severity: 'medium',
      request
    });
    
    return Response.redirect('https://platform-dev.lexara.app/login?error=' + encodeURIComponent(error), 302);
  }
  
  // Validate required parameters
  if (!code || !state) {
    await auditLogger.logSecurityEvent({
      event: 'auth_callback_invalid',
      reason: 'Missing required callback parameters',
      severity: 'high',
      request,
      metadata: { hasCode: !!code, hasState: !!state }
    });
    
    return Response.redirect('https://platform-dev.lexara.app/login?error=invalid_callback', 302);
  }
  
  try {
    // Process callback
    const authResult = await authManager.handleCallback(code, state, request);
    
    if (!authResult.success) {
      await auditLogger.logSecurityEvent({
        event: 'auth_callback_failed',
        reason: authResult.error || 'Authentication failed',
        severity: 'high',
        request
      });
      
      return Response.redirect('https://platform-dev.lexara.app/login?error=auth_failed', 302);
    }
    
    // Successful authentication - redirect to dashboard
    const returnUrl = authResult.returnTo?.startsWith('http') 
      ? authResult.returnTo 
      : `https://platform-dev.lexara.app${authResult.returnTo || '/dashboard'}`;
    
    // Create redirect response with cookie header
    const redirectResponse = new Response(null, {
      status: 302,
      headers: {
        'Location': returnUrl,
        'Set-Cookie': authResult.sessionCookie!
      }
    });
    
    // Log successful login
    await auditLogger.logAction({
      action: 'platform_login',
      description: `Platform admin login successful`,
      platformUser: authResult.authContext!,
      targetType: 'system',
      request,
      riskLevel: 'low'
    });
    
    return redirectResponse;
    
  } catch (error) {
    await auditLogger.logSecurityEvent({
      event: 'auth_callback_exception',
      reason: `Callback processing error: ${(error as Error).message}`,
      severity: 'critical',
      request,
      metadata: {
        errorName: (error as Error).name,
        errorMessage: (error as Error).message
      }
    });
    
    return Response.redirect('https://platform-dev.lexara.app/login?error=system_error', 302);
  }
}

// Logout handler
async function handleLogout(
  request: Request,
  authManager: PlatformAuthManager,
  auditLogger: PlatformAuditLogger
): Promise<Response> {
  // Extract user info for audit log before logout
  const authResult = await authManager.requirePlatformAuth(request);
  
  if (authResult.success && authResult.authContext) {
    await auditLogger.logAction({
      action: 'platform_logout',
      description: 'Platform admin logout',
      platformUser: authResult.authContext,
      targetType: 'system',
      request,
      riskLevel: 'low'
    });
  }
  
  return authManager.handleLogout(request);
}

// Dashboard handler
async function handleDashboard(
  request: Request,
  authManager: PlatformAuthManager,
  auditLogger: PlatformAuditLogger
): Promise<Response> {
  // Require authentication
  const authResult = await authManager.requirePlatformAuth(request);
  if (!authResult.success) {
    return redirectToLogin();
  }
  
  // Generate dashboard with sample data
  const dashboardData = {
    userName: authResult.authContext!.name || authResult.authContext!.email || 'Platform Admin',
    userRole: 'Platform Administrator',
    activeFirms: '12',
    firmGrowth: '8',
    totalConversations: '1,247',
    monthlyConversations: '342',
    monthlyRevenue: '$24,500',
    revenueGrowth: '15',
    systemUptime: '99.9'
  };
  
  let html = DASHBOARD_TEMPLATE;
  Object.entries(dashboardData).forEach(([key, value]) => {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Protected route handler
async function handleProtectedRoute(
  path: string,
  request: Request,
  method: string,
  authContext: AuthContext,
  auditLogger: PlatformAuditLogger
): Promise<Response> {
  // Log access to protected routes
  await auditLogger.logAction({
    action: 'system_settings_changed', // Generic action for now
    description: `Accessed protected route: ${method} ${path}`,
    platformUser: authContext,
    targetType: 'system',
    targetId: path,
    request,
    riskLevel: 'low'
  });
  
  // Implement specific route handlers here
  switch (path) {
    case '/firms':
      return new Response(JSON.stringify({
        message: 'Firm management interface coming soon',
        path
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    case '/analytics':
      return new Response(JSON.stringify({
        message: 'Analytics dashboard coming soon',
        path
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    default:
      return new Response(JSON.stringify({
        error: 'NOT_FOUND',
        message: `Protected route not implemented: ${path}`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
  }
}

// Helper function for login redirects
function redirectToLogin(): Response {
  return Response.redirect('https://platform-dev.lexara.app/login', 302);
}

export default handler;