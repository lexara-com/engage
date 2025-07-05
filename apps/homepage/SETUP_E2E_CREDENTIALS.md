# Setting Up E2E Test Credentials

## Quick Setup for Mock Authentication (No Real Login Required)

If you want to run tests quickly without setting up Auth0 credentials, simply create an empty `.env.e2e` file:

```bash
touch .env.e2e
```

The tests will automatically use mock authentication with these default values:
- Email: test@example.com
- Name: Test 7 Lawyer
- Firm ID: firm_test_123
- Role: admin

## Full Setup with Real Auth0 Credentials

To use real Auth0 authentication in tests, edit your `.env.e2e` file and add:

```bash
# Playwright Configuration
PLAYWRIGHT_BASE_URL=https://dev.console.lexara.app

# Auth0 Test Credentials
E2E_TEST_EMAIL=your-test-lawyer@example.com
E2E_TEST_PASSWORD=YourSecureTestPassword123!
E2E_TEST_FIRM_ID=your-test-firm-id

# Optional: Customize test user details
E2E_TEST_USER_NAME="Test Lawyer"
E2E_TEST_USER_ROLE=admin
```

## Security Checklist

Before adding credentials:

- [ ] Use a dedicated test account, NOT production credentials
- [ ] Ensure the test account has limited permissions
- [ ] Verify `.env.e2e` is in `.gitignore` (already done ✓)
- [ ] Never commit this file to version control
- [ ] Use strong passwords even for test accounts

## Running Tests

Once your `.env.e2e` is configured:

```bash
# Run all E2E tests
pnpm test:e2e

# Run conversation tests specifically
./run-conversation-tests.sh

# Run with UI mode for debugging
pnpm test:e2e:ui
```

## Troubleshooting

If tests fail with authentication errors:

1. **Check credentials are correct**
   ```bash
   # Verify file exists and has content
   cat .env.e2e | grep E2E_TEST_EMAIL
   ```

2. **Test with mock auth first**
   ```bash
   # Temporarily rename to force mock auth
   mv .env.e2e .env.e2e.backup
   pnpm test:e2e
   ```

3. **Enable debug logging**
   ```bash
   DEBUG=pw:auth pnpm test:e2e
   ```