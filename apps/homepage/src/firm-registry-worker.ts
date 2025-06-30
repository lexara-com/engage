// Dedicated worker for FirmRegistry Durable Object
import { FirmRegistry } from './durable-objects/firm-registry';

// Export the Durable Object class
export { FirmRegistry };

// Simple worker handler
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    return new Response('FirmRegistry worker running', { status: 200 });
  }
};