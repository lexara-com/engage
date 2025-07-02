// Admin API Router

import { AdminEnv, AuthenticatedRequest, ErrorResponse } from './types';
import { createLogger } from '@/utils/logger';
import { handleAuth } from './middleware/auth';
import { handleCORS } from './middleware/cors';
import { handleRateLimit } from './middleware/rate-limit';
import { FirmsHandler } from './handlers/firms';
import { ConversationsHandler } from './handlers/conversations';
import { ConflictsHandler } from './handlers/conflicts';
import { DocumentsHandler } from './handlers/documents';
import { GuidelinesHandler } from './handlers/guidelines';

export class AdminAPIRouter {
  private firmsHandler: FirmsHandler;
  private conversationsHandler: ConversationsHandler;
  private conflictsHandler: ConflictsHandler;
  private documentsHandler: DocumentsHandler;
  private guidelinesHandler: GuidelinesHandler;

  constructor(private env: AdminEnv) {
    this.firmsHandler = new FirmsHandler(env);
    this.conversationsHandler = new ConversationsHandler(env);
    this.conflictsHandler = new ConflictsHandler(env);
    this.documentsHandler = new DocumentsHandler(env);
    this.guidelinesHandler = new GuidelinesHandler(env);
  }

  async handle(request: Request): Promise<Response> {
    const logger = createLogger(this.env, { operation: 'admin-api' });
    
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return handleCORS(request, this.env);
      }

      // Parse URL
      const url = new URL(request.url);
      const path = url.pathname.replace('/v1/admin', '');
      
      // Health check (no auth required)
      if (path === '/health') {
        return this.handleHealth();
      }

      // Apply middleware
      let authenticatedRequest = request as AuthenticatedRequest;
      
      // Skip auth for health check
      if (!path.startsWith('/health')) {
        // Apply authentication
        const authResult = await handleAuth(request, this.env);
        if (authResult instanceof Response) {
          return authResult; // Auth failed
        }
        authenticatedRequest = authResult;

        // Apply rate limiting
        const rateLimitResult = await handleRateLimit(authenticatedRequest, this.env);
        if (rateLimitResult instanceof Response) {
          return rateLimitResult; // Rate limit exceeded
        }
      }

      // Route to appropriate handler
      const response = await this.route(authenticatedRequest, path);
      
      // Add CORS headers to response
      const corsHeaders = {
        'Access-Control-Allow-Origin': this.getAllowedOrigin(request),
        'Access-Control-Allow-Credentials': 'true',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      };
      
      // Clone response and add headers
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });

    } catch (error) {
      logger.error('API request failed', error as Error);
      return this.errorResponse(error);
    }
  }

  private async route(request: AuthenticatedRequest, path: string): Promise<Response> {
    const method = request.method;
    const pathParts = path.split('/').filter(p => p);
    
    // Firms routes
    if (pathParts[0] === 'firms') {
      const firmId = pathParts[1];
      
      if (!firmId) {
        // /firms
        if (method === 'GET') return this.firmsHandler.list(request);
        if (method === 'POST') return this.firmsHandler.create(request);
      } else {
        // /firms/{firmId}
        if (!pathParts[2]) {
          if (method === 'GET') return this.firmsHandler.get(request, firmId);
          if (method === 'PUT') return this.firmsHandler.update(request, firmId);
          if (method === 'DELETE') return this.firmsHandler.delete(request, firmId);
        }
        
        // /firms/{firmId}/conversations
        if (pathParts[2] === 'conversations') {
          const conversationId = pathParts[3];
          
          if (!conversationId) {
            if (method === 'GET') return this.conversationsHandler.list(request, firmId);
          } else {
            // /firms/{firmId}/conversations/{conversationId}
            if (!pathParts[4]) {
              if (method === 'GET') return this.conversationsHandler.get(request, firmId, conversationId);
              if (method === 'PUT') return this.conversationsHandler.update(request, firmId, conversationId);
              if (method === 'DELETE') return this.conversationsHandler.delete(request, firmId, conversationId);
            }
            
            // /firms/{firmId}/conversations/{conversationId}/notes
            if (pathParts[4] === 'notes') {
              if (method === 'POST') return this.conversationsHandler.addNote(request, firmId, conversationId);
            }
            
            // /firms/{firmId}/conversations/{conversationId}/actions
            if (pathParts[4] === 'actions') {
              if (method === 'POST') return this.conversationsHandler.performAction(request, firmId, conversationId);
            }
          }
        }
        
        // /firms/{firmId}/conflicts
        if (pathParts[2] === 'conflicts') {
          const conflictId = pathParts[3];
          
          if (!conflictId) {
            if (method === 'GET') return this.conflictsHandler.list(request, firmId);
            if (method === 'POST') return this.conflictsHandler.create(request, firmId);
          } else {
            if (conflictId === 'bulk') {
              if (method === 'POST') return this.conflictsHandler.bulkImport(request, firmId);
            } else {
              if (method === 'GET') return this.conflictsHandler.get(request, firmId, conflictId);
              if (method === 'PUT') return this.conflictsHandler.update(request, firmId, conflictId);
              if (method === 'DELETE') return this.conflictsHandler.delete(request, firmId, conflictId);
            }
          }
        }
        
        // /firms/{firmId}/documents
        if (pathParts[2] === 'documents') {
          const documentId = pathParts[3];
          
          if (!documentId) {
            if (method === 'GET') return this.documentsHandler.list(request, firmId);
            if (method === 'POST') return this.documentsHandler.upload(request, firmId);
          } else {
            if (!pathParts[4]) {
              if (method === 'GET') return this.documentsHandler.get(request, firmId, documentId);
              if (method === 'PUT') return this.documentsHandler.update(request, firmId, documentId);
              if (method === 'DELETE') return this.documentsHandler.delete(request, firmId, documentId);
            }
            
            // /firms/{firmId}/documents/{documentId}/content
            if (pathParts[4] === 'content') {
              if (method === 'GET') return this.documentsHandler.download(request, firmId, documentId);
            }
          }
        }
        
        // /firms/{firmId}/guidelines
        if (pathParts[2] === 'guidelines') {
          if (method === 'GET') return this.guidelinesHandler.list(request, firmId);
          if (method === 'POST') return this.guidelinesHandler.create(request, firmId);
        }
      }
    }
    
    // Not found
    return this.notFound();
  }

  private handleHealth(): Response {
    return new Response(JSON.stringify({
      status: 'healthy',
      service: 'engage-admin-api',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private notFound(): Response {
    const error: ErrorResponse = {
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      }
    };
    
    return new Response(JSON.stringify(error), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private errorResponse(error: any): Response {
    const status = error.statusCode || 500;
    const errorResponse: ErrorResponse = {
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        ...(error.details && { details: error.details })
      }
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private getAllowedOrigin(request: Request): string {
    const origin = request.headers.get('Origin');
    const allowedOrigins = this.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    
    if (origin && allowedOrigins.includes(origin)) {
      return origin;
    }
    
    return allowedOrigins[0];
  }
}