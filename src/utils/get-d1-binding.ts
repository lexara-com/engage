import type { APIContext } from 'astro';

/**
 * Get the D1 database binding from the Astro context
 * In development with platformProxy, the binding is at context.locals.runtime.env.DB
 * In production, it may be at context.env.DB
 */
export function getD1Binding(context: APIContext): D1Database | null {
  // Try different locations where D1 binding might be available
  
  // 1. Try development location first (platformProxy)
  const runtime = (context.locals as any)?.runtime;
  if (runtime?.env?.DB) {
    console.log('✅ Found D1 binding at context.locals.runtime.env.DB');
    return runtime.env.DB;
  }
  
  // 2. Try Astro's env
  if ((context as any).env?.DB) {
    console.log('✅ Found D1 binding at context.env.DB');
    return (context as any).env.DB;
  }
  
  // 3. Try directly on locals (some versions put it here)
  if ((context.locals as any)?.DB) {
    console.log('✅ Found D1 binding at context.locals.DB');
    return (context.locals as any).DB;
  }
  
  // 4. Check if we're in development and platformProxy might not be working
  if (import.meta.env.DEV) {
    console.log('⚠️ Running in development mode but D1 binding not found');
    console.log('Available context structure:');
    console.log('- context.locals keys:', Object.keys(context.locals || {}));
    console.log('- context.locals.runtime:', !!(context.locals as any)?.runtime);
    if ((context.locals as any)?.runtime) {
      console.log('- runtime.env keys:', Object.keys((context.locals as any).runtime.env || {}));
    }
    
    // In development, we might need to wait for the platform proxy to initialize
    // This is a known issue with Astro + Cloudflare adapter
    console.log('💡 Tip: Make sure the dev server has fully started and try refreshing the page');
  }
  
  return null;
}