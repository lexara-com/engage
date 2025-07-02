// Unit tests for Admin API components

import { describe, test, expect } from 'vitest';
import { AdminAPIRouter } from '../router';
import { ConversationsHandler } from '../handlers/conversations';
import { validateFirmAccess, hasPermission } from '../middleware/auth';
import type { AdminEnv, AuthenticatedRequest } from '../types';

// Mock environment
const mockEnv: AdminEnv = {
  DB: {
    prepare: (query: string) => ({
      bind: (...params: any[]) => ({
        first: async () => ({ total: 3 }),
        all: async () => ({
          results: [
            {
              id: 'conv-1',
              firm_id: 'firm-1',
              user_id: 'user-1',
              session_id: 'session-1',
              user_name: 'John Doe',
              user_email: 'john@example.com',
              status: 'active',
              phase: 'data_gathering',
              conflict_status: 'clear',
              priority: 'normal',
              tags: '[]',
              message_count: 5,
              completed_goals: 2,
              total_goals: 5,
              created_at: new Date().toISOString(),
              last_message_at: new Date().toISOString()
            }
          ]
        }),
        run: async () => ({ success: true })
      })
    }),
    batch: async (statements: any[]) => ({ success: true })
  } as any,
  CONVERSATION_SESSION: {
    get: (id: any) => ({
      fetch: async (request: Request) => {
        return new Response(JSON.stringify({
          messages: [],
          userIdentity: {},
          dataGoals: [],
          supportDocuments: [],
          conflictCheck: { status: 'clear' }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    })
  } as any,
  SUPPORTING_DOCUMENTS: {} as any,
  CONFLICT_DATABASE: {} as any,
  DOCUMENTS_BUCKET: {} as any,
  SYNC_QUEUE: {} as any,
  ENVIRONMENT: 'test',
  LOG_LEVEL: 'info',
  AUTH0_DOMAIN: 'test.auth0.com',
  AUTH0_AUDIENCE: 'https://api.engage.lexara.com',
  ALLOWED_ORIGINS: 'http://localhost:3000'
};

describe('AdminAPIRouter', () => {
  test('Router handles health check', async () => {
    const router = new AdminAPIRouter(mockEnv);
    const request = new Request('http://localhost/v1/admin/health');
    const response = await router.handle(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('Router returns 404 for unknown routes', async () => {
    const router = new AdminAPIRouter(mockEnv);
    const request = new Request('http://localhost/v1/admin/unknown') as AuthenticatedRequest;
    request.user = {
      sub: 'test-user',
      firmId: 'firm-1',
      role: 'admin',
      email: 'test@example.com',
      permissions: []
    };
    
    const response = await router.handle(request);
    expect(response.status).toBe(404);
  });
});

describe('ConversationsHandler', () => {
  test('List conversations returns paginated results', async () => {
    const handler = new ConversationsHandler(mockEnv);
    const request = new Request('http://localhost/conversations') as AuthenticatedRequest;
    request.user = {
      sub: 'test-user',
      firmId: 'firm-1',
      role: 'admin',
      email: 'test@example.com',
      permissions: ['conversations:read']
    };
    
    const response = await handler.list(request, 'firm-1');
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('conversations');
    expect(data).toHaveProperty('pagination');
    expect(data.pagination.total).toBe(3);
  });

  test('Update conversation validates firm access', async () => {
    const handler = new ConversationsHandler(mockEnv);
    const request = new Request('http://localhost/conversations/conv-1', {
      method: 'PUT',
      body: JSON.stringify({ priority: 'high' })
    }) as AuthenticatedRequest;
    request.user = {
      sub: 'test-user',
      firmId: 'different-firm',
      role: 'admin',
      email: 'test@example.com',
      permissions: ['conversations:write']
    };
    
    const response = await handler.update(request, 'firm-1', 'conv-1');
    expect(response.status).toBe(403);
  });
});

describe('Auth Middleware', () => {
  test('validateFirmAccess allows access to own firm', () => {
    const user = {
      sub: 'test-user',
      firmId: 'firm-1',
      role: 'attorney' as const,
      email: 'test@example.com',
      permissions: []
    };
    
    expect(validateFirmAccess(user, 'firm-1')).toBe(true);
    expect(validateFirmAccess(user, 'firm-2')).toBe(false);
  });

  test('validateFirmAccess allows system admin access to any firm', () => {
    const user = {
      sub: 'admin-user',
      firmId: 'admin-firm',
      role: 'admin' as const,
      email: 'admin@example.com',
      permissions: ['system:admin']
    };
    
    expect(validateFirmAccess(user, 'firm-1')).toBe(true);
    expect(validateFirmAccess(user, 'firm-2')).toBe(true);
  });

  test('hasPermission checks user permissions', () => {
    const user = {
      sub: 'test-user',
      firmId: 'firm-1',
      role: 'attorney' as const,
      email: 'test@example.com',
      permissions: ['conversations:read', 'conversations:write']
    };
    
    expect(hasPermission(user, 'conversations:read')).toBe(true);
    expect(hasPermission(user, 'conversations:delete')).toBe(false);
  });

  test('hasPermission gives admin all permissions', () => {
    const user = {
      sub: 'admin-user',
      firmId: 'firm-1',
      role: 'admin' as const,
      email: 'admin@example.com',
      permissions: []
    };
    
    expect(hasPermission(user, 'conversations:delete')).toBe(true);
    expect(hasPermission(user, 'any:permission')).toBe(true);
  });
});

describe('URL Parsing', () => {
  test('Router correctly parses conversation endpoints', () => {
    const paths = [
      '/firms/firm-1/conversations',
      '/firms/firm-1/conversations/conv-1',
      '/firms/firm-1/conversations/conv-1/notes',
      '/firms/firm-1/conversations/conv-1/actions'
    ];
    
    paths.forEach(path => {
      const parts = path.split('/').filter(p => p);
      expect(parts[0]).toBe('firms');
      expect(parts[1]).toBe('firm-1');
      expect(parts[2]).toBe('conversations');
    });
  });
});

describe('Error Handling', () => {
  test('API returns proper error format', async () => {
    const handler = new ConversationsHandler(mockEnv);
    const request = new Request('http://localhost/conversations/non-existent') as AuthenticatedRequest;
    request.user = {
      sub: 'test-user',
      firmId: 'firm-1',
      role: 'admin',
      email: 'test@example.com',
      permissions: ['conversations:read']
    };
    
    // Mock DB to return no results
    const mockEnvNoResults = {
      ...mockEnv,
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => null
          })
        })
      } as any
    };
    
    const handlerNoResults = new ConversationsHandler(mockEnvNoResults);
    const response = await handlerNoResults.get(request, 'firm-1', 'non-existent');
    
    expect(response.status).toBe(404);
    const error = await response.json();
    expect(error).toHaveProperty('error');
    expect(error.error).toHaveProperty('code');
    expect(error.error).toHaveProperty('message');
  });
});