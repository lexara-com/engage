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

const logger = createLogger('AdminWorker');

// Main admin worker implementation
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Add CORS headers for admin interface
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://admin.engage.lexara.com',
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

      // Authentication middleware
      const authResult = await validateAuthentication(request);
      if (!authResult.valid) {
        return new Response(JSON.stringify({
          error: 'AUTHENTICATION_REQUIRED',
          message: authResult.error || 'Valid authentication required'
        }), {
          status: 401,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      }

      // Route API requests
      let response: Response;

      // Firm management endpoints
      if (path.startsWith('/api/admin/firms')) {
        response = await routeFirmRequests(request, env, method, path);
      }
      // User management endpoints
      else if (path.includes('/users')) {
        response = await routeUserRequests(request, env, method, path);
      }
      // Configuration endpoints
      else if (path.includes('/configuration')) {
        response = await routeConfigurationRequests(request, env, method, path);
      }
      // Analytics endpoints
      else if (path.includes('/analytics')) {
        response = await routeAnalyticsRequests(request, env, method, path);
      }
      // Subscription endpoints
      else if (path.includes('/subscription')) {
        response = await routeSubscriptionRequests(request, env, method, path);
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
      logger.error('Admin worker error', { 
        error: error.message,
        stack: error.stack 
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

// Authentication validation
async function validateAuthentication(request: Request): Promise<{ valid: boolean; error?: string }> {
  // Extract Auth0 JWT token
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);
  
  // Validate required headers
  const requiredHeaders = ['x-auth0-user-id', 'x-user-email', 'x-user-role', 'x-firm-id'];
  for (const header of requiredHeaders) {
    if (!request.headers.get(header)) {
      return { valid: false, error: `Missing required header: ${header}` };
    }
  }

  // TODO: Validate JWT token with Auth0
  // For now, trust the headers (would be validated by auth middleware)
  
  return { valid: true };
}

// Firm management request routing
async function routeFirmRequests(
  request: Request, 
  env: Env, 
  method: string, 
  path: string
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
  path: string
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
  path: string
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
  path: string
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
  path: string
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