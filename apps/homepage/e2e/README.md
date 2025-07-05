# E2E Testing with Playwright

This directory contains end-to-end tests for the Lexara homepage application using Playwright.

## Setup

1. Install Playwright browsers:
```bash
pnpm exec playwright install
```

2. Install system dependencies (if needed):
```bash
pnpm exec playwright install-deps
```

## Running Tests

### Run all tests
```bash
pnpm test:e2e
```

### Run tests in headed mode (see browser)
```bash
pnpm test:e2e:headed
```

### Run tests in UI mode (interactive)
```bash
pnpm test:e2e:ui
```

### Run specific test file
```bash
pnpm exec playwright test e2e/tests/registration.spec.ts
```

### Debug tests
```bash
pnpm test:e2e:debug
```

## Test Structure

- `/fixtures` - Test fixtures and helpers (auth, data generators)
- `/pages` - Page Object Models for better test organization
- `/tests` - Actual test specifications

## Writing Tests

### Basic Test
```typescript
import { test, expect } from '@playwright/test';

test('should do something', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Lexara');
});
```

### Authenticated Test
```typescript
import { test, expect } from '../fixtures/auth';

test('should access protected page', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage).toHaveURL('/dashboard');
});
```

## Best Practices

1. Use Page Object Models for complex pages
2. Keep tests independent and idempotent
3. Use data-testid attributes for reliable element selection
4. Mock external services when appropriate
5. Run tests in parallel when possible

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Before deployment

## Debugging Failed Tests

1. Check the HTML report: `pnpm exec playwright show-report`
2. Use trace viewer for failed tests: `pnpm exec playwright show-trace`
3. Take screenshots: Tests automatically capture screenshots on failure

## Environment Variables

Create a `.env.test` file for test-specific configuration:
```env
AUTH0_TEST_USERNAME=test@example.com
AUTH0_TEST_PASSWORD=TestPassword123!
TEST_BASE_URL=http://localhost:4321
```

## Troubleshooting

### Tests timing out
- Increase timeout in playwright.config.ts
- Check if dev server is running
- Verify network conditions

### Authentication issues
- Ensure Auth0 test tenant is configured
- Check test user credentials
- Verify cookies/storage setup

### Element not found
- Use playwright inspector: `pnpm exec playwright test --debug`
- Add data-testid attributes to elements
- Check for dynamic content loading