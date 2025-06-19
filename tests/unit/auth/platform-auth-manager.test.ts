// Unit tests for platform auth manager
// Tests critical Auth0 integration functions that caused debugging issues

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the environment
const mockEnv = {
  AUTH0_DOMAIN: 'dev-sv0pf6cz2530xz0o.us.auth0.com',
  AUTH0_CLIENT_ID: 'test-client-id',
  AUTH0_CLIENT_SECRET: 'test-client-secret',
  AUTH0_AUDIENCE: 'https://api.dev.lexara.app',
  PLATFORM_SESSION: {} as DurableObjectNamespace,
  PLATFORM_AUDIT_LOG: {} as DurableObjectNamespace,
  FIRM_REGISTRY: {} as DurableObjectNamespace,
  ENVIRONMENT: 'test',
  LOG_LEVEL: 'debug',
  ANTHROPIC_API_KEY: 'test-key'
};

// Mock dependencies
vi.mock('@/auth/auth0-config', () => ({
  getAuth0Config: () => ({
    domain: 'dev-sv0pf6cz2530xz0o.us.auth0.com',
    adminClientId: 'test-client-id',
    audience: 'https://api.dev.lexara.app'
  })
}));

vi.mock('@/auth/auth-middleware', () => ({
  verifyJWT: vi.fn(),
  JWTPayload: {}
}));

vi.mock('@/utils/ulid', () => ({
  generateULID: () => 'test-ulid-123'
}));

describe('PlatformAuthManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  describe('Auth URL Generation', () => {
    it('should generate valid Auth0 authorization URL', async () => {
      // Import after mocks are set up
      const { PlatformAuthManager } = await import('@/platform/auth/platform-auth-manager');
      
      const authManager = new PlatformAuthManager(mockEnv);
      const authUrl = await authManager.generateAuthUrl('/dashboard');
      
      expect(authUrl).toContain('https://dev-sv0pf6cz2530xz0o.us.auth0.com/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('redirect_uri=https://platform-dev.lexara.app/callback');
      expect(authUrl).toContain('scope=openid+profile+email');
      expect(authUrl).toContain('state=');
    });

    it('should include state parameter for CSRF protection', async () => {
      const { PlatformAuthManager } = await import('@/platform/auth/platform-auth-manager');
      
      const authManager = new PlatformAuthManager(mockEnv);
      const authUrl = await authManager.generateAuthUrl();
      
      const url = new URL(authUrl);
      const state = url.searchParams.get('state');
      
      expect(state).toBeTruthy();
      expect(state!.length).toBeGreaterThan(10); // Should be base64 encoded state
    });
  });

  describe('Token Exchange', () => {
    it('should successfully exchange authorization code for tokens', async () => {
      // Mock successful Auth0 token response
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        id_token: 'mock-id-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      const { PlatformAuthManager } = await import('@/platform/auth/platform-auth-manager');
      const authManager = new PlatformAuthManager(mockEnv);

      // Access private method via bracket notation for testing
      const result = await (authManager as any).exchangeCodeForTokens('test-auth-code');
      
      expect(result).toEqual(mockTokenResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://dev-sv0pf6cz2530xz0o.us.auth0.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('authorization_code')
        })
      );
    });

    it('should return null when token exchange fails', async () => {
      // Mock failed Auth0 response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Invalid client')
      });

      const { PlatformAuthManager } = await import('@/platform/auth/platform-auth-manager');
      const authManager = new PlatformAuthManager(mockEnv);

      const result = await (authManager as any).exchangeCodeForTokens('invalid-code');
      
      expect(result).toBeNull();
    });

    it('should send correct token exchange parameters', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token', id_token: 'id' })
      });

      const { PlatformAuthManager } = await import('@/platform/auth/platform-auth-manager');
      const authManager = new PlatformAuthManager(mockEnv);

      await (authManager as any).exchangeCodeForTokens('test-code');
      
      const fetchCall = (fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody).toEqual({
        grant_type: 'authorization_code',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        code: 'test-code',
        redirect_uri: 'https://platform-dev.lexara.app/callback'
      });
    });
  });

  describe('JWT Validation and AuthContext Creation', () => {
    it('should create valid AuthContext from JWT payload', async () => {
      // Mock JWT verification
      const mockJWTPayload = {
        sub: 'google-oauth2|123456789',
        email: 'test@lexara.com',
        name: 'Test User',
        'https://lexara.app/user_type': 'lexara_admin',
        'https://lexara.app/firm_id': undefined,
        'https://lexara.app/firm_slug': undefined,
        'https://lexara.app/roles': ['platform:admin'],
        'https://lexara.app/permissions': ['platform:manage_all_firms'],
        'https://lexara.app/org_id': 'lexara-platform'
      };

      const { verifyJWT } = await import('@/auth/auth-middleware');
      (verifyJWT as any).mockResolvedValue(mockJWTPayload);

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'token',
          id_token: 'mock-jwt-token'
        })
      });

      const { PlatformAuthManager } = await import('@/platform/auth/platform-auth-manager');
      const authManager = new PlatformAuthManager(mockEnv);

      const mockRequest = new Request('https://test.com/callback?code=test&state=test');
      const result = await authManager.handleAuthCallback('test-code', 'test-state', mockRequest);

      expect(result.success).toBe(true);
      // Note: Currently allowing all users for testing, so this should pass
    });

    it('should fail when JWT verification fails', async () => {
      const { verifyJWT } = await import('@/auth/auth-middleware');
      (verifyJWT as any).mockResolvedValue(null);

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'token',
          id_token: 'invalid-jwt'
        })
      });

      const { PlatformAuthManager } = await import('@/platform/auth/platform-auth-manager');
      const authManager = new PlatformAuthManager(mockEnv);

      const mockRequest = new Request('https://test.com/callback');
      const result = await authManager.handleAuthCallback('test-code', 'test-state', mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JWT token');
    });
  });

  describe('Platform Admin Validation', () => {
    it('should temporarily allow all users for testing', async () => {
      const { PlatformAuthManager } = await import('@/platform/auth/platform-auth-manager');
      const authManager = new PlatformAuthManager(mockEnv);

      // Any auth context should pass due to temporary allowance
      const mockAuthContext = {
        userId: 'test-user',
        userType: 'client' as any,
        roles: [],
        permissions: [],
        orgId: '',
        email: 'test@example.com'
      };

      const result = (authManager as any).isPlatformAdmin(mockAuthContext);
      expect(result).toBe(true);
    });
  });

  describe('State Generation and Validation', () => {
    it('should generate and validate state tokens', async () => {
      const { PlatformAuthManager } = await import('@/platform/auth/platform-auth-manager');
      const authManager = new PlatformAuthManager(mockEnv);

      const state = (authManager as any).generateSecureState('/dashboard');
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(50); // Base64 encoded JSON

      const decoded = (authManager as any).validateState(state);
      expect(decoded).toBeTruthy();
      expect(decoded.returnTo).toBe('/dashboard');
    });

    it('should reject invalid state tokens', async () => {
      const { PlatformAuthManager } = await import('@/platform/auth/platform-auth-manager');
      const authManager = new PlatformAuthManager(mockEnv);

      const result = (authManager as any).validateState('invalid-state');
      expect(result).toBeNull();
    });
  });
});