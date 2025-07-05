# How to Run the Tests

## Quick Start

From your terminal, run these commands:

```bash
# Option 1: From monorepo root
cd /Users/shawnswaner/code/lexara/cf_version
pnpm test --filter=homepage

# Option 2: From homepage directory
cd /Users/shawnswaner/code/lexara/cf_version/apps/homepage
pnpm test

# Option 3: Direct vitest command
cd /Users/shawnswaner/code/lexara/cf_version/apps/homepage
npx vitest run
```

## Expected Issues and Fixes

### Issue 1: Import Path Errors
If you see errors about missing modules like `@/db/client`, you need to either:

1. Fix the import paths in test files (already partially done)
2. Or add path aliases to `vitest.config.ts`:

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@tests': path.resolve(__dirname, './tests')
  }
}
```

### Issue 2: Type Mismatches
The database uses snake_case but tests use camelCase. Update test data:

```typescript
// Change from:
firmId: 'firm_123'
// To:
firm_id: 'firm_123'
```

### Issue 3: API Route Structure
The integration test expects a `POST` export but the actual file uses Astro's APIRoute.

## What You Should See

Once the tests run, you'll see:
- Total test files: 3
- Total test cases: 28
- Coverage of all critical paths
- Detailed error messages if any tests fail

## To Debug Failed Tests

```bash
# Run with verbose output
npx vitest run --reporter=verbose

# Run a specific test file
npx vitest run tests/unit/db/db_firm.test.ts

# Run in watch mode for development
npx vitest --watch
```

## View Coverage Report

```bash
# Generate coverage
pnpm test:coverage

# View HTML report
open tests/reports/index.html
```

Please run any of these commands and share the output so I can help fix any remaining issues!