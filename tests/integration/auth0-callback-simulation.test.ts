// Auth0 Callback Simulation Tests
// Simulates the complete Auth0 OAuth flow with mocked Auth0 responses

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Auth0 Callback Flow Simulation', () => {
  let platformWorker: UnstableDevWorker;

  beforeEach(async () => {
    platformWorker = await unstable_dev('src/platform/platform-worker.ts', {
      config: 'wrangler-platform.toml',
      env: 'dev',
      local: true,
      experimental: { disableExperimentalWarning: true }
    });
  });

  afterEach(async () => {
    await platformWorker?.stop();
  });

  // Helper function to generate valid state token
  const generateValidState = (returnTo: string = '/dashboard') => {
    const stateData = {
      returnTo,
      timestamp: Date.now(),
      nonce: 'test-nonce-123'
    };
    return btoa(JSON.stringify(stateData));
  };

  describe('Successful Authentication Flow', () => {
    it('should complete full authentication with valid tokens', async () => {
      // Mock Auth0 token endpoint response
      const mockTokenResponse = {
        access_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2V5In0.test-payload.test-signature',
        id_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2V5In0.eyJzdWIiOiJnb29nbGUtb2F1dGgyfDEyMzQ1Njc4OSIsImVtYWlsIjoidGVzdEBsZXhhcmEuY29tIiwibmFtZSI6IlRlc3QgVXNlciIsImh0dHBzOi8vbGV4YXJhLmFwcC91c2VyX3R5cGUiOiJsZXhhcmFfYWRtaW4iLCJodHRwczovL2xleGFyYS5hcHAvcm9sZXMiOlsicGxhdGZvcm06YWRtaW4iXSwiaHR0cHM6Ly9sZXhhcmEuYXBwL29yZ19pZCI6ImxleGFyYS1wbGF0Zm9ybSIsImV4cCI6OTk5OTk5OTk5OX0.test-signature',
        token_type: 'Bearer',
        expires_in: 3600
      };

      // Mock the fetch call to Auth0
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      try {
        const validState = generateValidState('/dashboard');
        const response = await platformWorker.fetch(`/callback?code=test-auth-code&state=${validState}`);

        expect(response.status).toBe(302);
        
        const location = response.headers.get('Location');
        expect(location).toContain('/dashboard');
        
        const cookies = response.headers.get('Set-Cookie');
        expect(cookies).toContain('platform_session=');
        expect(cookies).toContain('HttpOnly');
        expect(cookies).toContain('Secure');

      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle custom return URLs', async () => {
      const mockTokenResponse = {
        access_token: 'mock-token',
        id_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJlbWFpbCI6InRlc3RAbGV4YXJhLmNvbSIsImh0dHBzOi8vbGV4YXJhLmFwcC91c2VyX3R5cGUiOiJsZXhhcmFfYWRtaW4iLCJodHRwczovL2xleGFyYS5hcHAvcm9sZXMiOltdLCJleHAiOjk5OTk5OTk5OTl9.mock-sig',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      try {
        const validState = generateValidState('/firms/manage');
        const response = await platformWorker.fetch(`/callback?code=test-code&state=${validState}`);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toContain('/firms/manage');

      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Token Exchange Failures', () => {
    it('should handle Auth0 token endpoint errors', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('{"error":"invalid_grant","error_description":"Invalid authorization code"}')
      });

      try {
        const validState = generateValidState();
        const response = await platformWorker.fetch(`/callback?code=invalid-code&state=${validState}`);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toContain('/login?error=auth_failed');

      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle Auth0 service unavailable', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      try {
        const validState = generateValidState();
        const response = await platformWorker.fetch(`/callback?code=test-code&state=${validState}`);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toContain('/login?error=system_error');

      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('JWT Validation Edge Cases', () => {
    it('should handle malformed JWT tokens', async () => {
      const mockTokenResponse = {
        access_token: 'valid-access-token',
        id_token: 'invalid.jwt.token', // Malformed JWT
        token_type: 'Bearer',
        expires_in: 3600
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      try {
        const validState = generateValidState();
        const response = await platformWorker.fetch(`/callback?code=test-code&state=${validState}`);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toContain('/login?error=auth_failed');

      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle expired JWT tokens', async () => {
      // JWT with expired timestamp
      const expiredJWT = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJlbWFpbCI6InRlc3RAbGV4YXJhLmNvbSIsImV4cCI6MTAwMDAwMDAwMH0.signature';
      
      const mockTokenResponse = {
        access_token: 'valid-access-token',
        id_token: expiredJWT,
        token_type: 'Bearer',
        expires_in: 3600
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      try {
        const validState = generateValidState();
        const response = await platformWorker.fetch(`/callback?code=test-code&state=${validState}`);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toContain('/login?error=auth_failed');

      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Session Management', () => {
    it('should create persistent session after successful auth', async () => {
      const mockTokenResponse = {
        access_token: 'access-token',
        id_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJlbWFpbCI6InRlc3RAbGV4YXJhLmNvbSIsIm5hbWUiOiJUZXN0IFVzZXIiLCJodHRwczovL2xleGFyYS5hcHAvdXNlcl90eXBlIjoibGV4YXJhX2FkbWluIiwiaHR0cHM6Ly9sZXhhcmEuYXBwL3JvbGVzIjpbXSwiZXhwIjo5OTk5OTk5OTk5fQ.sig',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      try {
        const validState = generateValidState();
        const authResponse = await platformWorker.fetch(`/callback?code=test-code&state=${validState}`);
        
        expect(authResponse.status).toBe(302);
        
        const sessionCookie = authResponse.headers.get('Set-Cookie');
        expect(sessionCookie).toContain('platform_session=');
        
        // Extract session token for next request
        const sessionMatch = sessionCookie?.match(/platform_session=([^;]+)/);
        const sessionToken = sessionMatch?.[1];
        
        if (sessionToken) {
          // Test authenticated request
          const dashboardResponse = await platformWorker.fetch('/dashboard', {
            headers: { 'Cookie': `platform_session=${sessionToken}` }
          });
          
          expect(dashboardResponse.status).toBe(200);
          expect(dashboardResponse.headers.get('Content-Type')).toContain('text/html');
        }

      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle session expiration', async () => {
      // Test with an expired session token
      const expiredSessionToken = 'expired-session-token-123';
      
      const response = await platformWorker.fetch('/dashboard', {
        headers: { 'Cookie': `platform_session=${expiredSessionToken}` }
      });
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });
  });

  describe('Security Validations', () => {
    it('should reject requests with invalid state tokens', async () => {
      const response = await platformWorker.fetch('/callback?code=valid-code&state=tampered-state');
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login?error=auth_failed');
    });

    it('should handle state token replay attacks', async () => {
      // Test with old timestamp in state
      const oldStateData = {
        returnTo: '/dashboard',
        timestamp: Date.now() - (15 * 60 * 1000), // 15 minutes ago
        nonce: 'old-nonce'
      };
      const oldState = btoa(JSON.stringify(oldStateData));
      
      const response = await platformWorker.fetch(`/callback?code=valid-code&state=${oldState}`);
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login?error=auth_failed');
    });

    it('should validate redirect URI consistency', async () => {
      const mockTokenResponse = {
        access_token: 'token',
        id_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjo5OTk5OTk5OTk5fQ.sig',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementationOnce((url, options) => {
        const body = JSON.parse(options?.body as string || '{}');
        
        // Verify redirect_uri in token exchange request
        expect(body.redirect_uri).toBe('https://platform-dev.lexara.app/callback');
        expect(body.client_id).toBe('QHexH0yTPx1xBZDIWrzltOjwGX86Bcx3');
        expect(body.grant_type).toBe('authorization_code');
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        });
      });

      try {
        const validState = generateValidState();
        await platformWorker.fetch(`/callback?code=test-code&state=${validState}`);
        
        expect(globalThis.fetch).toHaveBeenCalledWith(
          'https://dev-sv0pf6cz2530xz0o.us.auth0.com/oauth/token',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        );

      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});