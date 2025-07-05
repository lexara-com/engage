/**
 * Vitest Global Test Setup
 * 
 * This file runs before all tests and sets up the test environment
 */

import { vi, beforeEach } from 'vitest';

// Mock console methods to reduce noise in tests
// But keep error for debugging
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: console.error, // Keep real error for debugging
};

// Mock Cloudflare Workers globals
// Use Object.defineProperty to avoid "Cannot set property" error
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  },
  writable: true,
  configurable: true
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Global test utilities
export const createMockRequest = (options: RequestInit & { url?: string } = {}) => {
  const url = options.url || 'http://localhost:3000/test';
  const headers = new Headers(options.headers || {});
  return new Request(url, {
    method: options.method || 'GET',
    headers: headers,
    body: options.body,
  });
};

export const createMockContext = (overrides: any = {}) => {
  return {
    request: createMockRequest(),
    locals: {
      runtime: {
        env: {
          DB: createMockD1Database(),
          FIRM_REGISTRY: createMockDurableObject(),
          AUTH0_DOMAIN: 'test.auth0.com',
          AUTH0_CLIENT_ID: 'test-client-id',
          AUTH0_CLIENT_SECRET: 'test-client-secret',
          ENVIRONMENT: 'test',
          ...overrides.env,
        },
      },
    },
    ...overrides,
  };
};

export const createMockD1Database = () => {
  const mockResults: any[] = [];
  
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: mockResults }),
      first: vi.fn().mockResolvedValue(mockResults[0]),
      run: vi.fn().mockResolvedValue({ 
        success: true, 
        meta: { 
          changes: 1, 
          last_row_id: 1,
          duration: 0
        } 
      }),
    }),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({}),
  };
};

export const createMockDurableObject = () => {
  return {
    idFromName: vi.fn().mockReturnValue('test-do-id'),
    get: vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, firmId: 'test-firm-id' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      ),
    }),
  };
};

export const createMockAuth0Response = (userData: any = {}) => {
  return {
    user_id: 'auth0|123456',
    email: 'test@example.com',
    name: 'Test User',
    ...userData,
  };
};

// Wait for async operations
export const waitFor = async (callback: () => boolean | Promise<boolean>, timeout = 5000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await callback()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error('Timeout waiting for condition');
};