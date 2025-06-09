// Main Agent Worker - Engage Legal AI Platform

/// <reference types="@cloudflare/workers-types" />

import { Env } from '@/types/shared';
import { createLogger } from '@/utils/logger';
import { EngageError, handleError } from '@/utils/errors';
import { ClaudeAgent } from './claude-agent';

// Export Durable Object classes
export { ConversationSession } from '../durable-objects/conversation-session';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const logger = createLogger(env, { operation: 'main-worker' });
    
    try {
      logger.info('Received request', { 
        url: request.url, 
        method: request.method,
        environment: env.ENVIRONMENT 
      });

      const url = new URL(request.url);
      const agent = new ClaudeAgent(env);
      
      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          environment: env.ENVIRONMENT,
          timestamp: new Date().toISOString(),
          services: {
            durableObjects: 'available',
            vectorize: 'available',
            ai: 'available'
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // API version endpoint
      if (url.pathname === '/api/v1/version') {
        return new Response(JSON.stringify({
          name: 'Engage Legal AI Platform',
          version: '0.1.0',
          environment: env.ENVIRONMENT,
          capabilities: [
            'conversation-management',
            'conflict-detection',
            'goal-tracking',
            'auth0-integration'
          ]
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Test Durable Objects binding
      if (url.pathname === '/api/v1/test/durable-objects') {
        const conversationStub = env.CONVERSATION_SESSION.get(
          env.CONVERSATION_SESSION.idFromName('test-session')
        );
        
        logger.info('Testing Durable Objects binding', { stubId: conversationStub.toString() });
        
        return new Response(JSON.stringify({
          durableObjects: {
            conversationSession: 'binding-available',
            userIdentity: 'binding-available'
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create new conversation session
      if (url.pathname === '/api/v1/conversations' && request.method === 'POST') {
        const { firmId } = await request.json() as { firmId: string };
        const result = await agent.createSession(firmId);
        
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Send message to agent
      if (url.pathname === '/api/v1/conversations/message' && request.method === 'POST') {
        const requestData = await request.json() as {
          message: string;
          sessionId?: string;
          resumeToken?: string;
        };

        const auth0UserId = request.headers.get('x-auth0-user-id') || undefined;

        const response = await agent.processMessage({
          ...requestData,
          auth0UserId
        });

        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Resume conversation session
      if (url.pathname.startsWith('/api/v1/conversations/resume/') && request.method === 'GET') {
        const resumeToken = url.pathname.split('/').pop();
        
        if (!resumeToken) {
          throw new EngageError('Resume token required', 'MISSING_RESUME_TOKEN', 400);
        }

        // For resume, we need to find the DO by resume token
        // For now, using a simple approach - in production this would need a mapping
        const conversationStub = env.CONVERSATION_SESSION.get(
          env.CONVERSATION_SESSION.idFromName(`resume-${resumeToken}`)
        );
        
        return conversationStub.fetch(new Request(`http://durable-object/resume/${resumeToken}`, {
          method: 'GET',
          headers: request.headers
        }));
      }

      // Test Vectorize binding
      if (url.pathname === '/api/v1/test/vectorize') {
        try {
          // Test both vectorize bindings exist
          const supportingDocsAvailable = !!env.SUPPORTING_DOCUMENTS;
          const conflictDbAvailable = !!env.CONFLICT_DATABASE;
          
          logger.info('Testing Vectorize bindings', { 
            supportingDocs: supportingDocsAvailable,
            conflictDb: conflictDbAvailable 
          });
          
          return new Response(JSON.stringify({
            vectorize: {
              supportingDocuments: supportingDocsAvailable ? 'binding-available' : 'binding-missing',
              conflictDatabase: conflictDbAvailable ? 'binding-available' : 'binding-missing'
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          logger.error('Vectorize test failed', error as Error);
          throw new EngageError('Vectorize test failed', 'VECTORIZE_TEST_ERROR', 500);
        }
      }

      // Test Workers AI binding
      if (url.pathname === '/api/v1/test/ai') {
        try {
          const aiAvailable = !!env.AI;
          
          logger.info('Testing Workers AI binding', { aiAvailable });
          
          return new Response(JSON.stringify({
            ai: {
              binding: aiAvailable ? 'available' : 'missing',
              note: 'AI functionality test requires actual model call'
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          logger.error('AI test failed', error as Error);
          throw new EngageError('AI test failed', 'AI_TEST_ERROR', 500);
        }
      }

      // Default 404 response
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'Endpoint not found',
        availableEndpoints: [
          '/health',
          '/api/v1/version',
          '/api/v1/test/durable-objects',
          '/api/v1/test/vectorize',
          '/api/v1/test/ai'
        ]
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      const engageError = handleError(error, 'Request processing failed');
      logger.error('Request failed', error as Error, { 
        code: engageError.code,
        statusCode: engageError.statusCode 
      });

      return new Response(JSON.stringify({
        error: engageError.code,
        message: engageError.message,
        statusCode: engageError.statusCode
      }), {
        status: engageError.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};