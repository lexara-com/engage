/**
 * Lexara API Worker - Main Entry Point
 * 
 * This worker provides the core RESTful API for the Lexara Engage platform,
 * implementing a hybrid data architecture that routes between Durable Objects
 * (for real-time consistency) and D1 databases (for analytical queries).
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { timing } from 'hono/timing';

import { APIRouter } from './router';
import { authMiddleware } from '@/middleware/auth';
import { auditMiddleware } from '@/middleware/audit';
import { rateLimitMiddleware } from '@/middleware/rate-limiting';
import { errorHandler } from './error-handler';
import { validateRequest } from '@/middleware/validation';

export interface Env {
  // Durable Objects
  CONVERSATION_SESSION: DurableObjectNamespace;
  USER_IDENTITY: DurableObjectNamespace;
  FIRM_REGISTRY: DurableObjectNamespace;
  
  // D1 Databases
  FIRM_INDEX_DB: D1Database;
  PLATFORM_DB: D1Database;
  
  // Vectorize Indexes
  KNOWLEDGE_BASE: VectorizeIndex;
  CONFLICT_DB: VectorizeIndex;
  
  // KV for caching
  API_CACHE: KVNamespace;
  
  // Environment Variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  API_VERSION: string;
  CORS_ORIGINS: string;
  
  // Secrets (configured via Cloudflare dashboard)
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  ANTHROPIC_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', timing());
app.use('*', prettyJSON());

// CORS configuration
app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = c.env.CORS_ORIGINS.split(',');
    return allowedOrigins.includes(origin) ? origin : false;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Client-Version'],
  exposeHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Health check endpoint (no auth required)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: c.env.API_VERSION,
    environment: c.env.ENVIRONMENT
  });
});

// API documentation endpoint
app.get('/docs', async (c) => {
  // Serve OpenAPI documentation
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Lexara API Documentation</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
        <style>
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <redoc spec-url="/api-docs.json"></redoc>
        <script src="https://cdn.jsdelivr.net/npm/redoc@2.1.3/bundles/redoc.standalone.js"></script>
      </body>
    </html>
  `;
  return c.html(html);
});

// API specification endpoint
app.get('/api-docs.json', async (c) => {
  // Return OpenAPI specification
  const spec = await getOpenAPISpec(c.env);
  return c.json(spec);
});

// Protected API routes
app.route('/api/v1', createAPIRoutes());

// Global error handler
app.onError(errorHandler);

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: c.req.path,
    method: c.req.method
  }, 404);
});

function createAPIRoutes() {
  const api = new Hono<{ Bindings: Env }>();
  
  // Request validation middleware
  api.use('*', validateRequest);
  
  // Authentication middleware (extracts firm context from JWT)
  api.use('*', authMiddleware);
  
  // Rate limiting middleware
  api.use('*', rateLimitMiddleware);
  
  // Audit logging middleware
  api.use('*', auditMiddleware);
  
  // API router handles all business logic
  const router = new APIRouter();
  
  // Firm-scoped endpoints
  api.route('/firm', router.getFirmRoutes());
  
  // Platform admin endpoints (Lexara employees only)
  api.route('/platform', router.getPlatformRoutes());
  
  // Webhook endpoints
  api.route('/webhooks', router.getWebhookRoutes());
  
  return api;
}

async function getOpenAPISpec(env: Env) {
  // Generate OpenAPI specification dynamically
  return {
    openapi: '3.0.3',
    info: {
      title: 'Lexara API',
      description: 'RESTful API for the Lexara Engage legal client intake platform',
      version: env.API_VERSION,
      contact: {
        name: 'Lexara API Support',
        email: 'api-support@lexara.com',
        url: 'https://docs.lexara.com'
      },
      license: {
        name: 'Proprietary',
        url: 'https://lexara.com/terms'
      }
    },
    servers: [
      {
        url: `https://api${env.ENVIRONMENT === 'production' ? '' : `-${env.ENVIRONMENT}`}.lexara.app`,
        description: `${env.ENVIRONMENT.charAt(0).toUpperCase() + env.ENVIRONMENT.slice(1)} server`
      }
    ],
    security: [
      {
        bearerAuth: []
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Auth0 JWT token with organization claim for firm context'
        }
      }
    },
    paths: {
      // Paths will be populated by route handlers
    }
  };
}

export default app;