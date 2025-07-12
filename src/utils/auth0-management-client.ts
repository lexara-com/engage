import type { APIContext } from 'astro';

interface Auth0Token {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface Auth0User {
  user_id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  logins_count: number;
  blocked?: boolean;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
}

interface CreateUserRequest {
  email: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  connection: string;
  password?: string;
  verify_email?: boolean;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

interface UpdateUserRequest {
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  blocked?: boolean;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

interface PasswordResetTicket {
  ticket: string;
  ticket_id: string;
}

export class Auth0ManagementClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private domain: string;
  private clientId: string;
  private clientSecret: string;
  private audience: string;

  constructor(config: {
    domain: string;
    clientId: string;
    clientSecret: string;
    audience?: string;
  }) {
    this.domain = config.domain;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.audience = config.audience || `https://${config.domain}/api/v2/`;
  }

  /**
   * Get or refresh the Management API access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // Request new token
    const tokenUrl = `https://${this.domain}/oauth/token`;
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        audience: this.audience,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get Auth0 access token: ${error}`);
    }

    const token: Auth0Token = await response.json();
    this.accessToken = token.access_token;
    // Set expiry with 5 minute buffer
    this.tokenExpiresAt = Date.now() + (token.expires_in - 300) * 1000;

    return this.accessToken;
  }

  /**
   * Make authenticated request to Auth0 Management API
   */
  private async makeRequest<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = `https://${this.domain}/api/v2${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Auth0 API error: ${response.status} - ${error}`);
    }

    // Handle empty responses (like DELETE)
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Get all users for a specific firm (using search query)
   */
  async getUsersByFirm(firmId: string, page = 0, perPage = 50): Promise<{
    users: Auth0User[];
    total: number;
    start: number;
    limit: number;
  }> {
    const query = encodeURIComponent(`app_metadata.firmId:"${firmId}"`);
    const result = await this.makeRequest<Auth0User[]>(
      `/users?q=${query}&page=${page}&per_page=${perPage}&include_totals=true&search_engine=v3`
    );

    // Auth0 returns array with totals in headers or as wrapped response
    // Handle both cases
    if (Array.isArray(result)) {
      return {
        users: result,
        total: result.length,
        start: page * perPage,
        limit: perPage,
      };
    }

    // Wrapped response format
    return result as any;
  }

  /**
   * Get a single user by ID
   */
  async getUser(userId: string): Promise<Auth0User> {
    return this.makeRequest<Auth0User>(`/users/${encodeURIComponent(userId)}`);
  }

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserRequest): Promise<Auth0User> {
    return this.makeRequest<Auth0User>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  /**
   * Update a user
   */
  async updateUser(userId: string, updates: UpdateUserRequest): Promise<Auth0User> {
    return this.makeRequest<Auth0User>(`/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<void> {
    await this.makeRequest<void>(`/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Block a user
   */
  async blockUser(userId: string): Promise<Auth0User> {
    return this.updateUser(userId, { blocked: true });
  }

  /**
   * Unblock a user
   */
  async unblockUser(userId: string): Promise<Auth0User> {
    return this.updateUser(userId, { blocked: false });
  }

  /**
   * Create a password reset ticket
   */
  async createPasswordResetTicket(
    userId: string,
    resultUrl?: string,
    ttlSec = 432000 // 5 days default
  ): Promise<PasswordResetTicket> {
    return this.makeRequest<PasswordResetTicket>('/tickets/password-change', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        ttl_sec: ttlSec,
        mark_email_as_verified: true,
        includeEmailInRedirect: false,
        result_url: resultUrl,
      }),
    });
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string): Promise<Array<{
    id: string;
    name: string;
    description: string;
  }>> {
    return this.makeRequest(`/users/${encodeURIComponent(userId)}/roles`);
  }

  /**
   * Assign roles to user
   */
  async assignUserRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.makeRequest(`/users/${encodeURIComponent(userId)}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roles: roleIds }),
    });
  }

  /**
   * Remove roles from user
   */
  async removeUserRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.makeRequest(`/users/${encodeURIComponent(userId)}/roles`, {
      method: 'DELETE',
      body: JSON.stringify({ roles: roleIds }),
    });
  }

  /**
   * Search users by email
   */
  async searchUsersByEmail(email: string): Promise<Auth0User[]> {
    const query = encodeURIComponent(`email:"${email}"`);
    return this.makeRequest<Auth0User[]>(`/users?q=${query}&search_engine=v3`);
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(userId: string): Promise<void> {
    await this.makeRequest('/jobs/verification-email', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }
}

/**
 * Create Auth0 Management Client from environment variables
 */
export function createAuth0ManagementClient(context?: APIContext): Auth0ManagementClient {
  // Get environment variables from context or process.env
  const getEnvVar = (key: string): string => {
    if (context) {
      const runtime = (context.locals as any)?.runtime;
      return runtime?.env?.[key] || (context as any).env?.[key] || '';
    }
    return process.env[key] || '';
  };

  const domain = getEnvVar('AUTH0_DOMAIN');
  const clientId = getEnvVar('AUTH0_MGMT_CLIENT_ID');
  const clientSecret = getEnvVar('AUTH0_MGMT_CLIENT_SECRET');

  if (!domain || !clientId || !clientSecret) {
    throw new Error('Auth0 Management API credentials not configured');
  }

  return new Auth0ManagementClient({
    domain,
    clientId,
    clientSecret,
  });
}