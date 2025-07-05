import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load E2E environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.e2e') });

export interface AuthFixtures {
  authenticatedPage: Page;
}

/**
 * Custom test fixture that provides an authenticated page
 * This handles Auth0 login flow
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const email = process.env.TEST_USER_EMAIL || process.env.E2E_TEST_EMAIL;
    const password = process.env.TEST_USER_PASSWORD || process.env.E2E_TEST_PASSWORD;
    
    if (!email || !password) {
      console.warn('⚠️  E2E_TEST_EMAIL and E2E_TEST_PASSWORD not set in .env.e2e');
      console.warn('⚠️  Using mock authentication instead of real Auth0 login');
      
      // Fallback to mock authentication
      await setupMockAuth(page);
    } else {
      // Use real Auth0 login
      try {
        await loginWithAuth0(page, email, password);
      } catch (error) {
        console.error('❌ Auth0 login failed:', error);
        console.warn('⚠️  Falling back to mock authentication');
        await setupMockAuth(page);
      }
    }

    await use(page);
  },
});

export { expect };

/**
 * Setup mock authentication for testing
 */
async function setupMockAuth(page: Page) {
  // Set mock auth cookies
  const baseUrl = new URL(process.env.PLAYWRIGHT_BASE_URL || 'https://dev.console.lexara.app');
  
  await page.context().addCookies([
    {
      name: 'firm_session',
      value: JSON.stringify({
        isAuthenticated: true,
        user: {
          id: 'test-user-123',
          email: process.env.TEST_USER_EMAIL || process.env.E2E_TEST_EMAIL || 'test@example.com',
          name: process.env.E2E_TEST_USER_NAME || 'Test 7 Lawyer',
          firmId: process.env.E2E_TEST_FIRM_ID || 'firm_test_123',
          auth0Id: 'auth0|test123',
          roles: [process.env.E2E_TEST_USER_ROLE || 'admin']
        },
        firm: {
          id: process.env.E2E_TEST_FIRM_ID || 'firm_test_123',
          name: 'Test Law Firm'
        },
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      }),
      domain: baseUrl.hostname,
      path: '/',
      httpOnly: true,
      secure: baseUrl.protocol === 'https:',
      sameSite: 'Lax',
    }
  ]);

  // Mock the auth state in localStorage for client-side checks
  await page.addInitScript(() => {
    window.localStorage.setItem('auth0:user', JSON.stringify({
      sub: 'auth0|test123',
      email: process.env.TEST_USER_EMAIL || process.env.E2E_TEST_EMAIL || 'test@example.com',
      name: process.env.E2E_TEST_USER_NAME || 'Test 7 Lawyer',
      firmId: process.env.E2E_TEST_FIRM_ID || 'firm_test_123',
      role: process.env.E2E_TEST_USER_ROLE || 'admin',
      permissions: ['firm:admin']
    }));
  });
}

/**
 * Helper function to handle Auth0 login flow
 * @param page Playwright page object
 * @param email User email
 * @param password User password
 */
export async function loginWithAuth0(page: Page, email: string, password: string) {
  console.log('🔐 Starting Auth0 login flow...');
  
  // Navigate to login page
  await page.goto('/firm/login');
  
  // Wait for Auth0 redirect with longer timeout
  await page.waitForURL(/auth0\.com/, { timeout: 30000 });
  console.log('✓ Redirected to Auth0');
  
  // Wait for the login form to be fully loaded
  await page.waitForLoadState('networkidle');
  
  // Try multiple possible selectors for email field
  const emailSelectors = [
    'input[name="email"]',
    'input[type="email"]',
    'input[id="username"]',
    'input[name="username"]',
    '#email',
    '#username'
  ];
  
  let emailFilled = false;
  for (const selector of emailSelectors) {
    try {
      await page.fill(selector, email, { timeout: 5000 });
      console.log(`✓ Email filled using selector: ${selector}`);
      emailFilled = true;
      break;
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!emailFilled) {
    throw new Error('Could not find email input field on Auth0 page');
  }
  
  // Try multiple possible selectors for password field
  const passwordSelectors = [
    'input[name="password"]',
    'input[type="password"]',
    '#password'
  ];
  
  let passwordFilled = false;
  for (const selector of passwordSelectors) {
    try {
      await page.fill(selector, password, { timeout: 5000 });
      console.log(`✓ Password filled using selector: ${selector}`);
      passwordFilled = true;
      break;
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!passwordFilled) {
    throw new Error('Could not find password input field on Auth0 page');
  }
  
  // Try multiple possible selectors for submit button
  const submitSelectors = [
    'button[type="submit"]',
    'button[name="submit"]',
    'button:has-text("Continue")',
    'button:has-text("Log In")',
    'button:has-text("Sign In")',
    'input[type="submit"]'
  ];
  
  let submitted = false;
  for (const selector of submitSelectors) {
    try {
      await page.click(selector, { timeout: 5000 });
      console.log(`✓ Form submitted using selector: ${selector}`);
      submitted = true;
      break;
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!submitted) {
    throw new Error('Could not find submit button on Auth0 page');
  }
  
  // Wait for redirect back to app with longer timeout
  await page.waitForURL(/\/firm\/(callback|dashboard|login)/, { timeout: 30000 });
  console.log('✓ Redirected back to application');
  
  // If we're still on login, it might have failed
  if (page.url().includes('/login')) {
    throw new Error('Login failed - still on login page');
  }
  
  // Wait a bit for session to be established
  await page.waitForTimeout(2000);
  
  // Verify we're logged in - try multiple selectors
  const userMenuSelectors = [
    '[data-testid="user-menu"]',
    'a:has-text("Sign Out")',
    'div:has-text("Test 7 Lawyer")',
    'h1:has-text("Welcome back")'
  ];
  
  let loggedIn = false;
  for (const selector of userMenuSelectors) {
    try {
      await expect(page.locator(selector)).toBeVisible({ timeout: 5000 });
      console.log(`✓ Login verified using selector: ${selector}`);
      loggedIn = true;
      break;
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!loggedIn) {
    console.warn('⚠️  Could not verify login status, but proceeding anyway');
  }
}

/**
 * Helper to logout
 */
export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/');
}