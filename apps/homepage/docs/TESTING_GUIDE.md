# Testing Guide for Lexara Engage

**Last Updated**: January 3, 2025
**Status**: 🚧 Tests Implemented, Fixes In Progress

## Overview

This guide explains our comprehensive testing strategy, following the Software Design Document requirement that **every function must be tested** and **tests must prove functionality works**.

## Current Test Status

- **Total Tests**: 32
- **Passing**: 10 ✅
- **Failing**: 22 ❌ (due to method/field name mismatches)
- **Framework**: Vitest with Cloudflare Workers mocks

## Testing Philosophy

1. **100% Critical Path Coverage**: Every business-critical function must have tests
2. **Test-First Development**: Write tests alongside or before implementation
3. **Tests as Documentation**: Well-written tests serve as living documentation
4. **Continuous Verification**: Tests run on every commit and PR

## Test Structure

```
apps/homepage/tests/
├── unit/                    # Isolated function tests
│   ├── db/                  # Database operation tests
│   │   ├── db_firm.test.ts
│   │   ├── db_user.test.ts
│   │   └── db_conversation.test.ts (pending)
│   └── utils/               # Utility function tests
│       ├── conflict.test.ts
│       └── validation.test.ts
├── integration/             # Component interaction tests
│   ├── api/                 # API endpoint tests
│   │   ├── firm_registration.test.ts
│   │   └── user_management.test.ts (pending)
│   └── services/            # Service integration tests (pending)
├── e2e/                     # End-to-end tests (Playwright)
│   ├── auth_flow.spec.ts (pending)
│   └── registration.spec.ts (pending)
├── fixtures/                # Test data and mocks
│   └── mockData.ts
├── reports/                 # Test coverage reports
└── setup.ts                 # Global test configuration
```

## Running Tests

### Quick Start

```bash
# Run all tests
pnpm test

# Or from monorepo root
pnpm test --filter=homepage

# Run with coverage
pnpm run test:coverage

# Run specific test file
pnpm vitest run tests/unit/db/db_firm.test.ts

# Run in watch mode
npm run test:watch

# Run specific test suites
./scripts/run-tests.sh --unit
./scripts/run-tests.sh --integration
./scripts/run-tests.sh --all --coverage
```

### Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests once |
| `npm run test:unit` | Run only unit tests |
| `npm run test:integration` | Run only integration tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:watch` | Run tests in watch mode |

## Writing Tests

### Unit Tests

Unit tests verify individual functions in isolation:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { validateEmail } from '@/utils/validation';

describe('validateEmail', () => {
  it('should accept valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user+tag@domain.co.uk')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
  });
});
```

### Integration Tests

Integration tests verify component interactions:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/pages/api/v1/firm/register';
import { createMockContext } from '@tests/setup';

describe('Firm Registration API', () => {
  it('should create firm and user with valid data', async () => {
    const context = createMockContext({
      request: {
        method: 'POST',
        json: async () => validRegistrationData,
      },
    });

    const response = await POST(context);
    
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        firmId: expect.any(String),
        userId: expect.any(String),
      },
    });
  });
});
```

### E2E Tests (Playwright)

End-to-end tests verify complete user workflows:

```typescript
import { test, expect } from '@playwright/test';

test('firm registration flow', async ({ page }) => {
  // Navigate to registration
  await page.goto('https://dev-www.lexara.app/firm/signup');
  
  // Fill form
  await page.fill('[name="firmName"]', 'Test Law Firm');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'SecurePass123!');
  
  // Submit and verify
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/firm/dashboard');
});
```

## Mock Data and Fixtures

Use consistent test data from `tests/fixtures/mockData.ts`:

```typescript
import { mockFirms, mockUsers, generateMockFirm } from '@tests/fixtures/mockData';

// Use predefined mocks
const firm = mockFirms.starterFirm;

// Generate new mock data
const newFirm = generateMockFirm({
  name: 'Custom Test Firm',
  plan: 'professional',
});
```

## Coverage Requirements

Per the Software Design Document:
- **Minimum 80%** overall coverage
- **100%** coverage for critical paths:
  - Authentication flows
  - Database operations
  - API endpoints
  - Security functions

View coverage reports:
```bash
npm run test:coverage
open tests/reports/index.html
```

## Testing Checklist

Before submitting code:

- [ ] All new functions have unit tests
- [ ] Integration tests cover component interactions
- [ ] No decrease in code coverage
- [ ] All tests pass locally
- [ ] Tests are readable and well-documented
- [ ] Mock data uses fixtures, not hardcoded values
- [ ] Error cases are tested
- [ ] Edge cases are covered

## Common Testing Patterns

### Testing Database Operations

```typescript
// Mock D1 database
const mockDb = createMockD1Database();
const dbClient = new AuthorizationDatabaseClient(mockDb);

// Test CRUD operations
const firm = await dbClient.createFirm(firmData);
expect(firm.id).toBeDefined();
```

### Testing API Endpoints

```typescript
// Create mock context with Auth0 credentials
const context = createMockContext({
  env: {
    AUTH0_DOMAIN: 'test.auth0.com',
    AUTH0_CLIENT_ID: 'test-client',
  },
});

// Test endpoint
const response = await POST(context);
```

### Testing Auth0 Integration

```typescript
// Mock fetch for Auth0 calls
global.fetch = vi.fn()
  .mockResolvedValueOnce({
    ok: true,
    json: async () => ({ access_token: 'mock-token' }),
  });
```

## Continuous Integration

Tests run automatically on:
- Every commit
- Pull requests
- Pre-deployment

Failed tests block merges and deployments.

## Troubleshooting

### Current Test Failures (22 tests)

The majority of test failures are due to implementation differences:

1. **Method Name Mismatches**
   - Tests expect: `getFirmById()`, `getUserById()`, `listUsers()`
   - Actual methods: `getFirm()`, `getUser()`, `listFirmUsers()`
   - Missing methods: `deleteFirm()`, `listFirms()`, `updateUserLastLogin()`

2. **Field Name Differences**
   - Tests use: `firmId`, `auth0UserId`, `firstName`, `lastName`
   - Database uses: `firm_id`, `auth0_id`, `first_name`, `last_name`

3. **Multi-tenant Isolation**
   - Tests expect: `getUser(firmId, userId)`
   - Actual: `getUser(userId)` - no firm isolation at method level
   - **Security Risk**: This needs immediate attention

### Common Issues

1. **"Cannot find module '@/...'"**
   - Update imports to use relative paths
   - Or configure path aliases in `vitest.config.ts`

2. **"Cannot set property crypto"**
   - Fixed by using `Object.defineProperty` in setup.ts

3. **"No test suite found"**
   - Remove or update empty test files

4. **Method signature mismatches**
   - Update tests to match actual implementation
   - Or add missing methods to database client

## Best Practices

1. **Descriptive Test Names**: Use clear, specific descriptions
2. **Arrange-Act-Assert**: Structure tests consistently
3. **One Assertion Per Test**: Keep tests focused
4. **Mock External Services**: Never call real APIs in tests
5. **Clean Up**: Reset mocks between tests
6. **Test Data**: Use fixtures, not production data

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- Software Design Document Section 11: Testing Requirements