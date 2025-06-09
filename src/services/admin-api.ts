// Admin API Service - Enhanced API endpoints for firm management
// Implements comprehensive admin functionality for Engage

/// <reference types="@cloudflare/workers-types" />

import { 
  Firm, 
  FirmUser,
  AdminPermissions,
  FirmRole,
  Address,
  Env 
} from '@/types/shared';
import { createLogger } from '@/utils/logger';
import { 
  FirmNotFoundError, 
  UnauthorizedAccessError,
  InvalidFirmDataError,
  EngageError 
} from '@/utils/errors';

const logger = createLogger('AdminAPI');

// Enhanced admin API handlers
export class AdminAPIService {
  
  // Get detailed firm information with computed fields
  static async getFirmDetails(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const firmId = url.pathname.split('/')[4]; // /api/admin/firms/{firmId}
      
      // Get auth context
      const authContext = this.extractAuthContext(request);
      if (!authContext) {
        throw new UnauthorizedAccessError('Authentication required');
      }
      
      // Get firm from registry
      const registryId = env.FIRM_REGISTRY.idFromName('global');
      const registry = env.FIRM_REGISTRY.get(registryId);
      const firmResponse = await registry.fetch(new Request(`http://internal/firm/${firmId}`));
      
      if (!firmResponse.ok) {
        throw new FirmNotFoundError(`Firm ${firmId} not found`);
      }
      
      const firm = await firmResponse.json() as Firm;
      
      // Validate user has access to this firm
      await this.validateFirmAccess(authContext, firmId, env);
      
      // Calculate enhanced details
      const setupCompletePercentage = this.calculateSetupCompletion(firm);
      const activeUsers = firm.users.filter(u => u.isActive).length;
      
      // Get usage data (placeholder - would integrate with analytics service)
      const usage = {
        conversations: 0, // TODO: Get from analytics service
        monthlyLimit: firm.subscription.monthlyConversationLimit,
        utilizationPercentage: 0,
        overageCharges: 0
      };
      
      // Check system status (placeholder - would integrate with health checks)
      const systemStatus = {
        vectorizeIndexes: 'healthy' as const,
        encryptionKeys: 'active' as const,
        domainStatus: firm.domain ? 'active' as const : 'active' as const
      };
      
      const response = {
        ...firm,
        setupCompletePercentage,
        activeUsers,
        usage,
        systemStatus
      };
      
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      logger.error('Get firm details failed', { error: error.message });
      return this.handleError(error);
    }
  }
  
  // Update firm profile with validation
  static async updateFirm(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const firmId = url.pathname.split('/')[4]; // /api/admin/firms/{firmId}
      
      // Get auth context and validate permissions
      const authContext = this.extractAuthContext(request);
      if (!authContext) {
        throw new UnauthorizedAccessError('Authentication required');
      }
      
      // Parse update request
      const updateData = await request.json() as {
        name?: string;
        contactEmail?: string;
        contactPhone?: string;
        website?: string;
        address?: Address;
        slug?: string;
        domain?: string;
        branding?: any;
        practiceAreas?: string[];
        restrictions?: string[];
        compliance?: any;
        subscription?: any;
      };
      
      // Validate specific permissions for different update types
      if (updateData.subscription) {
        if (!authContext.permissions.canManageBilling) {
          throw new UnauthorizedAccessError('Billing management permission required');
        }
      }
      
      if (updateData.branding) {
        if (!authContext.permissions.canManageBranding) {
          throw new UnauthorizedAccessError('Branding management permission required');
        }
      }
      
      if (updateData.compliance) {
        if (!authContext.permissions.canManageCompliance) {
          throw new UnauthorizedAccessError('Compliance management permission required');
        }
      }
      
      // Update firm via registry
      const registryId = env.FIRM_REGISTRY.idFromName('global');
      const registry = env.FIRM_REGISTRY.get(registryId);
      
      const updateRequest = new Request(`http://internal/firm/${firmId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const updateResponse = await registry.fetch(updateRequest);
      
      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new EngageError(errorData.message || 'Update failed', errorData.error, updateResponse.status);
      }
      
      const result = await updateResponse.json();
      
      logger.info('Firm updated successfully', {
        firmId,
        updatedBy: authContext.auth0UserId,
        updatedFields: Object.keys(updateData)
      });
      
      return new Response(JSON.stringify({
        success: true,
        updatedFields: Object.keys(updateData),
        ...result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      logger.error('Update firm failed', { error: error.message });
      return this.handleError(error);
    }
  }
  
  // List firm users with status and activity
  static async getFirmUsers(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const firmId = url.pathname.split('/')[4]; // /api/admin/firms/{firmId}/users
      
      // Get auth context and validate permissions
      const authContext = this.extractAuthContext(request);
      if (!authContext) {
        throw new UnauthorizedAccessError('Authentication required');
      }
      
      await this.validateFirmAccess(authContext, firmId, env);
      
      // Get firm data
      const registryId = env.FIRM_REGISTRY.idFromName('global');
      const registry = env.FIRM_REGISTRY.get(registryId);
      const firmResponse = await registry.fetch(new Request(`http://internal/firm/${firmId}`));
      
      if (!firmResponse.ok) {
        throw new FirmNotFoundError(`Firm ${firmId} not found`);
      }
      
      const firm = await firmResponse.json() as Firm;
      
      // Enhance user data with activity information
      const enhancedUsers = firm.users.map(user => ({
        ...user,
        lastLogin: undefined, // TODO: Get from analytics service
        lastActivity: undefined, // TODO: Get from analytics service
        conversationsCount: 0, // TODO: Get from analytics service
        status: user.isActive ? 'active' as const : 'suspended' as const
      }));
      
      // TODO: Get pending invitations from invitation service
      const invitations = [];
      
      return new Response(JSON.stringify({
        users: enhancedUsers,
        invitations
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      logger.error('Get firm users failed', { error: error.message });
      return this.handleError(error);
    }
  }
  
  // Add user to firm
  static async addFirmUser(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const firmId = url.pathname.split('/')[4]; // /api/admin/firms/{firmId}/users
      
      // Get auth context and validate permissions
      const authContext = this.extractAuthContext(request);
      if (!authContext) {
        throw new UnauthorizedAccessError('Authentication required');
      }
      
      if (!authContext.permissions.canManageUsers) {
        throw new UnauthorizedAccessError('User management permission required');
      }
      
      await this.validateFirmAccess(authContext, firmId, env);
      
      // Parse request
      const userData = await request.json() as {
        email: string;
        role: FirmRole;
        auth0UserId?: string;
        name?: string;
        customMessage?: string;
        permissions?: Partial<AdminPermissions>;
      };
      
      // Validate input
      if (!userData.email || !userData.role) {
        throw new InvalidFirmDataError('Email and role are required');
      }
      
      // Create new user
      const newUser: FirmUser = {
        auth0UserId: userData.auth0UserId || '', // Will be set when user accepts invitation
        email: userData.email,
        name: userData.name || '',
        role: userData.role,
        permissions: userData.permissions || this.getDefaultPermissions(userData.role),
        addedAt: new Date(),
        isActive: true
      };
      
      // Add user via registry
      const registryId = env.FIRM_REGISTRY.idFromName('global');
      const registry = env.FIRM_REGISTRY.get(registryId);
      
      const addUserRequest = new Request(`http://internal/firm/${firmId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      
      const addResponse = await registry.fetch(addUserRequest);
      
      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        throw new EngageError(errorData.message || 'Add user failed', errorData.error, addResponse.status);
      }
      
      logger.info('User added to firm', {
        firmId,
        newUserEmail: userData.email,
        role: userData.role,
        addedBy: authContext.auth0UserId
      });
      
      // For existing Auth0 users
      if (userData.auth0UserId) {
        return new Response(JSON.stringify({
          success: true,
          userAdded: {
            auth0UserId: userData.auth0UserId,
            role: userData.role,
            permissions: newUser.permissions
          }
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // For new users - send invitation
      // TODO: Integrate with invitation service
      const invitationId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const invitationUrl = `https://engage.lexara.com/invite/${invitationId}`;
      
      return new Response(JSON.stringify({
        success: true,
        invitationSent: {
          email: userData.email,
          invitationId,
          expiresAt: expiresAt.toISOString(),
          invitationUrl
        }
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      logger.error('Add firm user failed', { error: error.message });
      return this.handleError(error);
    }
  }
  
  // Helper methods
  private static extractAuthContext(request: Request) {
    const auth0UserId = request.headers.get('x-auth0-user-id');
    const email = request.headers.get('x-user-email');
    const role = request.headers.get('x-user-role') as FirmRole;
    const firmId = request.headers.get('x-firm-id');
    
    if (!auth0UserId || !email || !role || !firmId) {
      return null;
    }
    
    const permissions = this.getDefaultPermissions(role);
    
    return { auth0UserId, email, role, firmId, permissions };
  }
  
  private static getDefaultPermissions(role: FirmRole): AdminPermissions {
    const permissionMatrix = {
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
    
    return permissionMatrix[role] || permissionMatrix.viewer;
  }
  
  private static async validateFirmAccess(
    authContext: any, 
    firmId: string, 
    env: Env
  ): Promise<void> {
    // TODO: Validate user belongs to firm
    // For now, trust the headers (would be validated by auth middleware)
    if (authContext.firmId !== firmId) {
      throw new UnauthorizedAccessError('Access denied to firm');
    }
  }
  
  private static calculateSetupCompletion(firm: Firm): number {
    let completedSteps = 0;
    const totalSteps = 4;
    
    if (firm.practiceAreas.length > 0) completedSteps++;
    if (firm.supportingDocuments.length > 0) completedSteps++;
    if (firm.isActive) completedSteps++; // Assume conflict DB setup if active
    completedSteps++; // Branding always complete with defaults
    
    return Math.round((completedSteps / totalSteps) * 100);
  }
  
  private static handleError(error: any): Response {
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
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}