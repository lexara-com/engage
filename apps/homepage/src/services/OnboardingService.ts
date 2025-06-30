/**
 * Onboarding Service - Enterprise Authorization System
 * 
 * Handles user registration and firm creation with proper first-user-as-admin logic.
 * Integrates simplified Auth0 (authentication) with database (authorization).
 * 
 * This replaces the scattered onboarding logic with a centralized service.
 */

import { createSimpleAuth0Client, type CreateUserRequest as Auth0CreateRequest } from '../utils/auth0-simple.js';
import { PermissionService } from './PermissionService.js';
import type { 
  DatabaseClient, 
  Firm, 
  User, 
  CreateEntity 
} from '../db/types.js';

export interface FirmSignupRequest {
  firmName: string;
  domain: string;
  plan?: 'starter' | 'professional' | 'enterprise';
  adminEmail: string;
  adminFirstName?: string;
  adminLastName?: string;
}

export interface UserInviteRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'user';
  firmId: string;
  invitedByUserId: string;
}

export interface OnboardingResult {
  firm: Firm;
  user: User;
  auth0Id: string;
  isFirstAdmin: boolean;
}

export class OnboardingService {
  private db: DatabaseClient;
  private permissionService: PermissionService;
  private env: any;

  constructor(database: DatabaseClient, env: any) {
    this.db = database;
    this.permissionService = new PermissionService(database);
    this.env = env;
  }

  /**
   * Complete firm signup with first admin user
   */
  async signupFirm(request: FirmSignupRequest): Promise<OnboardingResult> {
    console.log(`🏢 Starting firm signup: ${request.firmName} (${request.domain})`);

    // Validate that firm domain doesn't already exist
    const existingFirm = await this.db.getFirmByDomain(request.domain);
    if (existingFirm) {
      throw new Error(`A firm with domain ${request.domain} already exists`);
    }

    // Create Auth0 client
    const auth0Client = createSimpleAuth0Client(this.env);

    // Check if email already exists in Auth0
    const emailExists = await auth0Client.checkEmailExists(request.adminEmail);
    if (emailExists) {
      throw new Error(`A user with email ${request.adminEmail} already exists`);
    }

    try {
      // 1. Create firm in database
      const firm = await this.db.createFirm({
        name: request.firmName,
        domain: request.domain,
        plan: request.plan || 'starter',
        status: 'active',
        settings: {
          allowUserInvites: true,
          requireEmailVerification: true,
          sessionTimeout: 60 * 24 // 24 hours
        }
      });

      console.log(`✅ Firm created: ${firm.id}`);

      // 2. Create user in Auth0 (authentication only)
      const auth0User = await auth0Client.createUser({
        email: request.adminEmail,
        firstName: request.adminFirstName,
        lastName: request.adminLastName
      });

      console.log(`✅ Auth0 user created: ${auth0User.user_id}`);

      // 3. Create user in database with admin role (since they're first user)
      const user = await this.db.createUser({
        auth0_id: auth0User.user_id,
        firm_id: firm.id,
        email: request.adminEmail,
        first_name: request.adminFirstName,
        last_name: request.adminLastName,
        role: 'admin', // First user is automatically admin
        status: auth0User.email_verified ? 'active' : 'pending',
        permissions: {
          canManageUsers: true,
          canViewSettings: true,
          canManageFirm: true,
          canViewAnalytics: true,
          canManageIntegrations: true
        }
      });

      console.log(`✅ Database user created: ${user.id} (admin)`);

      // 4. Log the firm creation and admin assignment
      await this.db.logAudit({
        user_id: user.id,
        firm_id: firm.id,
        action: 'firm_created',
        details: {
          firmName: firm.name,
          domain: firm.domain,
          plan: firm.plan,
          firstAdmin: user.email
        }
      });

      await this.db.logAudit({
        user_id: user.id,
        firm_id: firm.id,
        action: 'user_created',
        target_user_id: user.id,
        details: {
          email: user.email,
          role: user.role,
          isFirstAdmin: true
        }
      });

      console.log(`🎉 Firm signup completed: ${firm.name}`);

      return {
        firm,
        user,
        auth0Id: auth0User.user_id,
        isFirstAdmin: true
      };

    } catch (error) {
      console.error('❌ Firm signup failed:', error);
      
      // TODO: Implement cleanup logic if needed
      // - Delete created firm
      // - Delete created Auth0 user
      
      throw error;
    }
  }

