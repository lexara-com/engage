// Minimal debug worker to isolate Error 1101 issue
// This will help us identify if the problem is with imports, syntax, or logic

export class PlatformSession {
  constructor(state: DurableObjectState, env: any) {}
  async fetch(request: Request): Promise<Response> {
    return new Response('Debug Session DO', { status: 200 });
  }
}

export class PlatformAuditLog {
  constructor(state: DurableObjectState, env: any) {}
  async fetch(request: Request): Promise<Response> {
    return new Response('Debug Audit DO', { status: 200 });
  }
}

const handler = {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      console.log('Debug worker request:', url.pathname);
      
      return new Response(JSON.stringify({
        status: 'debug_worker_running',
        path: url.pathname,
        timestamp: new Date().toISOString(),
        env_check: {
          has_auth0_domain: !!env.AUTH0_DOMAIN,
          has_auth0_client_id: !!env.AUTH0_CLIENT_ID,
          environment: env.ENVIRONMENT
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Debug worker error:', error);
      return new Response(JSON.stringify({
        error: 'debug_worker_error',
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