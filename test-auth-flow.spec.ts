import { test, expect, chromium } from '@playwright/test';

test.describe('Firm Portal Authentication Flow', () => {
  test('should properly maintain session when navigating to Conversations', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Enable console logging
    page.on('console', msg => console.log('Browser:', msg.text()));
    page.on('pageerror', err => console.error('Page error:', err));

    console.log('1. Navigating to dashboard without auth...');
    await page.goto('https://dev.console.lexara.app/firm/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/firm\/login.*/);
    console.log('✅ Correctly redirected to login');

    // Take screenshot
    await page.screenshot({ path: 'login-page.png' });

    console.log('2. Attempting to login...');
    // Click the login button to go to Auth0
    await page.click('button:has-text("Sign In with Auth0")');
    
    // Wait for Auth0 redirect
    await page.waitForURL(/.*auth0.*/);
    console.log('✅ Redirected to Auth0');
    
    // Auth0 login form
    await page.waitForSelector('input[name="username"], input[name="email"]', { timeout: 10000 });
    
    // Use test credentials (you'll need to provide these)
    console.log('3. Entering credentials...');
    const emailInput = await page.$('input[name="username"], input[name="email"]');
    if (emailInput) {
      await emailInput.fill('test@example.com'); // Replace with real test email
    }
    
    const passwordInput = await page.$('input[name="password"]');
    if (passwordInput) {
      await passwordInput.fill('TestPassword123!'); // Replace with real test password
    }
    
    // Submit login
    await page.click('button[type="submit"], button[name="submit"]');
    
    console.log('4. Waiting for callback...');
    // Wait for redirect back to our app
    await page.waitForURL(/.*\/firm\/(callback|dashboard).*/, { timeout: 30000 });
    
    // Check if we're on the dashboard
    if (page.url().includes('/firm/dashboard')) {
      console.log('✅ Successfully logged in and on dashboard');
      
      // Take screenshot of dashboard
      await page.screenshot({ path: 'dashboard.png' });
      
      // Check for user tile
      const userTile = await page.$('.user-tile');
      if (userTile) {
        console.log('✅ User tile is present');
      } else {
        console.log('❌ User tile is missing');
      }
      
      console.log('5. Navigating to Conversations...');
      // Try to navigate to conversations
      await page.click('a[href="/firm/conversations"]');
      
      // Wait for navigation
      await page.waitForLoadState('networkidle');
      
      // Check where we are
      console.log('Current URL:', page.url());
      
      // Take screenshot
      await page.screenshot({ path: 'conversations-attempt.png' });
      
      // Check for error or redirect
      if (page.url().includes('/firm/conversations')) {
        console.log('✅ Successfully on conversations page');
        
        // Check for unauthorized error
        const errorText = await page.textContent('body');
        if (errorText?.includes('Unauthorized')) {
          console.log('❌ Got Unauthorized error on conversations page');
        }
        
        // Check if user tile is still present
        const userTileAfter = await page.$('.user-tile');
        if (userTileAfter) {
          console.log('✅ User tile still present');
        } else {
          console.log('❌ User tile disappeared - session lost');
        }
      } else if (page.url().includes('/firm/login')) {
        console.log('❌ Redirected back to login - session lost');
      }
    }
    
    // Check cookies
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'firm_session');
    if (sessionCookie) {
      console.log('\nSession cookie found:');
      console.log('- Domain:', sessionCookie.domain);
      console.log('- Path:', sessionCookie.path);
      console.log('- Secure:', sessionCookie.secure);
      console.log('- SameSite:', sessionCookie.sameSite);
      console.log('- HttpOnly:', sessionCookie.httpOnly);
      
      try {
        const sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
        console.log('- Session data:', {
          userId: sessionData.userId,
          email: sessionData.email,
          firmId: sessionData.firmId,
          isAuthenticated: sessionData.isAuthenticated,
          exp: new Date(sessionData.exp * 1000).toISOString()
        });
      } catch (e) {
        console.log('- Could not parse session data');
      }
    } else {
      console.log('\n❌ No session cookie found');
    }
    
    // Keep browser open for inspection
    console.log('\nTest complete. Browser will remain open for 30 seconds...');
    await page.waitForTimeout(30000);
    
    await browser.close();
  });
});