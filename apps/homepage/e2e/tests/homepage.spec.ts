import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the homepage', async ({ page }) => {
    // Check title
    await expect(page).toHaveTitle(/Lexara - AI-Powered Legal Client Intake/);
    
    // Check main heading
    const heading = page.locator('h1');
    await expect(heading).toContainText('Transform Your Legal Practice');
    await expect(heading).toContainText('Power of AI');
  });

  test('should have call-to-action buttons', async ({ page }) => {
    // Check for CTA buttons
    const startTrialButton = page.locator('a[href="/signup"]').first();
    const learnMoreButton = page.locator('a[href="/demo"]');
    
    await expect(startTrialButton).toBeVisible();
    await expect(startTrialButton).toContainText('Start Free Trial');
    
    await expect(learnMoreButton).toBeVisible();
    await expect(learnMoreButton).toContainText('Learn More');
  });

  test('should navigate to signup page', async ({ page }) => {
    // Click signup link
    await page.click('a[href="/signup"]');
    
    // Verify navigation
    await expect(page).toHaveURL('/signup');
    await expect(page.locator('h1')).toContainText(/Sign Up|Register|Get Started/i);
  });

  test('should navigate to login page', async ({ page }) => {
    // Click login link
    await page.click('a[href="/login"]');
    
    // Verify navigation
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h1')).toContainText(/Log In|Sign In/i);
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Mobile menu should be visible
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    
    // If mobile menu exists, it should work
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      const mobileNav = page.locator('[data-testid="mobile-nav"]');
      await expect(mobileNav).toBeVisible();
    }
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Desktop nav should be visible
    const desktopNav = page.locator('nav');
    await expect(desktopNav).toBeVisible();
  });

  test('should have footer with important links', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    
    // Check for important footer links
    const footerLinks = [
      'Privacy Policy',
      'Terms of Service',
      'Contact',
    ];
    
    for (const linkText of footerLinks) {
      const link = footer.locator(`a:has-text("${linkText}")`);
      await expect(link).toBeVisible();
    }
  });

  test('should load quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    // Page should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should not have console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // No console errors should be present
    expect(consoleErrors).toHaveLength(0);
  });
});