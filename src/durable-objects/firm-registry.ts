// Enhanced FirmRegistry Durable Object - Commercial-grade firm management
// Central registry for all law firms with comprehensive admin API

/// <reference types="@cloudflare/workers-types" />

import { 
  Firm, 
  FirmContext, 
  FirmBranding,
  FirmCompliance,
  FirmSubscription,
  FirmUser,
  AdminPermissions,
  FirmRole,
  SubscriptionTier,
  SubscriptionStatus,
  Address,
  Env 
} from '@/types/shared';
import { generateSessionId } from '@/utils/ulid';
import { createLogger } from '@/utils/logger';
import { 
  FirmNotFoundError, 
  DuplicateFirmError, 
  InvalidFirmDataError,
  UnauthorizedAccessError,
  EngageError 
} from '@/utils/errors';

// Enhanced registry state with additional indexes
interface FirmRegistryState {
  firms: Record<string, Firm>;           // firmId -> Firm
  slugToFirmId: Record<string, string>;  // slug -> firmId  
  domainToFirmId: Record<string, string>; // domain -> firmId
  emailToFirmId: Record<string, string>; // contactEmail -> firmId (for lookups)
  userToFirmIds: Record<string, string[]>; // auth0UserId -> firmId[] (multi-firm users)
  lastUpdated: Date;
  totalFirms: number;
  activeFirms: number;
}

// API request/response interfaces
interface FirmRegistrationRequest {
  // Required fields
  name: string;
  contactEmail: string;
  
  // Optional fields
  slug?: string;
  domain?: string;
  contactPhone?: string;
  website?: string;
  address?: Address;
  practiceAreas?: string[];
  subscriptionTier?: SubscriptionTier;
  
  // Initial admin user
  adminUser: {
    auth0UserId: string;
    email: string;
    name: string;
  };
}

interface FirmRegistrationResponse {
  firmId: string;
  slug: string;
  subdomain: string;
  trialEndsAt: string;
  dashboardUrl: string;
  setupRequired: {
    practiceAreas: boolean;
    supportingDocuments: boolean;
    conflictDatabase: boolean;
    branding: boolean;
  };
}

interface FirmDetailsResponse extends Firm {
  setupCompletePercentage: number;
  lastLoginAt?: string;
  activeUsers: number;
  usage: {
    conversations: number;
    monthlyLimit: number;
    utilizationPercentage: number;
    overageCharges?: number;
  };
  systemStatus: {
    vectorizeIndexes: 'healthy' | 'initializing' | 'error';
    encryptionKeys: 'active' | 'rotation_needed' | 'error';
    domainStatus: 'active' | 'pending_verification' | 'error';
  };
}

interface FirmUpdateRequest {
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: Address;
  slug?: string;
  domain?: string;
  branding?: Partial<FirmBranding>;
  practiceAreas?: string[];
  restrictions?: string[];
  compliance?: Partial<FirmCompliance>;
  subscription?: Partial<FirmSubscription>;
}

// Authentication context
interface AuthContext {
  auth0UserId: string;
  email: string;
  role: FirmRole;
  firmId: string;
  permissions: AdminPermissions;
}

// Validation constants
const FIRM_VALIDATION = {
  name: {
    minLength: 2,
    maxLength: 100,
    pattern: /^[A-Za-z0-9\s&.,'-]+$/,
  },
  slug: {
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-z0-9-]+$/,
    reserved: ['admin', 'api', 'www', 'mail', 'ftp', 'support', 'help'],
  },
  contactEmail: {
    pattern: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/,
  },
  domain: {
    pattern: /^[a-z0-9.-]+\.[a-z]{2,}$/,
    blacklist: ['engage.lexara.com', 'lexara.com'],
  }
};

// Permission matrix
const PERMISSION_MATRIX: Record<FirmRole, AdminPermissions> = {
  admin: {
    canManageUsers: true,
    canManageConflicts: true,
    canViewAnalytics: true,
    canManageBilling: true,
    canManageBranding: true,
    canManageCompliance: true,
  },
  lawyer: {
    canManageUsers: false,
    canManageConflicts: true,
    canViewAnalytics: true,
    canManageBilling: false,
    canManageBranding: false,
    canManageCompliance: true,
  },
  staff: {
    canManageUsers: false,
    canManageConflicts: true,
    canViewAnalytics: false,
    canManageBilling: false,
    canManageBranding: false,
    canManageCompliance: false,
  },
  viewer: {
    canManageUsers: false,
    canManageConflicts: false,
    canViewAnalytics: true,
    canManageBilling: false,
    canManageBranding: false,
    canManageCompliance: false,
  },
};

