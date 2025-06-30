/**
 * Auth0 Management API Integration Utilities
 * 
 * This module provides utilities for interacting with Auth0's Management API
 * for user management operations including invitation, role management, and user removal.
 */

export interface Auth0User {
  user_id: string;
  email: string;
  name?: string;
  email_verified: boolean;
  created_at: string;
  last_login?: string;
  user_metadata?: {
    firmId?: string;
    role?: 'admin' | 'user';
    firstName?: string;
    lastName?: string;
    invitedBy?: string;
    invitedAt?: string;
  };
  app_metadata?: {
    organization?: string;
    permissions?: string[];
    plan?: string;
  };
}

export interface CreateUserRequest {
  email: string;
  role: 'admin' | 'user';
  firmId: string;
  firstName?: string;
  lastName?: string;
  invitedBy: string;
}

export interface Auth0ManagementConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
}

export class Auth0ManagementClient {
  private config: Auth0ManagementConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: Auth0ManagementConfig) {
    this.config = config;
  }

  /**
   * Force refresh the Management API access token
   */
  async refreshAccessToken(): Promise<string> {
    console.log('🔄 Force refreshing Auth0 Management API token...');
    this.accessToken = null;
    this.tokenExpiry = 0;
    return this.getAccessToken();
  }

  /**
   * Test Auth0 Management API access and scopes
   */
  async testApiAccess(): Promise<any> {
    console.log('🧪 Testing Auth0 Management API access and scopes...');
    
    const results: any = {};
    
    const token = await this.getAccessToken();
    
    // Decode the token to see what scopes we actually have
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1]));
        results.tokenScopes = payload.scope;
        results.tokenAudience = payload.aud;
        results.tokenExpires = new Date(payload.exp * 1000).toISOString();
        console.log('🔍 Token scopes:', payload.scope);
        console.log('🔍 Token audience:', payload.aud);
        console.log('🔍 Token expires:', new Date(payload.exp * 1000));
      } catch (e) {
        results.tokenDecodeError = 'Could not decode token payload';
        console.log('🔍 Could not decode token payload');
      }
    }
    
    // Test basic API access
    try {
      const response = await this.makeRequest('/users?per_page=1');
      results.basicApiAccess = { status: response.status, success: response.ok };
      console.log('✅ Basic API access working:', response.status);
    } catch (e) {
      results.basicApiAccess = { error: e instanceof Error ? e.message : String(e) };
      console.error('❌ Basic API access failed:', e);
    }
    
    // Test specific scope: create:user_tickets
    try {
      const testTicketData = {
        user_id: 'test_user_id_that_does_not_exist',
        result_url: 'https://dev-www.lexara.app/firm/login?invited=true',
        ttl_sec: 300
      };
      
      const response = await this.makeRequest('/tickets/password-change', {
        method: 'POST',
        body: JSON.stringify(testTicketData)
      });
      
      const errorText = await response.text();
      
      if (response.status === 404) {
        results.ticketTest = { status: 404, message: 'create:user_tickets scope is available (got 404 for non-existent user)', success: true };
        console.log('✅ create:user_tickets scope is available (got 404 for non-existent user)');
      } else if (response.status === 403) {
        results.ticketTest = { status: 403, message: 'create:user_tickets scope missing (got 403 Forbidden)', success: false, error: errorText };
        console.error('❌ create:user_tickets scope missing (got 403 Forbidden)');
      } else {
        results.ticketTest = { status: response.status, message: `Unexpected response for ticket test: ${response.status}`, error: errorText };
        console.log(`🔍 Unexpected response for ticket test: ${response.status}`);
        console.log('🔍 Response:', errorText);
      }
    } catch (e) {
      results.ticketTest = { error: e instanceof Error ? e.message : String(e) };
      console.error('❌ Ticket creation test failed:', e);
    }
    
    // Test email configuration
    try {
      const emailSettingsResponse = await this.makeRequest('/emails/provider');
      if (emailSettingsResponse.ok) {
        const emailSettings = await emailSettingsResponse.json();
        results.emailProvider = { configured: true, provider: emailSettings.name };
        console.log('✅ Email provider configured:', emailSettings.name);
      } else {
        const errorText = await emailSettingsResponse.text();
        results.emailProvider = { configured: false, status: emailSettingsResponse.status, error: errorText };
        console.log('❌ No email provider configured:', errorText);
      }
    } catch (e) {
      results.emailProvider = { error: e instanceof Error ? e.message : String(e) };
    }
    
    return results;
  }

  /**
   * Get or refresh the Management API access token
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log('🔑 Getting Auth0 Management API token...');
    
    const tokenResponse = await fetch(`https://${this.config.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        audience: `https://${this.config.domain}/api/v2/`,
        grant_type: 'client_credentials'
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to get Auth0 management token: ${error}`);
    }

    const tokenData = await tokenResponse.json();
    this.accessToken = tokenData.access_token;
    
    // Set expiry to 90% of the actual expiry to ensure renewal before expiration
    this.tokenExpiry = Date.now() + (tokenData.expires_in * 900); // 90% of expires_in seconds
    
    console.log('✅ Auth0 Management API token obtained');
    return this.accessToken;
  }

  /**
   * Make authenticated requests to Auth0 Management API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken();
    
    return fetch(`https://${this.config.domain}/api/v2${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  /**
   * List all users for a specific firm
   */
  async listFirmUsers(firmId: string): Promise<Auth0User[]> {
    console.log(`👥 Listing users for firm: ${firmId}`);
    
    // Use Auth0's search query to filter users by firm (exclude deactivated users)
    const query = encodeURIComponent(`user_metadata.firmId:"${firmId}" AND NOT user_metadata.deactivated:true`);
    const response = await this.makeRequest(`/users?q=${query}&search_engine=v3`);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list firm users: ${error}`);
    }
    
    const users = await response.json();
    
    // Additional client-side filtering to ensure we only get active users
    const activeUsers = users.filter(user => 
      user.user_metadata?.firmId === firmId && 
      !user.user_metadata?.deactivated
    );
    
    console.log(`✅ Found ${activeUsers.length} active users for firm ${firmId} (${users.length} total)`);
    
    return activeUsers;
  }

  /**
   * Get users with optional query parameters
   */
  async getUsers(params?: { per_page?: number; sort?: string; q?: string }): Promise<Auth0User[]> {
    console.log(`👥 Getting users with params:`, params);
    
    const queryParams = new URLSearchParams();
    if (params?.per_page) queryParams.set('per_page', params.per_page.toString());
    if (params?.sort) queryParams.set('sort', params.sort);
    if (params?.q) queryParams.set('q', params.q);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const response = await this.makeRequest(`/users${queryString}`);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get users: ${error}`);
    }
    
    const users = await response.json();
    console.log(`✅ Retrieved ${users.length} users`);
    
    return users;
  }

  /**
   * Get a specific user by ID
   */
  async getUser(userId: string): Promise<Auth0User> {
    console.log(`👤 Getting user: ${userId}`);
    
    const response = await this.makeRequest(`/users/${encodeURIComponent(userId)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found');
      }
      const error = await response.text();
      throw new Error(`Failed to get user: ${error}`);
    }
    
    const user = await response.json();
    console.log(`✅ User retrieved: ${user.email}`);
    
    return user;
  }

  /**
   * Create a new user invitation
   */
  async createUserInvitation(request: CreateUserRequest): Promise<{ user: Auth0User; invitationUrl: string }> {
    console.log(`📧 Creating secure user invitation for: ${request.email}`);
    
    // Step 1: Create user with random temporary password (user will never use this)
    const randomPassword = `SecureTemp${Math.random().toString(36)}${Math.random().toString(36)}!@#${Date.now()}`;
    
    const userData = {
      connection: 'Username-Password-Authentication',
      email: request.email,
      password: randomPassword, // Random password user will never see
      email_verified: false, // Will be verified when they set their password
      verify_email: false,
      name: request.firstName && request.lastName 
        ? `${request.firstName} ${request.lastName}` 
        : request.email,
      user_metadata: {
        firmId: request.firmId,
        role: request.role,
        firstName: request.firstName,
        lastName: request.lastName,
        invitedBy: request.invitedBy,
        invitedAt: new Date().toISOString(),
        invited: true // Flag to indicate this is an invited user
      },
      app_metadata: {
        organization: request.firmId,
        permissions: request.role === 'admin' ? ['firm:admin'] : ['firm:user'],
      }
    };

    const userResponse = await this.makeRequest('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    if (!userResponse.ok) {
      const error = await userResponse.text();
      
      // Handle common errors with user-friendly messages
      if (error.includes('already exists')) {
        throw new Error('A user with this email already exists');
      }
      if (error.includes('password')) {
        throw new Error('Invalid password requirements');
      }
      
      throw new Error(`Failed to create user: ${error}`);
    }

    const newUser = await userResponse.json();
    console.log(`✅ User created: ${newUser.user_id}`);
    
    // Step 2: Immediately create password reset ticket (secure invitation email)
    const baseUrl = globalThis.location?.hostname?.includes('lexara.app') 
      ? (globalThis.location?.hostname?.includes('dev-') ? 'https://dev-www.lexara.app' : 'https://www.lexara.app')
      : 'https://dev-www.lexara.app';
    
    const ticketData = {
      user_id: newUser.user_id,
      result_url: `${baseUrl}/firm/login?invited=true`,
      ttl_sec: 7 * 24 * 60 * 60, // 7 days
      mark_email_as_verified: true, // Mark email as verified when they set password
      includeEmailInRedirect: false // Auth0 flag to control email sending
    };

    console.log(`🎫 Creating password reset ticket for secure invitation: ${request.email}`);

    const ticketResponse = await this.makeRequest('/tickets/password-change', {
      method: 'POST',
      body: JSON.stringify(ticketData)
    });

    if (!ticketResponse.ok) {
      const error = await ticketResponse.text();
      console.error(`❌ Password ticket creation failed:`, {
        status: ticketResponse.status,
        statusText: ticketResponse.statusText,
        error: error,
        userId: newUser.user_id,
        ticketData: ticketData
      });
      
      // If ticket creation fails, return info for manual process
      return { 
        user: newUser, 
        invitationUrl: `MANUAL_INVITE_FAILED:${newUser.email}:Status ${ticketResponse.status}: ${error}` 
      };
    }

    const ticket = await ticketResponse.json();
    console.log(`✅ Password change ticket created:`, ticket);
    
    // Also try to send an email verification ticket as backup
    let emailVerificationResult = null;
    try {
      const emailResponse = await this.makeRequest('/tickets/email-verification', {
        method: 'POST',
        body: JSON.stringify({
          user_id: newUser.user_id,
          result_url: `${baseUrl}/firm/login?invited=true&email_verified=true`
        })
      });
      
      if (emailResponse.ok) {
        emailVerificationResult = await emailResponse.json();
        console.log(`✅ Email verification ticket also created:`, emailVerificationResult);
      } else {
        const emailError = await emailResponse.text();
        console.log(`⚠️ Email verification failed:`, emailError);
      }
    } catch (e) {
      console.log(`⚠️ Email verification error:`, e);
    }
    
    return { 
      user: newUser, 
      invitationUrl: `AUTO_EMAIL_SENT:${ticket.ticket}`,
      passwordTicket: ticket,
      emailVerificationTicket: emailVerificationResult
    };
  }

  /**
   * Send email verification/invitation
   */
  async sendEmailVerification(userId: string): Promise<void> {
    console.log(`📨 Sending email verification for user: ${userId}`);
    
    const response = await this.makeRequest('/tickets/email-verification', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        // TODO: Customize email template and redirect URL
        // result_url: 'https://dev-www.lexara.app/firm/welcome'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn(`⚠️ Failed to send email verification: ${error}`);
      // Don't throw error - user was created successfully, email just failed
    } else {
      console.log('✅ Email verification sent');
    }
  }

  /**
   * Update a user's metadata
   */
  async updateUser(userId: string, userData: Partial<Auth0User>): Promise<Auth0User> {
    console.log(`✏️ Updating user: ${userId}`);
    
    const response = await this.makeRequest(`/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update user: ${error}`);
    }

    const updatedUser = await response.json();
    console.log(`✅ User updated: ${updatedUser.email}`);
    
    return updatedUser;
  }

  /**
   * Remove a user from the firm (deactivate, don't delete)
   */
  async deactivateUser(userId: string, reason: string = 'Removed from firm'): Promise<Auth0User> {
    console.log(`🗑️ Deactivating user: ${userId}`);
    
    // First get the current user to preserve other metadata
    const currentUser = await this.getUser(userId);
    
    const userData = {
      user_metadata: {
        ...currentUser.user_metadata,
        deactivated: true,
        deactivatedAt: new Date().toISOString(),
        deactivationReason: reason,
        firmId: null, // Remove from firm
        originalFirmId: currentUser.user_metadata?.firmId // Keep track of original firm
      },
      blocked: true // Block user login
    };

    return this.updateUser(userId, userData);
  }

  /**
   * Permanently delete a user (use with caution)
   */
  async deleteUser(userId: string): Promise<void> {
    console.log(`❌ Permanently deleting user: ${userId}`);
    
    const response = await this.makeRequest(`/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete user: ${error}`);
    }

    console.log(`✅ User permanently deleted: ${userId}`);
  }

  /**
   * Update user role and metadata
   */
  async updateUserRole(userId: string, role: 'admin' | 'user'): Promise<Auth0User> {
    console.log(`🔄 Updating user role: ${userId} → ${role}`);
    
    const updateData = {
      user_metadata: {
        role: role
      },
      app_metadata: {
        permissions: role === 'admin' ? ['firm:admin'] : ['firm:user']
      }
    };

    const response = await this.makeRequest(`/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update user role: ${error}`);
    }

    const user = await response.json();
    console.log(`✅ User role updated: ${user.email} → ${role}`);
    
    return user;
  }


  /**
   * Check if email already exists in the system
   */
  async checkEmailExists(email: string): Promise<boolean> {
    console.log(`🔍 Checking if email exists: ${email}`);
    
    const query = encodeURIComponent(`email:"${email}"`);
    const response = await this.makeRequest(`/users?q=${query}&search_engine=v3`);
    
    if (!response.ok) {
      console.warn('⚠️ Failed to check email existence, allowing request to proceed');
      return false;
    }
    
    const users = await response.json();
    const exists = users.length > 0;
    
    console.log(`${exists ? '⚠️' : '✅'} Email ${exists ? 'exists' : 'available'}: ${email}`);
    return exists;
  }

  /**
   * Get admin users for a firm (used for last admin validation)
   */
  async getFirmAdmins(firmId: string): Promise<Auth0User[]> {
    console.log(`👑 Getting admin users for firm: ${firmId}`);
    
    const query = encodeURIComponent(`user_metadata.firmId:"${firmId}" AND user_metadata.role:"admin"`);
    const response = await this.makeRequest(`/users?q=${query}&search_engine=v3`);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get firm admins: ${error}`);
    }
    
    const admins = await response.json();
    console.log(`✅ Found ${admins.length} admin(s) for firm ${firmId}`);
    
    return admins;
  }
}

/**
 * Factory function to create Auth0 Management client from environment
 */
export function createAuth0ManagementClient(env: any): Auth0ManagementClient {
  const config: Auth0ManagementConfig = {
    domain: env.AUTH0_DOMAIN,
    clientId: env.AUTH0_CLIENT_ID,
    clientSecret: env.AUTH0_CLIENT_SECRET
  };

  if (!config.domain || !config.clientId || !config.clientSecret) {
    throw new Error('Auth0 configuration missing. Please configure AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET environment variables.');
  }

  return new Auth0ManagementClient(config);
}

/**
 * Helper function to extract firm ID from Auth0 user
 */
export function extractFirmId(user: Auth0User): string | null {
  return user.user_metadata?.firmId || 
         user.app_metadata?.organization || 
         null;
}

/**
 * Helper function to check if user is admin
 */
export function isUserAdmin(user: Auth0User): boolean {
  return user.user_metadata?.role === 'admin' ||
         user.app_metadata?.permissions?.includes('firm:admin') ||
         false;
}

/**
 * Helper function to format user display data
 */
export function formatUserForDisplay(user: Auth0User) {
  return {
    id: user.user_id,
    email: user.email,
    name: user.name || user.email,
    role: user.user_metadata?.role || 'user',
    status: user.email_verified ? 'active' : 'pending',
    emailVerified: user.email_verified,
    lastLogin: user.last_login || null,
    createdAt: user.created_at,
    invitedBy: user.user_metadata?.invitedBy || null,
    invitedAt: user.user_metadata?.invitedAt || null,
    firmId: extractFirmId(user)
  };
}