// Guidelines handler for Admin API

import { AdminEnv, AuthenticatedRequest } from '../types';

export class GuidelinesHandler {
  constructor(private env: AdminEnv) {}

  async list(request: AuthenticatedRequest, firmId: string): Promise<Response> {
    // TODO: Implement guidelines listing
    return this.notImplemented();
  }

  async create(request: AuthenticatedRequest, firmId: string): Promise<Response> {
    // TODO: Implement guideline creation
    return this.notImplemented();
  }

  private notImplemented(): Response {
    return new Response(JSON.stringify({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Guidelines management endpoints not yet implemented'
      }
    }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}