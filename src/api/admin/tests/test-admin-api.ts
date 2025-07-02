// Admin API Integration Tests

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';
import jwt from 'jsonwebtoken';

describe('Admin API Tests', () => {
  let worker: UnstableDevWorker;
  let authToken: string;
  const testFirmId = '01HK8Z1X2Y3V4W5A6B7C8D9E0F';
  const baseUrl = 'http://localhost:8787/v1/admin';

  beforeAll(async () => {
    // Start the worker
    worker = await unstable_dev('src/api/admin/worker.ts', {
      experimental: { disableExperimentalWarning: true },
      local: true,
      config: 'wrangler.admin-api.toml',
      env: 'development'
    });

    // Generate test JWT token
    authToken = generateTestToken({
      sub: 'test-user-123',
      email: 'test@testfirm.com',
      'https://engage.lexara.com/firm_id': testFirmId,
      'https://engage.lexara.com/role': 'admin',
      permissions: ['conversations:read', 'conversations:write', 'conversations:delete']
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  describe('Health Check', () => {
    test('GET /health returns healthy status', async () => {
      const resp = await worker.fetch(`${baseUrl}/health`);
      expect(resp.status).toBe(200);
      
      const data = await resp.json();
      expect(data).toEqual({
        status: 'healthy',
        service: 'engage-admin-api',
        version: '1.0.0',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Authentication', () => {
    test('Requests without auth token return 401', async () => {
      const resp = await worker.fetch(`${baseUrl}/firms`);
      expect(resp.status).toBe(401);
      
      const data = await resp.json();
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    test('Requests with invalid token return 401', async () => {
      const resp = await worker.fetch(`${baseUrl}/firms`, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      expect(resp.status).toBe(401);
    });

    test('Requests with valid token succeed', async () => {
      const resp = await worker.fetch(`${baseUrl}/firms`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      expect(resp.status).toBe(200);
    });
  });

  describe('Conversations API', () => {
    describe('GET /firms/{firmId}/conversations', () => {
      test('Lists conversations with pagination', async () => {
        const resp = await worker.fetch(`${baseUrl}/firms/${testFirmId}/conversations`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        expect(resp.status).toBe(200);
        const data = await resp.json();
        
        expect(data).toHaveProperty('conversations');
        expect(data).toHaveProperty('pagination');
        expect(data.pagination).toEqual({
          page: 1,
          limit: 20,
          total: expect.any(Number),
          totalPages: expect.any(Number)
        });
        
        expect(Array.isArray(data.conversations)).toBe(true);
        if (data.conversations.length > 0) {
          const conversation = data.conversations[0];
          expect(conversation).toHaveProperty('id');
          expect(conversation).toHaveProperty('firmId');
          expect(conversation).toHaveProperty('status');
          expect(conversation).toHaveProperty('phase');
          expect(conversation).toHaveProperty('createdAt');
        }
      });

      test('Filters conversations by status', async () => {
        const resp = await worker.fetch(`${baseUrl}/firms/${testFirmId}/conversations?status=active`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        expect(resp.status).toBe(200);
        const data = await resp.json();
        
        data.conversations.forEach((conv: any) => {
          expect(conv.status).toBe('active');
        });
      });

      test('Searches conversations by user info', async () => {
        const resp = await worker.fetch(`${baseUrl}/firms/${testFirmId}/conversations?search=john`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        expect(resp.status).toBe(200);
        const data = await resp.json();
        
        expect(data.conversations.length).toBeGreaterThan(0);
        expect(data.conversations[0].userName?.toLowerCase()).toContain('john');
      });

      test('Paginates results correctly', async () => {
        const resp = await worker.fetch(`${baseUrl}/firms/${testFirmId}/conversations?page=2&limit=1`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        expect(resp.status).toBe(200);
        const data = await resp.json();
        
        expect(data.pagination.page).toBe(2);
        expect(data.pagination.limit).toBe(1);
        expect(data.conversations.length).toBeLessThanOrEqual(1);
      });
    });

    describe('GET /firms/{firmId}/conversations/{conversationId}', () => {
      const testConversationId = '01HK8Z2X3Y4V5W6A7B8C9D0E1F';

      test('Returns conversation details with notes and audit log', async () => {
        const resp = await worker.fetch(
          `${baseUrl}/firms/${testFirmId}/conversations/${testConversationId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        expect(resp.status).toBe(200);
        const data = await resp.json();
        
        expect(data.id).toBe(testConversationId);
        expect(data.firmId).toBe(testFirmId);
        expect(data).toHaveProperty('messages');
        expect(data).toHaveProperty('userIdentity');
        expect(data).toHaveProperty('internalNotes');
        expect(data).toHaveProperty('auditLog');
        
        // Check notes
        expect(Array.isArray(data.internalNotes)).toBe(true);
        if (data.internalNotes.length > 0) {
          expect(data.internalNotes[0]).toHaveProperty('noteContent');
          expect(data.internalNotes[0]).toHaveProperty('createdBy');
        }
      });

      test('Returns 404 for non-existent conversation', async () => {
        const resp = await worker.fetch(
          `${baseUrl}/firms/${testFirmId}/conversations/non-existent-id`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        expect(resp.status).toBe(404);
        const data = await resp.json();
        expect(data.error.code).toBe('NOT_FOUND');
      });
    });

    describe('PUT /firms/{firmId}/conversations/{conversationId}', () => {
      const testConversationId = '01HK8Z2X3Y4V5W6A7B8C9D0E1F';

      test('Updates conversation metadata', async () => {
        const updateData = {
          priority: 'urgent',
          assignedTo: 'attorney-999',
          tags: ['urgent-matter', 'vip-client']
        };

        const resp = await worker.fetch(
          `${baseUrl}/firms/${testFirmId}/conversations/${testConversationId}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
          }
        );
        
        expect(resp.status).toBe(200);
        const data = await resp.json();
        
        expect(data.priority).toBe('urgent');
        expect(data.assignedTo).toBe('attorney-999');
        expect(data.tags).toEqual(['urgent-matter', 'vip-client']);
      });

      test('Creates audit log entry for updates', async () => {
        const updateData = {
          status: 'completed'
        };

        const resp = await worker.fetch(
          `${baseUrl}/firms/${testFirmId}/conversations/${testConversationId}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
          }
        );
        
        expect(resp.status).toBe(200);
        const data = await resp.json();
        
        // Check audit log has new entry
        const latestAudit = data.auditLog[0];
        expect(latestAudit.action).toBe('metadata_update');
        expect(latestAudit.performedBy).toBe('test-user-123');
        expect(latestAudit.details.status).toBe('completed');
      });
    });

    describe('POST /firms/{firmId}/conversations/{conversationId}/notes', () => {
      const testConversationId = '01HK8Z2X3Y4V5W6A7B8C9D0E1F';

      test('Adds internal note to conversation', async () => {
        const noteData = {
          note: 'This is a test note from the API test suite',
          type: 'assessment'
        };

        const resp = await worker.fetch(
          `${baseUrl}/firms/${testFirmId}/conversations/${testConversationId}/notes`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(noteData)
          }
        );
        
        expect(resp.status).toBe(201);
        const data = await resp.json();
        
        expect(data.noteContent).toBe(noteData.note);
        expect(data.noteType).toBe('assessment');
        expect(data.createdBy).toBe('test-user-123');
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('createdAt');
      });
    });

    describe('POST /firms/{firmId}/conversations/{conversationId}/actions', () => {
      const testConversationId = '01HK8Z2X3Y4V5W6A7B8C9D0E1F';

      test('Performs assignment action', async () => {
        const actionData = {
          action: 'assign',
          assigneeId: 'attorney-777',
          note: 'Assigning to specialist attorney'
        };

        const resp = await worker.fetch(
          `${baseUrl}/firms/${testFirmId}/conversations/${testConversationId}/actions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(actionData)
          }
        );
        
        expect(resp.status).toBe(200);
        const data = await resp.json();
        
        expect(data.success).toBe(true);
        expect(data.action).toBe('assign');
        expect(data.result.assignedTo).toBe('attorney-777');
        expect(data).toHaveProperty('timestamp');
      });

      test('Marks conversation as urgent', async () => {
        const actionData = {
          action: 'mark_urgent'
        };

        const resp = await worker.fetch(
          `${baseUrl}/firms/${testFirmId}/conversations/${testConversationId}/actions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(actionData)
          }
        );
        
        expect(resp.status).toBe(200);
        const data = await resp.json();
        
        expect(data.success).toBe(true);
        expect(data.result.priority).toBe('urgent');
      });
    });

    describe('DELETE /firms/{firmId}/conversations/{conversationId}', () => {
      test('Requires delete permission', async () => {
        // Create token without delete permission
        const limitedToken = generateTestToken({
          sub: 'test-user-456',
          email: 'limited@testfirm.com',
          'https://engage.lexara.com/firm_id': testFirmId,
          'https://engage.lexara.com/role': 'staff',
          permissions: ['conversations:read']
        });

        const resp = await worker.fetch(
          `${baseUrl}/firms/${testFirmId}/conversations/test-conversation-id`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${limitedToken}`
            }
          }
        );
        
        expect(resp.status).toBe(403);
        const data = await resp.json();
        expect(data.error.code).toBe('FORBIDDEN');
      });
    });
  });

  describe('CORS Support', () => {
    test('Handles preflight requests', async () => {
      const resp = await worker.fetch(`${baseUrl}/firms`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization'
        }
      });
      
      expect(resp.status).toBe(204);
      expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(resp.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(resp.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    });

    test('Adds CORS headers to responses', async () => {
      const resp = await worker.fetch(`${baseUrl}/health`, {
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });
      
      expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(resp.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
  });

  describe('Error Handling', () => {
    test('Returns 404 for unknown endpoints', async () => {
      const resp = await worker.fetch(`${baseUrl}/unknown-endpoint`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(resp.status).toBe(404);
      const data = await resp.json();
      expect(data.error.code).toBe('NOT_FOUND');
    });

    test('Returns 400 for invalid request body', async () => {
      const resp = await worker.fetch(
        `${baseUrl}/firms/${testFirmId}/conversations/test-id`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: 'invalid json'
        }
      );
      
      expect(resp.status).toBe(400);
    });
  });
});

// Helper function to generate test JWT tokens
function generateTestToken(payload: any): string {
  const secret = 'test-secret-key';
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
    issuer: 'https://test.auth0.com/',
    audience: 'https://api.engage.lexara.com'
  });
}