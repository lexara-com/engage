# Testing Guide for Firm Portal

This guide explains how to test the D1 database integration and invitation system.

## Test Structure

### Unit Tests
- **Location**: `src/**/*.test.ts`
- **Purpose**: Test individual components and utilities
- **Example**: `src/utils/invitation-storage-d1.test.ts`

### Integration Tests
- **Location**: `tests/integration/**/*.test.ts`
- **Purpose**: Test complete user flows and API interactions
- **Example**: `tests/integration/invitation-flow.test.ts`

### D1 Binding Tests
- **Location**: `tests/d1-binding.test.ts`
- **Purpose**: Verify D1 database binding is properly configured

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Unit tests only
npm run test:run

# Integration tests only
npm run test:integration

# D1 binding tests
npm run test:d1

# With coverage
npm run test:coverage

# Interactive UI
npm run test:ui
```

## Test Coverage Areas

### 1. D1 Database Binding
- ✅ Verifies `context.env.DB` is available in API routes
- ✅ Tests database connection and query execution
- ✅ Validates error handling when D1 is not configured

### 2. Invitation Storage
- ✅ Creating new invitations
- ✅ Preventing duplicate invitations
- ✅ Retrieving invitations by firm
- ✅ Updating invitation status
- ✅ Email validation and normalization
- ✅ Automatic expiration handling

### 3. API Endpoints
- ✅ Authentication requirements
- ✅ Role-based access control
- ✅ Input validation
- ✅ Error responses
- ✅ Success responses with proper data

### 4. Integration Flows
- ✅ Complete invitation creation flow
- ✅ Invitation list retrieval
- ✅ UI page access control
- ✅ Session management

## Writing New Tests

### Testing D1 Database Operations
```typescript
import { describe, it, expect } from 'vitest';
import { InvitationStorageD1 } from '@/utils/invitation-storage-d1';

describe('Database Operations', () => {
  it('should handle D1 operations', async () => {
    const mockDb = createMockD1Database();
    const storage = new InvitationStorageD1(mockDb);
    
    // Test your D1 operations
    const result = await storage.saveInvitation({...});
    expect(result).toBeDefined();
  });
});
```

### Testing API Endpoints
```typescript
describe('API Endpoint', () => {
  it('should check D1 binding', async () => {
    const context = {
      env: { DB: mockD1Database },
      locals: { user: testUser }
    };
    
    const response = await POST(context);
    expect(response.status).toBe(200);
  });
});
```

## Continuous Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main`

GitHub Actions workflow includes:
1. Unit test execution
2. Build verification
3. D1 binding validation
4. Schema validation
5. Integration tests

## Debugging Test Failures

### D1 Binding Errors
If you see "Database not configured" errors:
1. Check that `context.env.DB` is properly accessed in the API route
2. Verify wrangler.toml has the correct D1 binding configuration
3. Ensure the test environment provides the mock D1 database

### Schema Validation Errors
If schema tests fail:
1. Verify `schema.sql` exists and is valid
2. Check that all required tables are defined
3. Ensure test data (firm_test_001) is included

### Integration Test Failures
If integration tests fail:
1. Check that the build completed successfully
2. Verify the worker can start with test configuration
3. Ensure session cookies are properly formatted

## Test Database

For local testing, a separate D1 database instance is used:
- **Name**: `test-lexara-firm-portal`
- **Configuration**: Set in `vitest.config.ts`
- **Schema**: Same as production (`schema.sql`)

## Best Practices

1. **Always test D1 binding**: Every API route that uses D1 should verify the binding exists
2. **Mock external dependencies**: Use mocks for Auth0, email services, etc.
3. **Test error cases**: Include tests for missing data, invalid input, and system failures
4. **Keep tests fast**: Use in-memory mocks instead of real databases where possible
5. **Test the contract**: Focus on API contracts and user-facing behavior

## Troubleshooting

### "Cannot find module" errors
```bash
npm install
npm run build
```

### "D1 binding not found" in tests
Check that your test setup includes:
```typescript
const context = {
  env: { DB: mockDatabase },
  // ... other context properties
};
```

### Tests timing out
- Increase timeout in vitest.config.ts
- Check for unresolved promises
- Verify mock implementations return properly