export interface FirmRecord {
  firmId: string;
  name: string;
  size: string;
  practiceAreas: string[];
  plan: string;
  status: 'pending_verification' | 'active' | 'suspended';
  createdAt: string;
  adminUsers: Array<{
    auth0UserId: string;
    role: 'admin' | 'user';
    addedAt: string;
  }>;
  settings: {
    intakeEnabled: boolean;
    conflictDetectionEnabled: boolean;
    autoAssignmentEnabled: boolean;
  };
  billing?: {
    stripeCustomerId?: string;
    subscriptionId?: string;
    nextBillingDate?: string;
  };
}

export interface FirmRegistrationData {
  plan: string;
  firmName: string;
  firmSize: string;
  practiceAreas: string[];
  firstName: string;
  lastName: string;
  email: string;
  agreedToTerms: boolean;
}

export class FirmRegistry {
  private state: DurableObjectState;
  private env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    try {
      switch (request.method) {
        case 'POST':
          if (url.pathname === '/create') {
            return await this.createFirm(request);
          }
          if (url.pathname === '/link-user') {
            return await this.linkUserToFirm(request);
          }
          break;
          
        case 'GET':
          if (url.pathname === '/get') {
            return await this.getFirm(request);
          }
          if (url.pathname === '/list') {
            return await this.listFirms();
          }
          break;
          
        case 'PUT':
          if (url.pathname === '/update') {
            return await this.updateFirm(request);
          }
          break;
      }
      
      return new Response('Method not found', { status: 404 });
    } catch (error) {
      console.error('FirmRegistry error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async createFirm(request: Request): Promise<Response> {
    const firmData: FirmRegistrationData = await request.json();
    
    // Generate ULID for firm ID
    const firmId = this.generateULID();
    
    const firm: FirmRecord = {
      firmId,
      name: firmData.firmName,
      size: firmData.firmSize,
      practiceAreas: firmData.practiceAreas,
      plan: firmData.plan,
      status: 'pending_verification',
      createdAt: new Date().toISOString(),
      adminUsers: [],
      settings: {
        intakeEnabled: true,
        conflictDetectionEnabled: true,
        autoAssignmentEnabled: false
      }
    };
    
    // Store firm record
    await this.state.storage.put(`firm:${firmId}`, firm);
    
    // Also store by name for quick lookups (with collision handling)
    const nameKey = `by-name:${firmData.firmName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    await this.state.storage.put(nameKey, firmId);
    
    console.log(`✅ Firm created in Durable Object: ${firmId}`);
    
    return new Response(JSON.stringify({
      success: true,
      firmId,
      firm
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async linkUserToFirm(request: Request): Promise<Response> {
    const { firmId, auth0UserId, role = 'admin' } = await request.json();
    
    const firm = await this.state.storage.get(`firm:${firmId}`) as FirmRecord;
    if (!firm) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Firm not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Add user to firm
    firm.adminUsers.push({
      auth0UserId,
      role,
      addedAt: new Date().toISOString()
    });
    
    // Update firm record
    await this.state.storage.put(`firm:${firmId}`, firm);
    
    console.log(`✅ User ${auth0UserId} linked to firm ${firmId}`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'User linked to firm successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async getFirm(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const firmId = url.searchParams.get('firmId');
    
    if (!firmId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'firmId parameter required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const firm = await this.state.storage.get(`firm:${firmId}`) as FirmRecord;
    
    if (!firm) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Firm not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      firm
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async listFirms(): Promise<Response> {
    const firms: FirmRecord[] = [];
    
    // Get all firm records
    const list = await this.state.storage.list({ prefix: 'firm:' });
    for (const [key, firm] of list) {
      firms.push(firm as FirmRecord);
    }
    
    return new Response(JSON.stringify({
      success: true,
      firms,
      count: firms.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async updateFirm(request: Request): Promise<Response> {
    const { firmId, updates } = await request.json();
    
    const firm = await this.state.storage.get(`firm:${firmId}`) as FirmRecord;
    if (!firm) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Firm not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Apply updates
    const updatedFirm = { ...firm, ...updates };
    await this.state.storage.put(`firm:${firmId}`, updatedFirm);
    
    return new Response(JSON.stringify({
      success: true,
      firm: updatedFirm
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private generateULID(): string {
    // Simple ULID-like ID generator
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 10);
    return `firm_${timestamp}_${randomPart}`;
  }
}

// Export for Cloudflare Workers
export default FirmRegistry;