/**
 * Test Setup - Comprehensive testing infrastructure for API Worker
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Miniflare } from 'miniflare';
import { Response } from '@cloudflare/workers-types';

// Test environment setup
export interface TestEnvironment {
  mf: Miniflare;
  db: D1Database;
  env: {
    CONVERSATION_SESSION: DurableObjectNamespace;
    USER_IDENTITY: DurableObjectNamespace;
    FIRM_INDEX_DB: D1Database;
    PLATFORM_DB: D1Database;
    KNOWLEDGE_BASE: VectorizeIndex;
    CONFLICT_DB: VectorizeIndex;
    API_CACHE: KVNamespace;
    ENVIRONMENT: string;
    API_VERSION: string;
    AUTH0_DOMAIN: string;
    AUTH0_AUDIENCE: string;
  };
}

let testEnv: TestEnvironment;

/**
 * Initialize test environment with Miniflare
 */
export async function setupTestEnvironment(): Promise<TestEnvironment> {
  const mf = new Miniflare({
    modules: true,
    script: `
      export default {
        async fetch(request, env, ctx) {
          return new Response('Test worker', { status: 200 });
        }
      };
    `,
    bindings: {
      ENVIRONMENT: 'test',
      API_VERSION: '1.0.0-test',
      AUTH0_DOMAIN: 'test.auth0.com',
      AUTH0_AUDIENCE: 'test-api',
    },
    d1Databases: {
      FIRM_INDEX_DB: 'test-firm-index',
      PLATFORM_DB: 'test-platform'
    },
    kvNamespaces: {
      API_CACHE: 'test-cache'
    },
    durableObjects: {
      CONVERSATION_SESSION: 'ConversationSession',
      USER_IDENTITY: 'UserIdentity'
    }
  });

  const env = await mf.getBindings();

  testEnv = {
    mf,
    db: env.FIRM_INDEX_DB,
    env: env as any
  };

  return testEnv;
}

/**
 * Initialize database schemas for testing
 */
export async function initializeTestDatabase(db: D1Database) {
  // Create all index tables for testing
  const schemas = [
    // Conversation index
    `CREATE TABLE IF NOT EXISTS conversation_index (
      firmId TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      userId TEXT,
      clientName TEXT,
      clientEmail TEXT,
      practiceArea TEXT,
      status TEXT,
      phase TEXT,
      assignedTo TEXT,
      conflictStatus TEXT,
      goalsCompleted INTEGER,
      goalsTotal INTEGER,
      dataQualityScore INTEGER,
      createdAt TEXT,
      lastActivity TEXT,
      isDeleted BOOLEAN DEFAULT FALSE,
      PRIMARY KEY (firmId, sessionId)
    )`,
    
    // User index
    `CREATE TABLE IF NOT EXISTS user_index (
      firmId TEXT NOT NULL,
      userId TEXT NOT NULL,
      auth0UserId TEXT,
      email TEXT,
      name TEXT,
      role TEXT,
      status TEXT,
      lastLogin TEXT,
      conversationCount INTEGER DEFAULT 0,
      createdAt TEXT,
      PRIMARY KEY (firmId, userId)
    )`,
    
    // Audit log index
    `CREATE TABLE IF NOT EXISTS audit_log_index (
      firmId TEXT NOT NULL,
      auditId TEXT NOT NULL,
      userId TEXT,
      action TEXT,
      resourceType TEXT,
      resourceId TEXT,
      timestamp TEXT,
      ipAddress TEXT,
      userAgent TEXT,
      details TEXT,
      PRIMARY KEY (firmId, auditId)
    )`,
    
    // Case assignment index
    `CREATE TABLE IF NOT EXISTS case_assignment_index (
      firmId TEXT NOT NULL,
      assignmentId TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      assignedTo TEXT NOT NULL,
      assignedBy TEXT NOT NULL,
      assignedAt TEXT,
      status TEXT,
      priority TEXT,
      dueDate TEXT,
      completedAt TEXT,
      notes TEXT,
      PRIMARY KEY (firmId, assignmentId)
    )`,
    
    // Firm config index
    `CREATE TABLE IF NOT EXISTS firm_config_index (
      firmId TEXT NOT NULL,
      configKey TEXT NOT NULL,
      configValue TEXT,
      configType TEXT,
      category TEXT,
      lastModified TEXT,
      modifiedBy TEXT,
      PRIMARY KEY (firmId, configKey)
    )`
  ];

  for (const schema of schemas) {
    await db.exec(schema);
  }
}

/**
 * Seed test data
 */
