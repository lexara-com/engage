// Unit tests for JWT verification functions
// Tests the specific function that caused type signature mismatches

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock crypto for JWT signature verification
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      importKey: vi.fn(),
      verify: vi.fn()
    }
  }
});

// Mock fetch for JWKS
global.fetch = vi.fn();

describe('JWT Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyJWT function signature', () => {
    it('should accept token and domain parameters', async () => {
      // Mock JWKS response
      const mockJWKS = {
        keys: [{
          kid: 'test-key-id',
          kty: 'RSA',
          use: 'sig',
          n: 'test-modulus',
          e: 'AQAB'
        }]
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJWKS)
      });

      // Mock crypto operations
      (crypto.subtle.importKey as any).mockResolvedValue({});
      (crypto.subtle.verify as any).mockResolvedValue(true);

      const { verifyJWT } = await import('@/auth/auth-middleware');

      // Create a mock JWT with proper structure
      const header = btoa(JSON.stringify({ 
        kid: 'test-key-id', 
        alg: 'RS256' 
      }));
      const payload = btoa(JSON.stringify({
        sub: 'test-user',
        iss: 'https://dev-sv0pf6cz2530xz0o.us.auth0.com/',
        aud: 'test-audience',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: 'test@example.com'
      }));
      const signature = 'mock-signature';
      const token = `${header}.${payload}.${signature}`;

      // This should NOT throw a type error
      const result = await verifyJWT(token, 'dev-sv0pf6cz2530xz0o.us.auth0.com');
      
      expect(typeof result).toBe('object');
    });

    it('should return JWTPayload type with correct structure', async () => {
      // Test that the return type has expected JWT claims
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          keys: [{
            kid: 'test-key-id',
            kty: 'RSA',
            use: 'sig',
            n: 'test-modulus',
            e: 'AQAB'
          }]
        })
      });

      (crypto.subtle.importKey as any).mockResolvedValue({});
      (crypto.subtle.verify as any).mockResolvedValue(true);

      const { verifyJWT } = await import('@/auth/auth-middleware');

      const payload = {
        sub: 'google-oauth2|123456789',
        iss: 'https://dev-sv0pf6cz2530xz0o.us.auth0.com/',
        aud: 'test-audience',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: 'test@lexara.com',
        name: 'Test User',
        'https://lexara.app/user_type': 'lexara_admin',
        'https://lexara.app/roles': ['platform:admin'],
        'https://lexara.app/permissions': ['platform:manage_all_firms'],
        'https://lexara.app/org_id': 'lexara-platform'
      };

      const header = btoa(JSON.stringify({ kid: 'test-key-id', alg: 'RS256' }));
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `${header}.${encodedPayload}.signature`;

      const result = await verifyJWT(token, 'dev-sv0pf6cz2530xz0o.us.auth0.com');

      // Verify the result has expected JWT structure
      expect(result.sub).toBe('google-oauth2|123456789');
      expect(result.email).toBe('test@lexara.com');
      expect(result['https://lexara.app/user_type']).toBe('lexara_admin');
      expect(result['https://lexara.app/roles']).toEqual(['platform:admin']);
    });
  });

  describe('Error handling', () => {
    it('should handle JWKS fetch failures', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const { verifyJWT } = await import('@/auth/auth-middleware');

      const token = 'header.payload.signature';
      
      await expect(verifyJWT(token, 'invalid-domain.com')).rejects.toThrow();
    });

    it('should handle invalid JWT format', async () => {
      const { verifyJWT } = await import('@/auth/auth-middleware');

      await expect(verifyJWT('invalid-token', 'domain.com')).rejects.toThrow('Invalid JWT format');
    });

    it('should handle expired tokens', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ keys: [] })
      });

      const { verifyJWT } = await import('@/auth/auth-middleware');

      const expiredPayload = {
        sub: 'test',
        iss: 'https://domain.com/',
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      };

      const header = btoa(JSON.stringify({ kid: 'test', alg: 'RS256' }));
      const payload = btoa(JSON.stringify(expiredPayload));
      const token = `${header}.${payload}.signature`;

      await expect(verifyJWT(token, 'domain.com')).rejects.toThrow('JWT expired');
    });
  });

  describe('Function type compatibility', () => {
    it('should be compatible with platform auth manager usage', async () => {
      // This test ensures the function signature matches what platform-auth-manager expects
      const { verifyJWT } = await import('@/auth/auth-middleware');

      // This is how it's called in platform-auth-manager.ts
      const callVerifyJWT = async (idToken: string, domain: string) => {
        return await verifyJWT(idToken, domain);
      };

      // Should not cause TypeScript errors
      expect(typeof callVerifyJWT).toBe('function');
    });
  });
});