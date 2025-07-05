# E2E Test Authentication Setup

## Overview
The Playwright E2E tests can authenticate in two ways:
1. **Real Auth0 Login** (recommended for integration testing)
2. **Mock Authentication** (faster, used as fallback)

## Authentication Flow

### 1. Environment Variables
The tests look for credentials in `.env.e2e`:
```bash
E2E_TEST_EMAIL=your-test-email@example.com
E2E_TEST_PASSWORD=your-test-password
```

### 2. Authentication Decision Tree
```
┌─────────────────────────┐
│ Are E2E credentials set?│
└───────────┬─────────────┘
            │
    ┌───────┴────────┐
    │                │
   YES              NO
    │                │
    ▼                ▼
┌─────────────┐  ┌──────────────┐
│Auth0 Login  │  │Mock Auth     │
│Flow         │  │(Immediate)   │
└──────┬──────┘  └──────────────┘
       │
   ┌───┴────┐
   │Success?│
   └───┬────┘
       │
   ┌───┴────┐
  YES      NO
   │        │
   ▼        ▼
┌──────┐ ┌──────────────┐
│Done  │ │Fallback to   │
│      │ │Mock Auth     │
└──────┘ └──────────────┘
```

### 3. Real Auth0 Login Process
When credentials are provided:
1. Navigate to `/firm/login`
2. Wait for redirect to Auth0 domain
3. Fill email and password fields
4. Submit form
5. Wait for callback redirect
6. Verify authentication success

### 4. Mock Authentication Process
When using mock auth:
1. Sets `firm_session` cookie with user data
2. Populates localStorage with Auth0 user info
3. Includes test user details:
   - Email: test@example.com (or from env)
   - Name: Test 7 Lawyer
   - Firm ID: firm_test_123
   - Role: admin

## Setup Instructions

### Step 1: Create Environment File
```bash
cp .env.e2e.example .env.e2e
```

### Step 2: Configure Test Credentials

#### Option A: Real Auth0 Account (Recommended)
1. Create a test user in Auth0
2. Add credentials to `.env.e2e`:
   ```bash
   E2E_TEST_EMAIL=test.lawyer@example.com
   E2E_TEST_PASSWORD=SecureTestPassword123!
   E2E_TEST_FIRM_ID=your-test-firm-id
   ```

#### Option B: Mock Authentication (Quick Setup)
Leave `.env.e2e` empty or partially filled:
```bash
# Mock auth will be used automatically
E2E_TEST_USER_NAME="Test Lawyer"
E2E_TEST_USER_ROLE=admin
```

### Step 3: Install Dependencies
```bash
pnpm install
```

### Step 4: Run Tests
```bash
# Run with real or mock auth (based on .env.e2e)
pnpm test:e2e

# Force mock auth (ignore credentials)
MOCK_AUTH=true pnpm test:e2e
```

## Security Best Practices

### ⚠️ Important Security Notes
1. **Never use production credentials in tests**
2. **Create dedicated test accounts with limited permissions**
3. **Add `.env.e2e` to `.gitignore`** (never commit credentials)
4. **Use strong passwords even for test accounts**
5. **Rotate test credentials regularly**

### Test Account Recommendations
- Create a separate Auth0 tenant for testing
- Use email addresses with `+test` suffix (e.g., `admin+test@firm.com`)
- Limit test account permissions to minimum required
- Set up test data isolation (separate test database/namespace)

## Troubleshooting

### Common Issues

#### 1. "Auth0 login failed" Error
**Cause**: Incorrect credentials or Auth0 configuration
**Solution**: 
- Verify credentials in `.env.e2e`
- Check Auth0 application settings
- Ensure callback URL includes test domain

#### 2. "Cookie not set" Warning
**Cause**: Domain mismatch between test URL and cookie domain
**Solution**: 
- Check `PLAYWRIGHT_BASE_URL` matches cookie domain
- Verify HTTPS is used for secure cookies

#### 3. Tests Pass Locally but Fail in CI
**Cause**: Missing environment variables in CI
**Solution**: 
- Add secrets to GitHub Actions/CI platform
- Use mock auth for CI if Auth0 not available

### Debug Mode
Enable auth debugging:
```bash
DEBUG=pw:auth pnpm test:e2e
```

This will log:
- Authentication method used (real vs mock)
- Cookie setting attempts
- Auth0 navigation steps
- Fallback triggers

## CI/CD Configuration

### GitHub Actions Example
```yaml
- name: Run E2E Tests
  env:
    PLAYWRIGHT_BASE_URL: ${{ secrets.E2E_BASE_URL }}
    E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
    E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
  run: pnpm test:e2e
```

### Mock Auth in CI
For faster CI runs without Auth0:
```yaml
- name: Run E2E Tests (Mock Auth)
  env:
    PLAYWRIGHT_BASE_URL: https://dev.console.lexara.app
    # No credentials = automatic mock auth
  run: pnpm test:e2e
```

## Test User Data Structure

The authenticated user object contains:
```typescript
{
  id: string;              // Unique user ID
  email: string;           // User email
  name: string;            // Display name
  firmId: string;          // Associated firm ID
  auth0Id: string;         // Auth0 subject ID
  roles: string[];         // User roles (e.g., ['admin'])
}
```

## Extending Authentication

### Adding New Auth Methods
1. Edit `e2e/fixtures/auth.ts`
2. Add new authentication function
3. Update the fixture logic

### Custom Test Users
Create specialized fixtures:
```typescript
export const lawyerTest = test.extend({
  authenticatedPage: async ({ page }, use) => {
    await setupMockAuth(page, { role: 'lawyer' });
    await use(page);
  }
});
```

## Related Files
- `/e2e/fixtures/auth.ts` - Authentication fixture implementation
- `/.env.e2e.example` - Example environment variables
- `/playwright.config.ts` - Playwright configuration
- All test files using `authenticatedPage` fixture