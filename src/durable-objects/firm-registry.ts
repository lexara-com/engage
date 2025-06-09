// FirmRegistry Durable Object - Central registry for all law firms
// Single global instance manages firm lookup, domain routing, and registration

/// <reference types="@cloudflare/workers-types" />

import { 
  Firm, 
  FirmContext, 
  FirmBranding,
  FirmCompliance,
  FirmSubscription,
  FirmUser,
  AdminPermissions,
  Env 
} from '@/types/shared';
import { generateSessionId } from '@/utils/ulid';
import { createLogger } from '@/utils/logger';
import { 
  FirmNotFoundError, 
  DuplicateFirmError, 
  InvalidFirmDataError,
  EngageError 
} from '@/utils/errors';

interface FirmRegistryState {
  firms: Record<string, Firm>;           // firmId -> Firm
  slugToFirmId: Record<string, string>;  // slug -> firmId  
  domainToFirmId: Record<string, string>; // domain -> firmId
  lastUpdated: Date;
}

export class FirmRegistry implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private registryState: FirmRegistryState | null = null;
  private logger = createLogger('FirmRegistry');

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // Initialize registry state from storage
  private async initializeState(): Promise<void> {
    if (this.registryState === null) {
      const stored = await this.state.storage.get<FirmRegistryState>('registry');
      this.registryState = stored || {
        firms: {},
        slugToFirmId: {},
        domainToFirmId: {},
        lastUpdated: new Date()
      };
    }
  }

  // Save state to storage
  private async saveState(): Promise<void> {
    if (this.registryState) {
      this.registryState.lastUpdated = new Date();
      await this.state.storage.put('registry', this.registryState);
    }
  }

  // Create default firm configuration for new firms
  private createDefaultFirmConfig(): Partial<Firm> {
    return {
      branding: {
        primaryColor: '#1e40af',     // Professional blue
        secondaryColor: '#64748b',   // Slate gray
        fontFamily: 'Inter, sans-serif'
      },
      practiceAreas: [],
      restrictions: [],
      supportingDocuments: [],
      subscription: {
        tier: 'starter',
        status: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        monthlyConversationLimit: 50,
        currentUsage: 0
      },
      compliance: {
        hipaaEnabled: true,
        retentionPolicyDays: 365,
        allowAnonymousChats: true,
        requireAuth0Login: false,
        enableConflictChecking: true
      },
      users: [],
      isActive: true
    };
  }

  // Validate firm data before registration
  private validateFirmData(firmData: Partial<Firm>): void {
    if (!firmData.name?.trim()) {
      throw new InvalidFirmDataError('Firm name is required');
    }
    if (!firmData.contactEmail?.includes('@')) {
      throw new InvalidFirmDataError('Valid contact email is required');
    }
    if (!firmData.slug?.match(/^[a-z0-9-]+$/)) {
      throw new InvalidFirmDataError('Slug must contain only lowercase letters, numbers, and hyphens');
    }
  }

  // Generate unique slug from firm name
  private generateSlug(firmName: string): string {
    return firmName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')         // Replace spaces with hyphens
      .replace(/-+/g, '-')          // Collapse multiple hyphens
      .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens
  }

  // Register a new law firm
  async registerFirm(firmData: Partial<Firm>): Promise<string> {
    await this.initializeState();
    this.logger.info('Registering new firm', { name: firmData.name });

    // Validate required fields
    this.validateFirmData(firmData);

    const firmId = generateSessionId(); // Use ULID for firmId
    const slug = firmData.slug || this.generateSlug(firmData.name!);

    // Check for duplicate slug
    if (this.registryState!.slugToFirmId[slug]) {
      throw new DuplicateFirmError(`Firm slug '${slug}' already exists`);
    }

    // Check for duplicate domain
    if (firmData.domain && this.registryState!.domainToFirmId[firmData.domain]) {
      throw new DuplicateFirmError(`Domain '${firmData.domain}' already registered`);
    }

    // Create default admin permissions
    const defaultAdminPermissions: AdminPermissions = {
      canManageUsers: true,
      canManageConflicts: true,
      canViewAnalytics: true,
      canManageBilling: true,
      canManageBranding: true,
      canManageCompliance: true
    };

    // Create firm with defaults
    const firm: Firm = {
      firmId,
      name: firmData.name!,
      slug,
      contactEmail: firmData.contactEmail!,
      createdAt: new Date(),
      lastActive: new Date(),
      ...this.createDefaultFirmConfig(),
      ...firmData, // Override with provided data
    } as Firm;

    // Store firm
    this.registryState!.firms[firmId] = firm;
    this.registryState!.slugToFirmId[slug] = firmId;
    if (firm.domain) {
      this.registryState!.domainToFirmId[firm.domain] = firmId;
    }

    await this.saveState();

    this.logger.info('Firm registered successfully', { 
      firmId, 
      slug, 
      name: firm.name,
      tier: firm.subscription.tier 
    });

    return firmId;
  }

  // Get firm by firmId
  async getFirm(firmId: string): Promise<Firm | null> {
    await this.initializeState();
    return this.registryState!.firms[firmId] || null;
  }

  // Get firm by slug (subdomain)
  async getFirmBySlug(slug: string): Promise<Firm | null> {
    await this.initializeState();
    const firmId = this.registryState!.slugToFirmId[slug];
    return firmId ? this.registryState!.firms[firmId] : null;
  }

  // Get firm by custom domain
  async getFirmByDomain(domain: string): Promise<Firm | null> {
    await this.initializeState();
    const firmId = this.registryState!.domainToFirmId[domain];
    return firmId ? this.registryState!.firms[firmId] : null;
  }

  // Update firm configuration
  async updateFirm(firmId: string, updates: Partial<Firm>): Promise<void> {
    await this.initializeState();
    
    const firm = this.registryState!.firms[firmId];
    if (!firm) {
      throw new FirmNotFoundError(`Firm ${firmId} not found`);
    }

    // Handle slug changes
    if (updates.slug && updates.slug !== firm.slug) {
      if (this.registryState!.slugToFirmId[updates.slug]) {
        throw new DuplicateFirmError(`Slug '${updates.slug}' already exists`);
      }
      // Remove old slug mapping
      delete this.registryState!.slugToFirmId[firm.slug];
      this.registryState!.slugToFirmId[updates.slug] = firmId;
    }

    // Handle domain changes
    if (updates.domain !== firm.domain) {
      if (updates.domain && this.registryState!.domainToFirmId[updates.domain]) {
        throw new DuplicateFirmError(`Domain '${updates.domain}' already registered`);
      }
      // Remove old domain mapping
      if (firm.domain) {
        delete this.registryState!.domainToFirmId[firm.domain];
      }
      // Add new domain mapping
      if (updates.domain) {
        this.registryState!.domainToFirmId[updates.domain] = firmId;
      }
    }

    // Update firm data
    Object.assign(firm, updates, { lastActive: new Date() });
    await this.saveState();

    this.logger.info('Firm updated', { firmId, updates: Object.keys(updates) });
  }

  // Add user to firm
  async addUser(firmId: string, user: FirmUser): Promise<void> {
    await this.initializeState();
    
    const firm = this.registryState!.firms[firmId];
    if (!firm) {
      throw new FirmNotFoundError(`Firm ${firmId} not found`);
    }

    // Check if user already exists
    const existingUserIndex = firm.users.findIndex(u => u.auth0UserId === user.auth0UserId);
    if (existingUserIndex >= 0) {
      // Update existing user
      firm.users[existingUserIndex] = { ...firm.users[existingUserIndex], ...user };
    } else {
      // Add new user
      firm.users.push(user);
    }

    await this.saveState();
    this.logger.info('User added to firm', { firmId, userEmail: user.email, role: user.role });
  }

  // Remove user from firm
  async removeUser(firmId: string, auth0UserId: string): Promise<void> {
    await this.initializeState();
    
    const firm = this.registryState!.firms[firmId];
    if (!firm) {
      throw new FirmNotFoundError(`Firm ${firmId} not found`);
    }

    firm.users = firm.users.filter(u => u.auth0UserId !== auth0UserId);
    await this.saveState();
    
    this.logger.info('User removed from firm', { firmId, auth0UserId });
  }

  // List all active firms (for admin purposes)
  async listActiveFirms(): Promise<Firm[]> {
    await this.initializeState();
    return Object.values(this.registryState!.firms).filter(firm => firm.isActive);
  }

  // Get registry statistics
  async getStats(): Promise<{
    totalFirms: number;
    activeFirms: number;
    trialFirms: number;
    paidFirms: number;
  }> {
    await this.initializeState();
    const firms = Object.values(this.registryState!.firms);
    
    return {
      totalFirms: firms.length,
      activeFirms: firms.filter(f => f.isActive).length,
      trialFirms: firms.filter(f => f.subscription.status === 'trial').length,
      paidFirms: firms.filter(f => f.subscription.status === 'active').length,
    };
  }

  // Handle HTTP requests
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Route API calls
      if (method === 'POST' && path === '/register') {
        const firmData = await request.json() as Partial<Firm>;
        const firmId = await this.registerFirm(firmData);
        return new Response(JSON.stringify({ firmId, success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (method === 'GET' && path.startsWith('/firm/')) {
        const firmId = path.split('/')[2];
        const firm = await this.getFirm(firmId);
        if (!firm) {
          return new Response('Firm not found', { status: 404 });
        }
        return new Response(JSON.stringify(firm), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (method === 'GET' && path.startsWith('/slug/')) {
        const slug = path.split('/')[2];
        const firm = await this.getFirmBySlug(slug);
        if (!firm) {
          return new Response('Firm not found', { status: 404 });
        }
        return new Response(JSON.stringify(firm), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (method === 'GET' && path.startsWith('/domain/')) {
        const domain = path.split('/')[2];
        const firm = await this.getFirmByDomain(domain);
        if (!firm) {
          return new Response('Firm not found', { status: 404 });
        }
        return new Response(JSON.stringify(firm), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (method === 'GET' && path === '/stats') {
        const stats = await this.getStats();
        return new Response(JSON.stringify(stats), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not found', { status: 404 });

    } catch (error) {
      this.logger.error('FirmRegistry request failed', { error: error.message });
      
      if (error instanceof EngageError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Internal server error', { status: 500 });
    }
  }
}