export class FirmRegistry implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private registryState: FirmRegistryState | null = null;
  private logger = createLogger('FirmRegistry');

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // Initialize enhanced registry state from storage
  private async initializeState(): Promise<void> {
    if (this.registryState === null) {
      const stored = await this.state.storage.get<FirmRegistryState>('registry');
      this.registryState = stored || {
        firms: {},
        slugToFirmId: {},
        domainToFirmId: {},
        emailToFirmId: {},
        userToFirmIds: {},
        lastUpdated: new Date(),
        totalFirms: 0,
        activeFirms: 0
      };
      
      // Migrate existing data if needed
      await this.migrateRegistryData();
    }
  }
  
  // Migrate existing registry data to new format
  private async migrateRegistryData(): Promise<void> {
    if (!this.registryState) return;
    
    let needsMigration = false;
    
    // Add missing indexes
    if (!this.registryState.emailToFirmId) {
      this.registryState.emailToFirmId = {};
      needsMigration = true;
    }
    if (!this.registryState.userToFirmIds) {
      this.registryState.userToFirmIds = {};
      needsMigration = true;
    }
    if (typeof this.registryState.totalFirms === 'undefined') {
      this.registryState.totalFirms = 0;
      needsMigration = true;
    }
    if (typeof this.registryState.activeFirms === 'undefined') {
      this.registryState.activeFirms = 0;
      needsMigration = true;
    }
    
    // Rebuild indexes from existing data
    if (needsMigration) {
      for (const [firmId, firm] of Object.entries(this.registryState.firms)) {
        this.registryState.emailToFirmId[firm.contactEmail] = firmId;
        
        // Build user to firm mapping
        for (const user of firm.users) {
          if (!this.registryState.userToFirmIds[user.auth0UserId]) {
            this.registryState.userToFirmIds[user.auth0UserId] = [];
          }
          if (!this.registryState.userToFirmIds[user.auth0UserId].includes(firmId)) {
            this.registryState.userToFirmIds[user.auth0UserId].push(firmId);
          }
        }
      }
      
      // Update counts
      const firms = Object.values(this.registryState.firms);
      this.registryState.totalFirms = firms.length;
      this.registryState.activeFirms = firms.filter(f => f.isActive).length;
      
      await this.saveState();
      this.logger.info('Registry data migrated successfully', {
        totalFirms: this.registryState.totalFirms,
        activeFirms: this.registryState.activeFirms
      });
    }
  }

  // Save state to storage and update counts
  private async saveState(): Promise<void> {
    if (this.registryState) {
      this.registryState.lastUpdated = new Date();
      
      // Update counts
      const firms = Object.values(this.registryState.firms);
      this.registryState.totalFirms = firms.length;
      this.registryState.activeFirms = firms.filter(f => f.isActive).length;
      
      await this.state.storage.put('registry', this.registryState);
    }
  }
  
  // Extract authentication context from request headers
  private extractAuthContext(request: Request): AuthContext | null {
    const auth0UserId = request.headers.get('x-auth0-user-id');
    const email = request.headers.get('x-user-email');
    const role = request.headers.get('x-user-role') as FirmRole;
    const firmId = request.headers.get('x-firm-id');
    
    if (!auth0UserId || !email || !role || !firmId) {
      return null;
    }
    
    const permissions = PERMISSION_MATRIX[role] || PERMISSION_MATRIX.viewer;
    
    return { auth0UserId, email, role, firmId, permissions };
  }
  
  // Validate user has permission for operation
  private async validatePermission(
    authContext: AuthContext, 
    permission: keyof AdminPermissions,
    targetFirmId?: string
  ): Promise<void> {
    // Check if user belongs to the firm
    if (targetFirmId && authContext.firmId !== targetFirmId) {
      const userFirmIds = this.registryState?.userToFirmIds[authContext.auth0UserId] || [];
      if (!userFirmIds.includes(targetFirmId)) {
        throw new UnauthorizedAccessError('User does not belong to target firm');
      }
    }
    
    // Check permission
    if (!authContext.permissions[permission]) {
      throw new UnauthorizedAccessError(`Permission ${permission} required`);
    }
  }
  
  // Enhanced firm data validation
  private validateFirmRegistration(firmData: FirmRegistrationRequest): void {
    // Name validation
    if (!firmData.name || firmData.name.length < FIRM_VALIDATION.name.minLength) {
      throw new InvalidFirmDataError(`Firm name must be at least ${FIRM_VALIDATION.name.minLength} characters`);
    }
    if (firmData.name.length > FIRM_VALIDATION.name.maxLength) {
      throw new InvalidFirmDataError(`Firm name must be less than ${FIRM_VALIDATION.name.maxLength} characters`);
    }
    if (!FIRM_VALIDATION.name.pattern.test(firmData.name)) {
      throw new InvalidFirmDataError('Firm name contains invalid characters');
    }
    
    // Email validation
    if (!FIRM_VALIDATION.contactEmail.pattern.test(firmData.contactEmail)) {
      throw new InvalidFirmDataError('Invalid contact email format');
    }
    
    // Slug validation
    if (firmData.slug) {
      if (firmData.slug.length < FIRM_VALIDATION.slug.minLength) {
        throw new InvalidFirmDataError(`Slug must be at least ${FIRM_VALIDATION.slug.minLength} characters`);
      }
      if (firmData.slug.length > FIRM_VALIDATION.slug.maxLength) {
        throw new InvalidFirmDataError(`Slug must be less than ${FIRM_VALIDATION.slug.maxLength} characters`);
      }
      if (!FIRM_VALIDATION.slug.pattern.test(firmData.slug)) {
        throw new InvalidFirmDataError('Slug must contain only lowercase letters, numbers, and hyphens');
      }
      if (FIRM_VALIDATION.slug.reserved.includes(firmData.slug)) {
        throw new InvalidFirmDataError(`Slug '${firmData.slug}' is reserved`);
      }
    }
    
    // Domain validation
    if (firmData.domain) {
      if (!FIRM_VALIDATION.domain.pattern.test(firmData.domain)) {
        throw new InvalidFirmDataError('Invalid domain format');
      }
      if (FIRM_VALIDATION.domain.blacklist.includes(firmData.domain)) {
        throw new InvalidFirmDataError(`Domain '${firmData.domain}' is not allowed`);
      }
    }
    
    // Admin user validation
    if (!firmData.adminUser.auth0UserId || !firmData.adminUser.email || !firmData.adminUser.name) {
      throw new InvalidFirmDataError('Admin user information is required');
    }
  }
  
  // Calculate setup completion percentage
  private calculateSetupCompletion(firm: Firm): number {
    let completedSteps = 0;
    const totalSteps = 4;
    
    // Practice areas configured
    if (firm.practiceAreas.length > 0) completedSteps++;
    
    // Supporting documents uploaded
    if (firm.supportingDocuments.length > 0) completedSteps++;
    
    // Conflict database populated (we'll assume it's done if firm is active)
    if (firm.isActive) completedSteps++;
    
    // Branding configured (always true with defaults)
    completedSteps++;
    
    return Math.round((completedSteps / totalSteps) * 100);
  }
  
  // Update all related indexes when firm data changes
  private updateFirmIndexes(firmId: string, oldFirm: Firm | null, newFirm: Firm): void {
    if (!this.registryState) return;
    
    // Update email index
    if (oldFirm && oldFirm.contactEmail !== newFirm.contactEmail) {
      delete this.registryState.emailToFirmId[oldFirm.contactEmail];
    }
    this.registryState.emailToFirmId[newFirm.contactEmail] = firmId;
    
    // Update slug index
    if (oldFirm && oldFirm.slug !== newFirm.slug) {
      delete this.registryState.slugToFirmId[oldFirm.slug];
    }
    this.registryState.slugToFirmId[newFirm.slug] = firmId;
    
    // Update domain index
    if (oldFirm?.domain && oldFirm.domain !== newFirm.domain) {
      delete this.registryState.domainToFirmId[oldFirm.domain];
    }
    if (newFirm.domain) {
      this.registryState.domainToFirmId[newFirm.domain] = firmId;
    }
    
    // Update user index
    const oldUserIds = new Set(oldFirm?.users.map(u => u.auth0UserId) || []);
    const newUserIds = new Set(newFirm.users.map(u => u.auth0UserId));
    
    // Remove users that are no longer in the firm
    for (const userId of oldUserIds) {
      if (!newUserIds.has(userId)) {
        const userFirms = this.registryState.userToFirmIds[userId] || [];
        this.registryState.userToFirmIds[userId] = userFirms.filter(id => id !== firmId);
        if (this.registryState.userToFirmIds[userId].length === 0) {
          delete this.registryState.userToFirmIds[userId];
        }
      }
    }
    
    // Add new users
    for (const userId of newUserIds) {
      if (!oldUserIds.has(userId)) {
        if (!this.registryState.userToFirmIds[userId]) {
          this.registryState.userToFirmIds[userId] = [];
        }
        if (!this.registryState.userToFirmIds[userId].includes(firmId)) {
          this.registryState.userToFirmIds[userId].push(firmId);
        }
      }
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

  // Enhanced firm registration with comprehensive validation
  async registerFirm(request: Request): Promise<Response> {
    await this.initializeState();
    
    try {
      const firmData = await request.json() as FirmRegistrationRequest;
      this.logger.info('Registering new firm', { name: firmData.name });

      // Comprehensive validation
      this.validateFirmRegistration(firmData);

      const firmId = generateSessionId(); // Use ULID for firmId
      const slug = firmData.slug || this.generateSlug(firmData.name);

      // Check for duplicates
      if (this.registryState!.slugToFirmId[slug]) {
        throw new DuplicateFirmError(`Firm slug '${slug}' already exists`);
      }
      if (this.registryState!.emailToFirmId[firmData.contactEmail]) {
        throw new DuplicateFirmError(`Email '${firmData.contactEmail}' already registered`);
      }
      if (firmData.domain && this.registryState!.domainToFirmId[firmData.domain]) {
        throw new DuplicateFirmError(`Domain '${firmData.domain}' already registered`);
      }

      // Create admin user
      const adminUser: FirmUser = {
        auth0UserId: firmData.adminUser.auth0UserId,
        email: firmData.adminUser.email,
        name: firmData.adminUser.name,
        role: 'admin',
        permissions: PERMISSION_MATRIX.admin,
        addedAt: new Date(),
        isActive: true
      };

      // Create firm with enhanced defaults
      const firm: Firm = {
        firmId,
        name: firmData.name,
        slug,
        contactEmail: firmData.contactEmail,
        contactPhone: firmData.contactPhone,
        website: firmData.website,
        address: firmData.address,
        domain: firmData.domain,
        
        // Configuration
        ...this.createDefaultFirmConfig(),
        practiceAreas: firmData.practiceAreas || [],
        
        // Subscription
        subscription: {
          tier: firmData.subscriptionTier || 'starter',
          status: 'trial',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          monthlyConversationLimit: this.getConversationLimit(firmData.subscriptionTier || 'starter'),
          currentUsage: 0
        },
        
        // Users
        users: [adminUser],
        
        // Metadata
        createdAt: new Date(),
        lastActive: new Date(),
        isActive: true
      } as Firm;

      // Store firm and update indexes
      this.registryState!.firms[firmId] = firm;
      this.updateFirmIndexes(firmId, null, firm);

      await this.saveState();

      // Create response
      const subdomain = `${slug}.engage.lexara.com`;
      const dashboardUrl = `https://admin.engage.lexara.com/firms/${firmId}`;
      
      const response: FirmRegistrationResponse = {
        firmId,
        slug,
        subdomain,
        trialEndsAt: firm.subscription.trialEndsAt!.toISOString(),
        dashboardUrl,
        setupRequired: {
          practiceAreas: firm.practiceAreas.length === 0,
          supportingDocuments: firm.supportingDocuments.length === 0,
          conflictDatabase: true, // Always needs initial setup
          branding: false // Defaults provided
        }
      };

      this.logger.info('Firm registered successfully', { 
        firmId, 
        slug, 
        name: firm.name,
        tier: firm.subscription.tier,
        adminUser: adminUser.email
      });

      return new Response(JSON.stringify(response), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      this.logger.error('Firm registration failed', { error: error.message });
      
      if (error instanceof EngageError) {
        return new Response(JSON.stringify({ 
          error: error.code || error.constructor.name,
          message: error.message 
        }), {
          status: error.statusCode || 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        error: 'REGISTRATION_ERROR',
        message: 'Failed to register firm'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Get conversation limit based on subscription tier
  private getConversationLimit(tier: SubscriptionTier): number {
    const limits = {
      starter: 50,
      professional: 200,
      enterprise: 1000
    };
    return limits[tier] || limits.starter;
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