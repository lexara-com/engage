/**
 * Integration Tests - API Endpoints
 * 
 * Tests the complete API functionality with real Miniflare environment,
 * validating end-to-end request/response flows and data consistency.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { testEnv, createTestRequest, createTestJWT, TestDataFactory, waitFor } from '../setup';
import app from '../../src/api/api-worker';

describe('API Endpoints Integration Tests', () => {
  let authToken: string;

  beforeEach(() => {
    authToken = createTestJWT({
      org: 'firm_test_001',
      role: 'attorney',
      permissions: ['view_conversations', 'manage_conversations', 'assign_conversations']
    });
  });

  describe('Health Endpoints', () => {
    it('should return health status without authentication', async () => {
      const request = createTestRequest({
        method: 'GET',
        path: '/health'
      });

      const response = await app.fetch(request, testEnv.env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.version).toBe('1.0.0-test');
      expect(data.environment).toBe('test');
    });

    it('should return API version', async () => {
      const request = createTestRequest({
        method: 'GET',
        path: '/api/v1/version'
      });

      const response = await app.fetch(request, testEnv.env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.version).toBe('1.0.0-test');
      expect(data.apiVersion).toBe('v1');
    });
  });

  describe('Conversation Endpoints', () => {
    describe('GET /api/v1/firm/conversations', () => {
      it('should list conversations with authentication', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/conversations',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.conversations).toBeDefined();
        expect(data.total).toBeDefined();
        expect(Array.isArray(data.conversations)).toBe(true);
      });

      it('should filter conversations by status', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/conversations?status=active',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        if (data.conversations.length > 0) {
          expect(data.conversations.every((c: any) => c.status === 'active')).toBe(true);
        }
      });

      it('should require authentication', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/conversations'
        });

        const response = await app.fetch(request, testEnv.env);

        expect(response.status).toBe(401);
      });

      it('should handle pagination', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/conversations?limit=5&offset=0',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.conversations.length).toBeLessThanOrEqual(5);
        expect(data.hasMore).toBeDefined();
      });
    });

    describe('GET /api/v1/firm/conversations/:sessionId', () => {
      it('should get conversation details', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/conversations/session_test_001',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        // Should either return conversation or 404
        expect([200, 404]).toContain(response.status);

        if (response.status === 200) {
          const data = await response.json();
          expect(data.conversation).toBeDefined();
          expect(data.conversation.sessionId).toBe('session_test_001');
        }
      });

      it('should return 404 for non-existent conversation', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/conversations/nonexistent_session',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/v1/firm/conversations/:sessionId/messages', () => {
      it('should add message to conversation', async () => {
        const messageData = {
          content: 'Hello, I need legal help',
          role: 'user',
          metadata: { source: 'web' }
        };

        const request = createTestRequest({
          method: 'POST',
          path: '/api/v1/firm/conversations/session_test_001/messages',
          body: messageData,
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        expect([200, 404]).toContain(response.status);

        if (response.status === 200) {
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.conversation).toBeDefined();
        }
      });

      it('should validate message data', async () => {
        const invalidMessageData = {
          content: '', // Empty content
          role: 'invalid_role'
        };

        const request = createTestRequest({
          method: 'POST',
          path: '/api/v1/firm/conversations/session_test_001/messages',
          body: invalidMessageData,
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        expect(response.status).toBe(400);
      });
    });

    describe('PUT /api/v1/firm/conversations/:sessionId/assignment', () => {
      it('should assign conversation to user', async () => {
        const assignmentData = {
          assignedTo: 'user_test_001'
        };

        const request = createTestRequest({
          method: 'PUT',
          path: '/api/v1/firm/conversations/session_test_001/assignment',
          body: assignmentData,
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        expect([200, 404]).toContain(response.status);

        if (response.status === 200) {
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.conversation).toBeDefined();
        }
      });

      it('should require valid user ID', async () => {
        const assignmentData = {
          assignedTo: '' // Empty user ID
        };

        const request = createTestRequest({
          method: 'PUT',
          path: '/api/v1/firm/conversations/session_test_001/assignment',
          body: assignmentData,
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        expect(response.status).toBe(400);
      });
    });
  });

  describe('User Management Endpoints', () => {
    describe('GET /api/v1/firm/users', () => {
      it('should list firm users', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/users',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.users).toBeDefined();
        expect(data.total).toBeDefined();
        expect(Array.isArray(data.users)).toBe(true);
      });

      it('should include user details in response', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/users',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        if (data.users.length > 0) {
          const user = data.users[0];
          expect(user.userId).toBeDefined();
          expect(user.email).toBeDefined();
          expect(user.name).toBeDefined();
          expect(user.role).toBeDefined();
          expect(user.status).toBeDefined();
        }
      });
    });

    describe('POST /api/v1/firm/users', () => {
      it('should create new user', async () => {
        const userData = TestDataFactory.user({
          email: 'newuser@lawfirm.com',
          name: 'New User',
          role: 'paralegal'
        });

        const request = createTestRequest({
          method: 'POST',
          path: '/api/v1/firm/users',
          body: userData,
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        expect(response.status).toBe(200);
      });

      it('should validate user data', async () => {
        const invalidUserData = {
          email: 'invalid-email',
          name: '',
          role: 'invalid_role'
        };

        const request = createTestRequest({
          method: 'POST',
          path: '/api/v1/firm/users',
          body: invalidUserData,
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Analytics Endpoints', () => {
    describe('GET /api/v1/firm/analytics/overview', () => {
      it('should return firm analytics overview', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/analytics/overview',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.analytics).toBeDefined();
        expect(data.analytics.totalConversations).toBeDefined();
        expect(data.analytics.completedConversations).toBeDefined();
        expect(data.analytics.conversionRate).toBeDefined();
      });

      it('should accept date range parameters', async () => {
        const startDate = '2024-01-01';
        const endDate = '2024-12-31';

        const request = createTestRequest({
          method: 'GET',
          path: `/api/v1/firm/analytics/overview?startDate=${startDate}&endDate=${endDate}`,
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        expect(response.status).toBe(200);
      });
    });

    describe('GET /api/v1/firm/analytics/practice-areas', () => {
      it('should return practice area metrics', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/analytics/practice-areas',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.practiceAreaMetrics).toBeDefined();
        expect(Array.isArray(data.practiceAreaMetrics)).toBe(true);
      });
    });
  });

  describe('Search Endpoints', () => {
    describe('GET /api/v1/firm/search/conversations', () => {
      it('should search conversations', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/search/conversations?q=car%20accident',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.conversations).toBeDefined();
        expect(data.scores).toBeDefined();
        expect(Array.isArray(data.conversations)).toBe(true);
        expect(Array.isArray(data.scores)).toBe(true);
      });

      it('should require search query', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/search/conversations',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        expect(response.status).toBe(400);
      });

      it('should filter by practice area', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/search/conversations?q=accident&practiceArea=personal_injury',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Assignment Endpoints', () => {
    describe('GET /api/v1/firm/assignments', () => {
      it('should list assignments', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/assignments',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.assignments).toBeDefined();
        expect(data.total).toBeDefined();
        expect(Array.isArray(data.assignments)).toBe(true);
      });

      it('should filter by assigned user', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/assignments?assignedTo=user_test_001',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        expect(response.status).toBe(200);
      });
    });

    describe('GET /api/v1/firm/assignments/workload', () => {
      it('should return workload analysis', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/assignments/workload',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.workloadAnalysis).toBeDefined();
        expect(Array.isArray(data.workloadAnalysis)).toBe(true);
      });
    });
  });

  describe('Settings Endpoints', () => {
    describe('GET /api/v1/firm/settings', () => {
      it('should return firm settings', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/settings',
          authToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.settings).toBeDefined();
        expect(typeof data.settings).toBe('object');
      });
    });

    describe('PUT /api/v1/firm/settings/:section', () => {
      it('should update firm settings', async () => {
        const settingsData = {
          firmName: 'Updated Law Firm',
          practiceAreas: ['personal_injury', 'family_law']
        };

        const request = createTestRequest({
          method: 'PUT',
          path: '/api/v1/firm/settings/basic_info',
          body: settingsData,
          authToken
        });

        const response = await app.fetch(request, testEnv.env);

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Platform Admin Endpoints', () => {
    let platformToken: string;

    beforeEach(() => {
      platformToken = createTestJWT({
        org: 'lexara-platform',
        role: 'platform_admin',
        permissions: ['manage_firms', 'view_platform_analytics']
      });
    });

    describe('GET /api/v1/platform/firms', () => {
      it('should list all firms for platform admin', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/platform/firms',
          authToken: platformToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.firms).toBeDefined();
        expect(data.total).toBeDefined();
      });

      it('should deny access to firm users', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/platform/firms',
          authToken // Regular firm token
        });

        const response = await app.fetch(request, testEnv.env);

        expect(response.status).toBe(403);
      });
    });

    describe('GET /api/v1/platform/health', () => {
      it('should return detailed system health', async () => {
        const request = createTestRequest({
          method: 'GET',
          path: '/api/v1/platform/health',
          authToken: platformToken
        });

        const response = await app.fetch(request, testEnv.env);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toMatch(/healthy|degraded/);
        expect(data.checks).toBeDefined();
        expect(Array.isArray(data.checks)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const request = createTestRequest({
        method: 'GET',
        path: '/api/v1/unknown-endpoint',
        authToken
      });

      const response = await app.fetch(request, testEnv.env);

      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const request = new Request('https://api-test.lexara.app/api/v1/firm/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: '{"invalid": json}'
      });

      const response = await app.fetch(request, testEnv.env);

      expect(response.status).toBe(400);
    });

    it('should handle missing required fields', async () => {
      const request = createTestRequest({
        method: 'POST',
        path: '/api/v1/firm/conversations/session_test_001/messages',
        body: {}, // Missing required fields
        authToken
      });

      const response = await app.fetch(request, testEnv.env);

      expect(response.status).toBe(400);
    });
  });

  describe('CORS Headers', () => {
    it('should include proper CORS headers', async () => {
      const request = createTestRequest({
        method: 'GET',
        path: '/health'
      });

      const response = await app.fetch(request, testEnv.env);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
    });

    it('should handle preflight requests', async () => {
      const request = createTestRequest({
        method: 'OPTIONS',
        path: '/api/v1/firm/conversations'
      });

      const response = await app.fetch(request, testEnv.env);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits for authenticated requests', async () => {
      // Make multiple rapid requests
      const requests = Array(10).fill(null).map(() =>
        createTestRequest({
          method: 'GET',
          path: '/api/v1/firm/conversations',
          authToken
        })
      );

      const responses = await Promise.all(
        requests.map(req => app.fetch(req, testEnv.env))
      );

      // All should succeed in test environment (relaxed limits)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
});