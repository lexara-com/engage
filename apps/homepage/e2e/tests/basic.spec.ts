import { test, expect } from '@playwright/test';

test.describe('Basic Tests - Dev Environment', () => {
  test('dev environment loads successfully', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
  });

  test('has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Lexara/);
  });

  test('main heading is visible', async ({ page }) => {
    await page.goto('/');
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('signup link exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Try multiple possible selectors for signup
    const signupLink = page.locator('a[href*="signup"], a:has-text("Sign Up"), a:has-text("Get Started")').first();
    await expect(signupLink).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to firm login', async ({ page }) => {
    await page.goto('/firm/login');
    // Should redirect to Auth0 or show login page
    await expect(page.url()).toMatch(/auth0\.com|\/firm\/login/);
  });
});