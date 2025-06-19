// Minimal test platform worker to isolate issues

import { Env } from '@/types/shared';

// Minimal Durable Object classes
export class PlatformSession {
  constructor(state: DurableObjectState, env: Env) {}
  async fetch(request: Request): Promise<Response> {
    return new Response('Session DO Test', { status: 200 });
  }
}

export class PlatformAuditLog {
  constructor(state: DurableObjectState, env: Env) {}
  async fetch(request: Request): Promise<Response> {
    return new Response('Audit DO Test', { status: 200 });
  }
}

// Main handler
const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          service: 'platform-admin-test',
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (url.pathname === '/test') {
        return new Response('Platform Admin Test Worker is running!', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
      
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: (error as Error).message,
        stack: (error as Error).stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

export default handler;