  /**
   * Invite a new user to an existing firm
   */
  async inviteUser(request: UserInviteRequest): Promise<User> {
    console.log(`👤 Inviting user: ${request.email} as ${request.role} to firm ${request.firmId}`);

    // Validate the inviting user has permission
    const permissionResult = await this.permissionService.validatePermission(
      request.invitedByUserId,
      'invite_user',
      request.firmId
    );

    if (!permissionResult.allowed) {
      throw new Error(`Permission denied: ${permissionResult.reason}`);
    }

    const { user: invitingUser, firm } = permissionResult;

    // Check if email already exists in the firm
    const existingUser = await this.db.getUserByEmail(request.email, request.firmId);
    if (existingUser) {
      throw new Error(`User with email ${request.email} already exists in this firm`);
    }

    // Create Auth0 client
    const auth0Client = createSimpleAuth0Client(this.env);

    try {
      // 1. Check if user already exists in Auth0
      let auth0User = await auth0Client.getUserByEmail(request.email);
      
      if (!auth0User) {
        // Create new Auth0 user if they don't exist
        auth0User = await auth0Client.createUser({
          email: request.email,
          firstName: request.firstName,
          lastName: request.lastName
        });
        console.log(`✅ New Auth0 user created: ${auth0User.user_id}`);
      } else {
        console.log(`✅ Existing Auth0 user found: ${auth0User.user_id}`);
      }

      // 2. Get role-based permissions
      const permissions = this.getRolePermissions(request.role);

      // 3. Create user in database
      const user = await this.db.createUser({
        auth0_id: auth0User.user_id,
        firm_id: request.firmId,
        email: request.email,
        first_name: request.firstName,
        last_name: request.lastName,
        role: request.role,
        status: auth0User.email_verified ? 'active' : 'pending',
        permissions,
        invited_by: request.invitedByUserId
      });

      console.log(`✅ Database user created: ${user.id} (${user.role})`);

      // 4. Log the invitation
      await this.db.logAudit({
        user_id: request.invitedByUserId,
        firm_id: request.firmId,
        action: 'user_invited',
        target_user_id: user.id,
        details: {
          email: user.email,
          role: user.role,
          invitedBy: invitingUser.email,
          firmName: firm.name
        }
      });

      console.log(`🎉 User invitation completed: ${request.email}`);

      return user;

    } catch (error) {
      console.error('❌ User invitation failed:', error);
      throw error;
    }
  }

  /**
   * Handle user login and ensure database sync
   */
  async handleUserLogin(auth0UserId: string): Promise<User | null> {
    console.log(`🔐 Handling login for Auth0 user: ${auth0UserId}`);

    // Check if user exists in our database
    let user = await this.db.getUserByAuth0Id(auth0UserId);
    
    if (!user) {
      console.log(`⚠️ User not found in database: ${auth0UserId}`);
      
      // Get user from Auth0 to check if they exist there
      const auth0Client = createSimpleAuth0Client(this.env);
      try {
        const auth0User = await auth0Client.getUser(auth0UserId);
        console.log(`ℹ️ User exists in Auth0 but not in database: ${auth0User.email}`);
        
        // This user exists in Auth0 but not in our database
        // They might be from the old system - handle migration
        // For now, return null to force them through proper onboarding
        return null;
        
      } catch (error) {
        console.log(`❌ User not found in Auth0 either: ${auth0UserId}`);
        return null;
      }
    }

    // Update last login time
    await this.db.updateUser(user.id, {
      last_login: Math.floor(Date.now() / 1000)
    });

    console.log(`✅ Login handled for user: ${user.email}`);
    return user;
  }

  /**
   * Get default permissions for a role
   */
  private getRolePermissions(role: 'admin' | 'user') {
    switch (role) {
      case 'admin':
        return {
          canManageUsers: true,
          canViewSettings: true,
          canManageFirm: true,
          canViewAnalytics: true,
          canManageIntegrations: true
        };
      
      case 'user':
        return {
          canManageUsers: false,
          canViewSettings: true,
          canManageFirm: false,
          canViewAnalytics: false,
          canManageIntegrations: false
        };
      
      default:
        return {};
    }
  }

  /**
   * Convert existing Auth0 user to database user (migration helper)
   */
  async migrateAuth0User(auth0UserId: string, firmId: string, role: 'admin' | 'user' = 'user'): Promise<User> {
    console.log(`🔄 Migrating Auth0 user to database: ${auth0UserId}`);

    const auth0Client = createSimpleAuth0Client(this.env);
    const auth0User = await auth0Client.getUser(auth0UserId);

    const permissions = this.getRolePermissions(role);

    const user = await this.db.createUser({
      auth0_id: auth0User.user_id,
      firm_id: firmId,
      email: auth0User.email,
      first_name: undefined, // Extract from name if needed
      last_name: undefined,
      role,
      status: auth0User.email_verified ? 'active' : 'pending',
      permissions
    });

    await this.db.logAudit({
      user_id: user.id,
      firm_id: firmId,
      action: 'user_migrated',
      target_user_id: user.id,
      details: {
        auth0Id: auth0UserId,
        email: user.email,
        role: user.role,
        migratedFrom: 'auth0_metadata'
      }
    });

    console.log(`✅ User migrated: ${user.email}`);
    return user;
  }

  /**
   * Health check for the onboarding service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const dbHealthy = await this.db.healthCheck();
      const permissionHealthy = await this.permissionService.healthCheck();
      
      return dbHealthy && permissionHealthy;
    } catch {
      return false;
    }
  }
}

// Factory function to create onboarding service
export function createOnboardingService(database: DatabaseClient, env: any): OnboardingService {
  return new OnboardingService(database, env);
}