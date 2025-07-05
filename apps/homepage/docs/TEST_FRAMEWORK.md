# Test Framework Documentation

**Last Updated**: January 3, 2025  
**Status**: ✅ Framework Implemented, 🚧 Tests Need Fixes

## Overview

The Lexara Engage testing framework uses Vitest for unit and integration testing, with comprehensive mocks for Cloudflare Workers, D1 Database, Auth0, and Durable Objects.

## Framework Architecture

### Test Runner: Vitest
- Fast, Vite-based test runner
- Native TypeScript support
- Compatible with Cloudflare Workers environment
- Built-in coverage reporting

### Test Structure
```
tests/
├── unit/                    # Isolated unit tests
│   └── db/                  # Database operations
├── integration/             # API endpoint tests
├── e2e/                     # End-to-end tests (planned)
├── fixtures/                # Mock data
└── setup.ts                 # Global test configuration
```

## Configuration

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './tests/reports',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests')
    }
  }
});
```

### Global Test Setup (setup.ts)
```typescript
import { vi, beforeEach } from 'vitest';

// Mock console to reduce noise
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock Cloudflare crypto
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid',
    getRandomValues: (array) => array
  },
  writable: true,
  configurable: true
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Mock Infrastructure

### D1 Database Mock
```typescript
export const createMockD1Database = () => ({
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    all: vi.fn(),
    run: vi.fn()
  })
});
```

### Auth0 Mock
```typescript
export const createMockAuth0Response = (overrides = {}) => ({
  user_id: 'auth0|123456789',
  email: 'test@example.com',
  app_metadata: { 
    firmId: 'firm_123', 
    permissions: ['firm:admin'] 
  },
  ...overrides
});
```

### Durable Object Mock
```typescript
export const createMockDurableObject = () => ({
  idFromName: vi.fn().mockReturnValue('mock-do-id'),
  get: vi.fn().mockReturnValue({
    fetch: vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }))
    )
  })
});
```

### Request Context Mock
```typescript
export const createMockContext = (overrides: any = {}) => ({
  request: createMockRequest(),
  locals: {
    runtime: {
      env: {
        DB: createMockD1Database(),
        FIRM_REGISTRY: createMockDurableObject(),
        AUTH0_DOMAIN: 'test.auth0.com',
        AUTH0_CLIENT_ID: 'test-client-id',
        AUTH0_CLIENT_SECRET: 'test-client-secret',
        ...overrides.env,
      }
    }
  },
  ...overrides
});
```

## Test Data Fixtures

### Mock Firms
```typescript
export const mockFirms = {
  starterFirm: {
    id: 'firm_starter_123',
    name: 'Smith & Associates',
    plan: 'starter',
    settings: { size: '1-5', practiceAreas: ['personal_injury'] },
    status: 'active'
  },
  professionalFirm: { /* ... */ },
  suspendedFirm: { /* ... */ }
};
```

### Mock Users
```typescript
export const mockUsers = {
  adminUser: {
    id: 'user_admin_123',
    firm_id: 'firm_123',
    auth0_id: 'auth0|admin123',
    email: 'admin@smithlaw.com',
    role: 'admin',
    permissions: { 'firm:admin': true }
  },
  staffUser: { /* ... */ },
  inactiveUser: { /* ... */ }
};
```

## Writing Tests

### Unit Test Example
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationDatabaseClient } from '../../../src/db/client';

describe('Database - Firm Operations', () => {
  let dbClient: AuthorizationDatabaseClient;
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockD1Database();
    dbClient = new AuthorizationDatabaseClient(mockDb);
  });

  it('should create a new firm', async () => {
    const firmData = {
      name: 'Test Law Firm',
      plan: 'starter'
    };

    const mockPrepare = mockDb.prepare();
    mockPrepare.run.mockResolvedValue({ success: true });
    
    const result = await dbClient.createFirm(firmData);
    
    expect(mockDb.prepare).toHaveBeenCalled();
    expect(result).toHaveProperty('id');
  });
});
```

### Integration Test Example
```typescript
describe('API Integration - Firm Registration', () => {
  it('should register a firm with valid data', async () => {
    // Mock Auth0 responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => createMockAuth0Response()
      });

    const context = createMockContext({
      request: {
        method: 'POST',
        json: async () => validRegistrationData
      }
    });

    const response = await POST(context);
    
    expect(response.status).toBe(201);
  });
});
```

## Current Test Status

### Summary
- **Total Tests**: 32
- **Passing**: 10 (31%)
- **Failing**: 22 (69%)

### Passing Tests ✅
1. Input validation (email, password)
2. Required field validation
3. Terms acceptance
4. Auth0 error handling
5. Database error handling
6. Unique ID generation
7. Durable Object integration

### Failing Tests ❌
Primary causes:
1. **Method name mismatches** (15 tests)
2. **Field name differences** (5 tests)
3. **Missing multi-tenant isolation** (2 tests)

## Coverage Requirements

Per the Software Design Document:
- **Minimum**: 80% overall coverage
- **Critical Paths**: 100% coverage required for:
  - Authentication flows
  - Database operations
  - API endpoints
  - Security functions

## Running Tests

```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests only
pnpm test:integration

# With coverage
pnpm test:coverage

# Watch mode
pnpm test:watch

# Specific file
pnpm vitest run tests/unit/db/db_firm.test.ts
```

## Debugging Tests

### VSCode Launch Configuration
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/vitest",
  "args": ["run", "${file}"],
  "console": "integratedTerminal"
}
```

### Common Issues and Solutions

1. **Import path errors**
   - Use relative imports instead of aliases
   - Or configure vitest.config.ts aliases

2. **Mock not working**
   - Ensure vi.clearAllMocks() in beforeEach
   - Check mock implementation matches expected API

3. **Async test failures**
   - Always await async operations
   - Use proper async test syntax

## Next Steps

1. **Fix method name mismatches** (Priority: High)
   - Update tests to use actual method names
   - Or add missing methods to implementation

2. **Standardize field names** (Priority: High)
   - Decide on camelCase vs snake_case
   - Update either tests or implementation

3. **Add multi-tenant security** (Priority: Critical)
   - Update database methods to require firmId
   - Add security tests

4. **Implement E2E tests** (Priority: Medium)
   - Set up Playwright
   - Test complete user flows