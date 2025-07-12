import type { APIRoute } from 'astro';

// Test endpoint to verify D1 database binding
export const GET: APIRoute = async (context) => {
  try {
    // Log all possible locations where D1 might be
    console.log('Looking for D1 binding...');
    console.log('context.env:', (context as any).env);
    console.log('context.locals:', context.locals);
    console.log('context.locals.runtime:', (context as any).locals?.runtime);
    console.log('context keys:', Object.keys(context));
    
    // Try all possible locations
    // In Astro with Cloudflare adapter, bindings are at context.locals.runtime.env
    const runtime = (context.locals as any)?.runtime;
    const db = runtime?.env?.DB ||
                (context as any).env?.DB ||
                (context as any).DB ||
                (context.locals as any)?.DB;
    
    if (!db) {
      // Check if we're in development with platform proxy
      const runtime = (context.locals as any)?.runtime;
      
      return new Response(JSON.stringify({
        success: false,
        error: 'D1 binding not found',
        debug: {
          hasEnv: !!(context as any).env,
          envKeys: (context as any).env ? Object.keys((context as any).env) : [],
          contextKeys: Object.keys(context),
          hasLocals: !!context.locals,
          localsKeys: context.locals ? Object.keys(context.locals) : [],
          hasRuntime: !!runtime,
          runtimeKeys: runtime ? Object.keys(runtime) : [],
          runtimeEnv: runtime?.env ? Object.keys(runtime.env) : []
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Try a simple query to verify D1 is working
    try {
      const result = await db.prepare('SELECT 1 as test').first();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'D1 binding is working',
        testQuery: result,
        binding: {
          type: 'D1Database',
          available: true
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (queryError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'D1 query failed',
        details: queryError instanceof Error ? queryError.message : 'Unknown error',
        binding: {
          type: 'D1Database',
          available: true,
          queryFailed: true
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to check D1 binding',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};