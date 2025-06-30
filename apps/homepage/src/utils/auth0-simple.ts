/**
 * Simplified Auth0 Integration - Authentication Only
 * 
 * This module provides a clean Auth0 integration that handles ONLY authentication.
 * All authorization/permission logic has been moved to the database-backed system.
 * 
 * This replaces the complex auth0-management.ts file with a simple, focused approach.
 */

// Simplified Auth0 user interface - only authentication data
export interface Auth0User {
  user_id: string;
  email: string;
  name?: string;
  email_verified: boolean;
  created_at: string;
  last_login?: string;
  // No metadata fields - permissions handled by database
}

// Simple user creation request
export interface CreateUserRequest {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface Auth0ManagementConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
}

export class SimpleAuth0Client {
  private config: Auth0ManagementConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: Auth0ManagementConfig) {
    this.config = config;
  }

  /**
   * Get or refresh the Management API access token
   */
  async getAccessToken(): Promise<string> {
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
    this.tokenExpiry = Date.now() + (tokenData.expires_in * 900);
    
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
   * Get a user by Auth0 ID (for authentication validation only)
   */
  async getUser(userId: string): Promise<Auth0User> {
    console.log(`👤 Getting Auth0 user: ${userId}`);
    
    const response = await this.makeRequest(`/users/${encodeURIComponent(userId)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found in Auth0');
      }
      const error = await response.text();
      throw new Error(`Failed to get user: ${error}`);
    }
    
    const user = await response.json();
    console.log(`✅ Auth0 user retrieved: ${user.email}`);
    
    // Return only authentication-related fields
    return {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      email_verified: user.email_verified,
      created_at: user.created_at,
      last_login: user.last_login
    };
  }

  /**
   * Get user by email (for initial database sync)
   */
  async getUserByEmail(email: string): Promise<Auth0User | null> {
    console.log(`🔍 Finding Auth0 user by email: ${email}`);
    
    const query = encodeURIComponent(`email:"${email}"`);
    const response = await this.makeRequest(`/users?q=${query}&search_engine=v3`);
    
    if (!response.ok) {
      console.warn('⚠️ Failed to search for user by email');
      return null;
    }
    
    const users = await response.json();
    if (users.length === 0) {
      return null;
    }
    
    const user = users[0];
    return {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      email_verified: user.email_verified,
      created_at: user.created_at,
      last_login: user.last_login
    };
  }

  /**
   * Create a basic Auth0 user (authentication only)
   * All authorization data is handled in the database
   */
  async createUser(request: CreateUserRequest): Promise<Auth0User> {
    console.log(`📧 Creating Auth0 user for: ${request.email}`);
    
    const userData = {
      connection: 'Username-Password-Authentication',
      email: request.email,
      email_verified: false,
      verify_email: true,
      name: request.firstName && request.lastName 
        ? `${request.firstName} ${request.lastName}` 
        : request.email,
      // No metadata - permissions handled by database
    };

    const response = await this.makeRequest('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.text();
      
      if (error.includes('already exists')) {
        throw new Error('A user with this email already exists');
      }
      
      throw new Error(`Failed to create user: ${error}`);
    }

    const user = await response.json();
    console.log(`✅ Auth0 user created: ${user.user_id}`);
    
    // Send email verification
    await this.sendEmailVerification(user.user_id);
    
    return {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      email_verified: user.email_verified,
      created_at: user.created_at,
      last_login: user.last_login
    };
  }

  /**
   * Send email verification (for new users)
   */
  async sendEmailVerification(userId: string): Promise<void> {
    console.log(`📨 Sending email verification for user: ${userId}`);
    
    const response = await this.makeRequest('/tickets/email-verification', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        // TODO: Customize redirect URL for firm onboarding
        // result_url: 'https://dev-www.lexara.app/firm/welcome'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn(`⚠️ Failed to send email verification: ${error}`);
      // Don't throw - user creation was successful
    } else {
      console.log('✅ Email verification sent');
    }
  }

  /**
   * Delete a user from Auth0 (authentication cleanup)
   */
  async deleteUser(userId: string): Promise<void> {
    console.log(`🗑️ Deleting Auth0 user: ${userId}`);
    
    const response = await this.makeRequest(`/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('ℹ️ Auth0 user already deleted or not found');
        return;
      }
      const error = await response.text();
      throw new Error(`Failed to delete Auth0 user: ${error}`);
    }

    console.log('✅ Auth0 user deleted successfully');
  }

  /**
   * Check if email already exists in Auth0
   */
  async checkEmailExists(email: string): Promise<boolean> {
    console.log(`🔍 Checking if email exists in Auth0: ${email}`);
    
    const query = encodeURIComponent(`email:"${email}"`);
    const response = await this.makeRequest(`/users?q=${query}&search_engine=v3`);
    
    if (!response.ok) {
      console.warn('⚠️ Failed to check email existence in Auth0');
      return false;
    }
    
    const users = await response.json();
    const exists = users.length > 0;
    
    console.log(`${exists ? '⚠️' : '✅'} Email ${exists ? 'exists' : 'available'} in Auth0: ${email}`);
    return exists;
  }

  /**
   * Update user profile (name only - no permissions)
   */
  async updateUserProfile(userId: string, name?: string): Promise<Auth0User> {
    console.log(`🔄 Updating Auth0 user profile: ${userId}`);
    
    const updateData: any = {};
    if (name) {
      updateData.name = name;
    }

    const response = await this.makeRequest(`/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update user profile: ${error}`);
    }

    const user = await response.json();
    console.log(`✅ Auth0 user profile updated: ${user.email}`);
    
    return {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      email_verified: user.email_verified,
      created_at: user.created_at,
      last_login: user.last_login
    };
  }
}

/**
 * Factory function to create simplified Auth0 client
 */
export function createSimpleAuth0Client(env: any): SimpleAuth0Client {
  const config: Auth0ManagementConfig = {
    domain: env.AUTH0_DOMAIN,
    clientId: env.AUTH0_CLIENT_ID,
    clientSecret: env.AUTH0_CLIENT_SECRET
  };

  if (!config.domain || !config.clientId || !config.clientSecret) {
    throw new Error('Auth0 configuration missing. Please configure AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET environment variables.');
  }

  return new SimpleAuth0Client(config);
}

/**
 * Helper function to format user for display (authentication data only)
 */
export function formatAuth0User(user: Auth0User) {
  return {
    auth0_id: user.user_id,
    email: user.email,
    name: user.name || user.email,
    emailVerified: user.email_verified,
    lastLogin: user.last_login || null,
    createdAt: user.created_at
  };
}