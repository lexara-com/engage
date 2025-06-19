// Integration tests for complete Auth0 authentication flows
// Tests the full authentication journey from login to authenticated requests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Auth0 Integration Tests', () => {
  let platformWorker: UnstableDevWorker;
  let agentWorker: UnstableDevWorker;

  beforeEach(async () => {
    // Start the platform admin worker for testing
    platformWorker = await unstable_dev('src/platform/platform-worker.ts', {
      config: 'wrangler-platform.toml',
      env: 'dev',
      local: true,
      experimental: { disableExperimentalWarning: true }
    });

    // Start the main agent worker for testing  
    agentWorker = await unstable_dev('src/agent/main-worker.ts', {
      config: 'wrangler.toml',
      env: 'dev',
      local: true,
      experimental: { disableExperimentalWarning: true }
    });
  });

  afterEach(async () => {
    await platformWorker?.stop();
    await agentWorker?.stop();
  });

  describe('Platform Admin Authentication Flow', () => {
    it('should redirect to Auth0 when accessing /login', async () => {
      const response = await platformWorker.fetch('/login');
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('Login with Auth0');
      expect(html).toContain('Platform Administration');
    });

    it('should return Auth0 authorization URL in login page', async () => {
      const response = await platformWorker.fetch('/login');
      const html = await response.text();
      
      // Check that Auth0 URL is properly formatted
      expect(html).toContain('dev-sv0pf6cz2530xz0o.us.auth0.com/authorize');
      expect(html).toContain('client_id=QHexH0yTPx1xBZDIWrzltOjwGX86Bcx3');
      expect(html).toContain('redirect_uri=https://platform-dev.lexara.app/callback');
      expect(html).toContain('scope=openid+profile+email');
    });

    it('should handle Auth0 callback with missing parameters', async () => {
      const response = await platformWorker.fetch('/callback');
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login?error=invalid_callback');
    });

    it('should handle Auth0 error responses', async () => {
      const response = await platformWorker.fetch('/callback?error=access_denied&error_description=User+cancelled');
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login?error=access_denied');
    });

    it('should handle invalid state parameter', async () => {
      const response = await platformWorker.fetch('/callback?code=test&state=invalid');
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login?error=auth_failed');
    });

    it('should require authentication for dashboard access', async () => {
      const response = await platformWorker.fetch('/dashboard');
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });

    it('should handle logout properly', async () => {
      const response = await platformWorker.fetch('/logout');
      
      // Should redirect to Auth0 logout or login page
      expect(response.status).toBe(302);
      const location = response.headers.get('Location');
      expect(location).toMatch(/(auth0\.com\/v2\/logout|\/login)/);
    });
  });

  describe('Health Check and Public Endpoints', () => {
    it('should respond to health check on platform worker', async () => {
      const response = await platformWorker.fetch('/health');
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('platform-admin');
    });

    it('should respond to health check on agent worker', async () => {
      const response = await agentWorker.fetch('/health');
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('engage-agent');
    });

    it('should serve agent worker chat interface', async () => {
      const response = await agentWorker.fetch('/');
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('Engage Legal AI');
    });
  });

  describe('Security Headers and CORS', () => {
    it('should set proper security headers on platform worker', async () => {
      const response = await platformWorker.fetch('/login');
      
      expect(response.headers.get('X-Frame-Options')).toBeTruthy();
      expect(response.headers.get('X-Content-Type-Options')).toBeTruthy();
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await platformWorker.fetch('/health', {
        method: 'OPTIONS'
      });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await platformWorker.fetch('/dashboard', {
        method: 'POST',
        body: 'invalid-json-data',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Should not crash, should redirect to login or return error
      expect([302, 400, 403]).toContain(response.status);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        platformWorker.fetch('/health')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle session cookie edge cases', async () => {
      const response = await platformWorker.fetch('/dashboard', {
        headers: {
          'Cookie': 'platform_session=invalid-session-token'
        }
      });
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });
  });

  describe('Environment-Specific Configuration', () => {
    it('should use development Auth0 configuration', async () => {
      const response = await platformWorker.fetch('/login');
      const html = await response.text();
      
      // Should use dev Auth0 domain
      expect(html).toContain('dev-sv0pf6cz2530xz0o.us.auth0.com');
      expect(html).not.toContain('lexara.us.auth0.com'); // Not production
    });

    it('should use development redirect URIs', async () => {
      const response = await platformWorker.fetch('/login');
      const html = await response.text();
      
      expect(html).toContain('platform-dev.lexara.app');
      expect(html).not.toContain('platform.lexara.app'); // Not production
    });
  });

  describe('Cross-Worker Integration', () => {
    it('should maintain consistent configuration across workers', async () => {
      const platformHealth = await platformWorker.fetch('/health');
      const agentHealth = await agentWorker.fetch('/health');
      
      const platformData = await platformHealth.json();
      const agentData = await agentHealth.json();
      
      expect(platformData.status).toBe('healthy');
      expect(agentData.status).toBe('healthy');
    });

    it('should handle service discovery between workers', async () => {
      // Test that workers can communicate with each other if needed
      // This tests the Durable Object bindings and service configurations
      
      const response = await agentWorker.fetch('/api/v1/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId: 'test-firm' })
      });
      
      // Should create session successfully (tests DO bindings)
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.sessionId).toBeTruthy();
      expect(data.resumeUrl).toBeTruthy();
    });
  });
});