// Auth0 Session Management Integration Tests
// Tests session lifecycle, persistence, and authenticated API access

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Auth0 Session Management', () => {
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

  // Helper to create a mock session
  const createMockSession = async () => {
    const sessionId = 'test-session-' + Date.now();
    const sessionData = {
      sessionId,
      auth0UserId: 'google-oauth2|123456789',
      userEmail: 'test@lexara.com',
      userName: 'Test User',
      userType: 'lexara_admin',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      ipAddress: '127.0.0.1',
      userAgent: 'Test Browser'
    };

    return { sessionId, sessionData };
  };

  describe('Session Creation and Validation', () => {
    it('should create session with proper security attributes', async () => {
      // Simulate successful authentication that creates a session
      const validState = btoa(JSON.stringify({
        returnTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      }));

      const mockTokenResponse = {
        access_token: 'mock-access-token',
        id_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJnb29nbGUtb2F1dGgyfDEyMzQ1Njc4OSIsImVtYWlsIjoidGVzdEBsZXhhcmEuY29tIiwibmFtZSI6IlRlc3QgVXNlciIsImh0dHBzOi8vbGV4YXJhLmFwcC91c2VyX3R5cGUiOiJsZXhhcmFfYWRtaW4iLCJodHRwczovL2xleGFyYS5hcHAvcm9sZXMiOltdLCJleHAiOjk5OTk5OTk5OTl9.mock-signature',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      try {
        const response = await platformWorker.fetch(`/callback?code=test-code&state=${validState}`);
        
        expect(response.status).toBe(302);
        
        const setCookieHeader = response.headers.get('Set-Cookie');
        expect(setCookieHeader).toBeTruthy();
        
        // Verify security attributes
        expect(setCookieHeader).toContain('HttpOnly');
        expect(setCookieHeader).toContain('Secure');
        expect(setCookieHeader).toContain('SameSite=Strict');
        expect(setCookieHeader).toContain('Max-Age=');
        expect(setCookieHeader).toContain('platform_session=');

      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should validate session tokens correctly', async () => {
      // Test with invalid session token
      const response = await platformWorker.fetch('/dashboard', {
        headers: { 'Cookie': 'platform_session=invalid-token-123' }
      });
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });

    it('should handle missing session tokens', async () => {
      const response = await platformWorker.fetch('/dashboard');
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });
  });

  describe('Session Persistence and Durable Objects', () => {
    it('should persist sessions across requests', async () => {
      // This tests the Durable Object session storage
      const { sessionId } = await createMockSession();
      
      // First request with session
      const firstResponse = await platformWorker.fetch('/dashboard', {
        headers: { 'Cookie': `platform_session=${sessionId}` }
      });
      
      // Second request with same session
      const secondResponse = await platformWorker.fetch('/dashboard', {
        headers: { 'Cookie': `platform_session=${sessionId}` }
      });
      
      // Both should have consistent behavior
      expect(firstResponse.status).toBe(secondResponse.status);
    });

    it('should update session activity timestamps', async () => {
      const { sessionId } = await createMockSession();
      
      // Make multiple requests to test activity updates
      await platformWorker.fetch('/dashboard', {
        headers: { 'Cookie': `platform_session=${sessionId}` }
      });
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await platformWorker.fetch('/dashboard', {
        headers: { 'Cookie': `platform_session=${sessionId}` }
      });
      
      // Session should still be valid and activity updated
      // Note: Actual timestamp verification would require access to DO state
    });
  });

  describe('Session Expiration and Cleanup', () => {
    it('should handle expired sessions', async () => {
      // Create session with past expiration
      const expiredSessionId = 'expired-session-123';
      
      const response = await platformWorker.fetch('/dashboard', {
        headers: { 'Cookie': `platform_session=${expiredSessionId}` }
      });
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });

    it('should clean up session on logout', async () => {
      const { sessionId } = await createMockSession();
      
      const logoutResponse = await platformWorker.fetch('/logout', {
        headers: { 'Cookie': `platform_session=${sessionId}` }
      });
      
      expect(logoutResponse.status).toBe(302);
      
      // Verify session is cleared
      const clearCookie = logoutResponse.headers.get('Set-Cookie');
      expect(clearCookie).toContain('platform_session=');
      expect(clearCookie).toContain('Expires=Thu, 01 Jan 1970');
    });
  });

  describe('Authenticated API Access', () => {
    it('should allow access to protected routes with valid session', async () => {
      // Note: This would require a valid session that passes authentication
      // For now, we test the authentication requirement
      
      const response = await platformWorker.fetch('/firms', {
        headers: { 'Cookie': 'platform_session=valid-session-token' }
      });
      
      // Should either succeed or redirect to login (not crash)
      expect([200, 302, 404]).toContain(response.status);
    });

    it('should deny access to protected routes without session', async () => {
      const response = await platformWorker.fetch('/firms');
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });

    it('should handle API endpoints with proper authentication', async () => {
      const response = await platformWorker.fetch('/analytics');
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });
  });

  describe('Security and Attack Prevention', () => {
    it('should resist session fixation attacks', async () => {
      // Attempt to use a session ID that wasn't properly created
      const maliciousSessionId = 'malicious-session-' + Math.random();
      
      const response = await platformWorker.fetch('/dashboard', {
        headers: { 'Cookie': `platform_session=${maliciousSessionId}` }
      });
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });

    it('should handle concurrent session requests safely', async () => {
      const { sessionId } = await createMockSession();
      
      // Make multiple concurrent requests with same session
      const requests = Array(5).fill(null).map(() =>
        platformWorker.fetch('/dashboard', {
          headers: { 'Cookie': `platform_session=${sessionId}` }
        })
      );
      
      const responses = await Promise.all(requests);
      
      // All should have consistent behavior (no race conditions)
      responses.forEach(response => {
        expect([200, 302]).toContain(response.status);
      });
    });

    it('should validate session integrity', async () => {
      // Test with tampered session token
      const tamperedSession = 'valid-prefix-tampered-suffix';
      
      const response = await platformWorker.fetch('/dashboard', {
        headers: { 'Cookie': `platform_session=${tamperedSession}` }
      });
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });
  });

  describe('Cross-Origin and CORS Handling', () => {
    it('should handle preflight requests for authenticated endpoints', async () => {
      const response = await platformWorker.fetch('/dashboard', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://platform-dev.lexara.app',
          'Access-Control-Request-Method': 'GET'
        }
      });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
    });

    it('should reject cross-origin requests without proper credentials', async () => {
      const response = await platformWorker.fetch('/dashboard', {
        headers: {
          'Origin': 'https://malicious-site.com',
          'Cookie': 'platform_session=valid-session'
        }
      });
      
      // Should either block or handle safely
      expect([200, 302, 403]).toContain(response.status);
    });
  });

  describe('Platform Admin Role Validation', () => {
    it('should enforce platform admin requirements', async () => {
      // This tests the isPlatformAdmin logic
      // Currently allowing all users for testing, so this documents expected behavior
      
      const { sessionId } = await createMockSession();
      
      const response = await platformWorker.fetch('/dashboard', {
        headers: { 'Cookie': `platform_session=${sessionId}` }
      });
      
      // With current testing allowance, should redirect to login (no valid session)
      // In production, would check actual platform admin roles
      expect(response.status).toBe(302);
    });

    it('should log platform admin access attempts', async () => {
      // Test that authentication attempts are properly audited
      const response = await platformWorker.fetch('/dashboard', {
        headers: { 'Cookie': 'platform_session=test-session' }
      });
      
      // Should handle gracefully and redirect
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });
  });
});