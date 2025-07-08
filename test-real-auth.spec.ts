import { test, expect, chromium } from '@playwright/test';

test.describe('Real Authentication Test', () => {
  test('test with actual Auth0 login', async () => {
    const browser = await chromium.launch({ 
      headless: false,
      devtools: true 
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Enable detailed logging
    page.on('console', msg => {
      console.log(`[Browser ${msg.type()}]:`, msg.text());
    });
    
    page.on('request', request => {
      if (request.url().includes('/api/') || request.url().includes('/firm/')) {
        console.log(`[Request]: ${request.method()} ${request.url()}`);
        console.log(`[Headers]:`, request.headers());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/') || response.url().includes('/firm/')) {
        console.log(`[Response]: ${response.status()} ${response.url()}`);
      }
    });

    console.log('=== Starting Authentication Test ===\n');
    
    // 1. Go directly to dashboard (should redirect to login)
    console.log('1. Navigating to dashboard...');
    await page.goto('https://dev.console.lexara.app/firm/dashboard');
    await page.waitForLoadState('networkidle');
    
    console.log('Current URL:', page.url());
    await page.screenshot({ path: 'step1-login-redirect.png' });
    
    // 2. Click login button
    if (page.url().includes('/firm/login')) {
      console.log('\n2. On login page, clicking Sign In button...');
      
      try {
        // Wait for and click the Auth0 login button
        await page.waitForSelector('button:has-text("Sign In with Auth0")', { timeout: 5000 });
        await page.click('button:has-text("Sign In with Auth0")');
        
        // Wait for Auth0 redirect
        await page.waitForURL(/.*auth0.*/, { timeout: 10000 });
        console.log('Redirected to Auth0:', page.url());
        await page.screenshot({ path: 'step2-auth0.png' });
        
        // At this point, manual login would be required
        console.log('\n3. Please login manually in the browser window...');
        console.log('Waiting for callback redirect...');
        
        // Wait for callback
        await page.waitForURL(/.*\/(callback|dashboard).*/, { timeout: 60000 });
        console.log('Callback/Dashboard URL:', page.url());
        await page.screenshot({ path: 'step3-after-login.png' });
        
        // Check current page
        if (page.url().includes('/firm/dashboard')) {
          console.log('\n✅ Successfully logged in to dashboard!');
          
          // Check for user info
          await page.waitForLoadState('networkidle');
          const userEmail = await page.textContent('.user-email').catch(() => 'Not found');
          console.log('User email displayed:', userEmail);
          
          // Get all cookies
          const cookies = await context.cookies();
          const sessionCookie = cookies.find(c => c.name === 'firm_session');
          if (sessionCookie) {
            console.log('\n✅ Session cookie found');
            console.log('Cookie properties:', {
              domain: sessionCookie.domain,
              path: sessionCookie.path,
              secure: sessionCookie.secure,
              sameSite: sessionCookie.sameSite,
              httpOnly: sessionCookie.httpOnly
            });
          }
          
          // Now try to navigate to conversations
          console.log('\n4. Navigating to Conversations...');
          await page.click('a[href="/firm/conversations"]');
          await page.waitForLoadState('networkidle');
          
          console.log('Conversations URL:', page.url());
          await page.screenshot({ path: 'step4-conversations.png' });
          
          // Check page content
          const pageContent = await page.textContent('body');
          if (pageContent.includes('Unauthorized')) {
            console.log('\n❌ Unauthorized error on Conversations page');
            
            // Check what's in the debug section
            const debugInfo = await page.textContent('.debug-section').catch(() => null);
            if (debugInfo) {
              console.log('\nDebug info from page:', debugInfo);
            }
          } else if (pageContent.includes('Conversations')) {
            console.log('\n✅ Successfully loaded Conversations page');
          }
          
          // Check if user tile is still present
          const userTilePresent = await page.$('.user-tile') !== null;
          console.log('User tile present:', userTilePresent);
        }
      } catch (error) {
        console.error('Error during auth flow:', error);
      }
    }
    
    console.log('\n=== Test Complete ===');
    console.log('Browser will remain open for 60 seconds for inspection...');
    await page.waitForTimeout(60000);
    
    await browser.close();
  });
});