export async function seedTestData(db: D1Database) {
  const testFirmId = 'firm_test_001';
  const testUserId = 'user_test_001';
  const testSessionId = 'session_test_001';

  // Seed conversations
  await db.prepare(`
    INSERT INTO conversation_index (
      firmId, sessionId, userId, clientName, clientEmail, practiceArea,
      status, phase, conflictStatus, goalsCompleted, goalsTotal, 
      dataQualityScore, createdAt, lastActivity, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    testFirmId, testSessionId, testUserId, 'John Doe', 'john@example.com',
    'personal_injury', 'active', 'pre_login', 'pending', 3, 5, 75,
    new Date().toISOString(), new Date().toISOString(), false
  ).run();

  // Seed users
  await db.prepare(`
    INSERT INTO user_index (
      firmId, userId, auth0UserId, email, name, role, status, 
      lastLogin, conversationCount, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    testFirmId, testUserId, 'auth0|test123', 'test@lawfirm.com',
    'Test Attorney', 'attorney', 'active', new Date().toISOString(),
    1, new Date().toISOString()
  ).run();

  // Seed firm settings
  await db.prepare(`
    INSERT INTO firm_config_index (
      firmId, configKey, configValue, configType, category, lastModified, modifiedBy
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    testFirmId, 'firm_name', 'Test Law Firm', 'string', 'basic_info',
    new Date().toISOString(), testUserId
  ).run();
}

/**
 * Clean up test data between tests
 */
export async function cleanupTestData(db: D1Database) {
  const tables = [
    'conversation_index',
    'user_index', 
    'audit_log_index',
    'case_assignment_index',
    'firm_config_index'
  ];

  for (const table of tables) {
    await db.exec(`DELETE FROM ${table}`);
  }
}

/**
 * Create test auth context
 */
export function createTestAuthContext(overrides?: Partial<{
  firmId: string;
  userId: string;
  auth0UserId: string;
  role: string;
  permissions: string[];
}>) {
  return {
    firm: {
      firmId: overrides?.firmId || 'firm_test_001',
      subscription: 'professional',
      permissions: ['view_conversations', 'manage_users'],
      rateLimit: { requests: 1000, window: 3600 }
    },
    user: {
      userId: overrides?.userId || 'user_test_001',
      auth0UserId: overrides?.auth0UserId || 'auth0|test123',
      role: overrides?.role || 'attorney',
      email: 'test@lawfirm.com',
      permissions: overrides?.permissions || ['view_conversations', 'assign_conversations']
    },
    audit: {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      requestId: 'test_request_123'
    }
  };
}

/**
 * Mock JWT token for testing
 */
export function createTestJWT(claims?: Record<string, any>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: 'auth0|test123',
    org: 'firm_test_001',
    role: 'attorney',
    permissions: ['view_conversations', 'assign_conversations'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims
  };

  // Simple base64 encoding for testing (not secure, only for tests)
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = 'test_signature';

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Create test HTTP request
 */
export function createTestRequest(options: {
  method?: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
  authToken?: string;
}): Request {
  const { method = 'GET', path, body, headers = {}, authToken } = options;

  const url = `https://api-test.lexara.app${path}`;
  
  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    ...headers
  });

  if (authToken) {
    requestHeaders.set('Authorization', `Bearer ${authToken}`);
  }

  const requestInit: RequestInit = {
    method,
    headers: requestHeaders
  };

  if (body && method !== 'GET') {
    requestInit.body = JSON.stringify(body);
  }

  return new Request(url, requestInit);
}

/**
 * Test utility to wait for async operations
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Test data factories
 */
export const TestDataFactory = {
  conversation: (overrides?: Partial<any>) => ({
    sessionId: 'session_' + Math.random().toString(36).substr(2, 9),
    userId: 'user_' + Math.random().toString(36).substr(2, 9),
    firmId: 'firm_test_001',
    clientName: 'Test Client',
    clientEmail: 'client@example.com',
    practiceArea: 'personal_injury',
    status: 'active',
    phase: 'pre_login',
    conflictStatus: 'pending',
    goalsCompleted: 2,
    goalsTotal: 5,
    dataQualityScore: 70,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    isDeleted: false,
    ...overrides
  }),

  user: (overrides?: Partial<any>) => ({
    userId: 'user_' + Math.random().toString(36).substr(2, 9),
    firmId: 'firm_test_001',
    auth0UserId: 'auth0|' + Math.random().toString(36).substr(2, 9),
    email: 'user@lawfirm.com',
    name: 'Test User',
    role: 'attorney',
    status: 'active',
    lastLogin: new Date().toISOString(),
    conversationCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides
  }),

  assignment: (overrides?: Partial<any>) => ({
    assignmentId: 'assign_' + Math.random().toString(36).substr(2, 9),
    sessionId: 'session_test_001',
    firmId: 'firm_test_001',
    assignedTo: 'user_test_001',
    assignedBy: 'user_test_002',
    assignedAt: new Date().toISOString(),
    status: 'pending',
    priority: 'normal',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Test assignment',
    ...overrides
  })
};

// Global test hooks
beforeAll(async () => {
  testEnv = await setupTestEnvironment();
  await initializeTestDatabase(testEnv.db);
});

afterAll(async () => {
  if (testEnv?.mf) {
    await testEnv.mf.dispose();
  }
});

beforeEach(async () => {
  if (testEnv?.db) {
    await seedTestData(testEnv.db);
  }
});

afterEach(async () => {
  if (testEnv?.db) {
    await cleanupTestData(testEnv.db);
  }
});

export { testEnv };