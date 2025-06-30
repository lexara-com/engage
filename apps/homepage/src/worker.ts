// Custom worker entry point that exports both Astro SSR and Durable Objects
import { FirmRegistry } from './durable-objects/firm-registry';

// Export the Durable Object class
export { FirmRegistry };

// Import and re-export the Astro SSR handler
import type { ExportedHandler } from '@cloudflare/workers-types';

// This will be the main worker handler
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    // For now, return a simple response since we need to integrate with Astro's build
    // The actual Astro integration will be handled separately
    return new Response('Worker with Durable Objects ready', { status: 200 });
  }
} satisfies ExportedHandler;