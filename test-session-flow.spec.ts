import { test, expect } from '@playwright/test';

test.describe('Session and Navigation Flow', () => {
  test('check authentication behavior and session persistence', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('Browser log:', msg.text()));
    page.on('response', response => {
      if (response.url().includes('/api/firm/conversations')) {
        console.log(`API Response: ${response.url()} - ${response.status()}`);
      }
    });

    console.log('1. Testing unauthenticated access to protected routes...');
    
    // Test dashboard redirect
    await page.goto('https://dev.console.lexara.app/firm/dashboard');
    await expect(page).toHaveURL(/.*\/firm\/login.*/);
    console.log('✅ Dashboard correctly redirects to login when unauthenticated');

    // Test conversations redirect
    await page.goto('https://dev.console.lexara.app/firm/conversations');
    await expect(page).toHaveURL(/.*\/firm\/login.*/);
    console.log('✅ Conversations correctly redirects to login when unauthenticated');

    // Test API without auth
    const apiResponse = await page.request.get('https://dev.console.lexara.app/api/firm/conversations');
    console.log(`✅ API returns ${apiResponse.status()} without auth`);
    const apiData = await apiResponse.json();
    console.log('API response:', apiData);

    console.log('\n2. Simulating authenticated session...');
    
    // Create a mock session cookie to test session handling
    const mockSession = {
      userId: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      firmId: 'test-firm-123',
      roles: ['User'],
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours from now
      isAuthenticated: true
    };

    await page.context().addCookies([{
      name: 'firm_session',
      value: encodeURIComponent(JSON.stringify(mockSession)),
      domain: 'dev.console.lexara.app',
      path: '/',
      secure: true,
      sameSite: 'Lax',
      expires: mockSession.exp
    }]);

    console.log('✅ Mock session cookie set');

    // Now try to access dashboard with session
    console.log('\n3. Testing authenticated access...');
    await page.goto('https://dev.console.lexara.app/firm/dashboard');
    
    // Check if we stay on dashboard or get redirected
    await page.waitForLoadState('networkidle');
    const dashboardUrl = page.url();
    console.log('Dashboard URL after navigation:', dashboardUrl);
    
    if (dashboardUrl.includes('/firm/dashboard')) {
      console.log('✅ Successfully accessed dashboard with session');
      
      // Look for user info
      const userEmail = await page.textContent('.user-email').catch(() => null);
      console.log('User email displayed:', userEmail);
      
      // Try to navigate to conversations
      console.log('\n4. Testing navigation to Conversations...');
      
      // Check if the conversations link exists
      const conversationsLink = await page.$('a[href="/firm/conversations"]');
      if (conversationsLink) {
        await conversationsLink.click();
        await page.waitForLoadState('networkidle');
        
        const conversationsUrl = page.url();
        console.log('Conversations URL after navigation:', conversationsUrl);
        
        if (conversationsUrl.includes('/firm/conversations')) {
          console.log('✅ Successfully navigated to conversations');
          
          // Check for error messages
          const bodyText = await page.textContent('body');
          if (bodyText.includes('Unauthorized')) {
            console.log('❌ Page shows Unauthorized error');
          }
          
          // Check if user tile is present
          const userTileAfterNav = await page.$('.user-tile');
          if (userTileAfterNav) {
            console.log('✅ User tile still present after navigation');
          } else {
            console.log('❌ User tile missing after navigation');
          }
          
          // Check API call
          const apiResponse2 = await page.request.get('https://dev.console.lexara.app/api/firm/conversations', {
            headers: {
              'Cookie': `firm_session=${encodeURIComponent(JSON.stringify(mockSession))}`
            }
          });
          console.log(`\nAPI call with session returns: ${apiResponse2.status()}`);
          const apiData2 = await apiResponse2.json();
          console.log('API response with session:', apiData2);
        } else if (conversationsUrl.includes('/firm/login')) {
          console.log('❌ Redirected to login - session was lost');
        }
      } else {
        console.log('❌ Conversations link not found on dashboard');
      }
    } else if (dashboardUrl.includes('/firm/login')) {
      console.log('❌ Redirected to login even with session cookie');
    }

    // Check final cookies
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'firm_session');
    console.log('\nFinal session cookie state:', sessionCookie ? 'Present' : 'Missing');
    if (sessionCookie) {
      console.log('Cookie details:', {
        domain: sessionCookie.domain,
        path: sessionCookie.path,
        secure: sessionCookie.secure,
        sameSite: sessionCookie.sameSite
      });
    }
  });
});