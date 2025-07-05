import { test, expect } from '../fixtures/auth';

test.describe('Auth0 Login and Conversation Demo', () => {
  test('complete flow: login → dashboard → conversations', async ({ authenticatedPage }) => {
    // Step 1: Verify successful Auth0 login
    console.log('Step 1: Verifying Auth0 login...');
    await expect(authenticatedPage.locator('h1:has-text("Welcome back")')).toBeVisible();
    
    // Get user info from page
    const userName = await authenticatedPage.locator('text=Test 7 Lawyer').first().textContent();
    console.log(`✓ Logged in as: ${userName}`);
    
    // Step 2: Verify dashboard elements
    console.log('\nStep 2: Checking dashboard elements...');
    await expect(authenticatedPage.locator('text=Active Conversations')).toBeVisible();
    await expect(authenticatedPage.locator('text=Success Rate')).toBeVisible();
    
    // Get metrics
    const activeConversations = await authenticatedPage.locator('text=/\\d+ Active Conversations/').textContent();
    const successRate = await authenticatedPage.locator('text=/\\d+% Success Rate/').textContent();
    console.log(`✓ Dashboard metrics: ${activeConversations}, ${successRate}`);
    
    // Step 3: Navigate to conversations
    console.log('\nStep 3: Navigating to conversations page...');
    await authenticatedPage.click('a:has-text("View Conversations")');
    await authenticatedPage.waitForURL('**/conversations');
    
    // Step 4: Verify conversations page
    console.log('\nStep 4: Verifying conversations page...');
    await expect(authenticatedPage.locator('h1')).toContainText('Conversations');
    
    // Check for session info
    const sessionInfo = await authenticatedPage.locator('text=Session Information').isVisible();
    console.log(`✓ Session information visible: ${sessionInfo}`);
    
    // Step 5: Navigate back to dashboard
    console.log('\nStep 5: Navigating back to dashboard...');
    await authenticatedPage.click('a:has-text("Back to Dashboard")');
    await authenticatedPage.waitForURL('**/dashboard');
    
    // Step 6: Test logout
    console.log('\nStep 6: Testing logout...');
    await authenticatedPage.click('a:has-text("Sign Out")');
    
    // Should redirect to login or home
    await expect(authenticatedPage).toHaveURL(/\/(login|home)?$/);
    console.log('✓ Successfully logged out');
    
    console.log('\n✅ Full Auth0 flow test completed successfully!');
  });

  test('verify firm-specific data isolation', async ({ authenticatedPage }) => {
    // This test verifies that the logged-in user sees only their firm's data
    
    // Check firm ID in session
    const sessionDebugText = await authenticatedPage.locator('text=/firmId.*default/').textContent();
    expect(sessionDebugText).toContain('default');
    console.log('✓ User is associated with firm: default');
    
    // Check chatbot URL contains firm ID
    const chatbotUrl = await authenticatedPage.locator('code:has-text("chat.lexara.app")').textContent();
    expect(chatbotUrl).toContain('firm=default');
    console.log(`✓ Chatbot URL is firm-specific: ${chatbotUrl}`);
  });
});

test.describe('Conversation Page Features', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate directly to conversations page
    await authenticatedPage.goto('/firm/conversations');
    await authenticatedPage.waitForLoadState('networkidle');
  });

  test('should display conversation list placeholder', async ({ authenticatedPage }) => {
    // The current conversations page is a debug/placeholder
    // This test documents the current state
    
    await expect(authenticatedPage.locator('h1')).toContainText('Conversations');
    await expect(authenticatedPage.locator('text=Session Information')).toBeVisible();
    
    // Verify authenticated user info is displayed
    const userEmail = await authenticatedPage.locator('text=shawnswaner+test7@gmail.com').isVisible();
    expect(userEmail).toBeTruthy();
  });
});

test.describe('Performance with Auth0', () => {
  test('login and navigation performance', async ({ authenticatedPage }) => {
    const startTime = Date.now();
    
    // Already logged in via fixture, just verify
    await expect(authenticatedPage.locator('h1:has-text("Welcome back")')).toBeVisible();
    
    const authTime = Date.now() - startTime;
    console.log(`Auth verification time: ${authTime}ms`);
    expect(authTime).toBeLessThan(5000); // Should be fast since already authenticated
    
    // Measure navigation to conversations
    const navStart = Date.now();
    await authenticatedPage.click('a:has-text("View Conversations")');
    await authenticatedPage.waitForURL('**/conversations');
    
    const navTime = Date.now() - navStart;
    console.log(`Navigation time: ${navTime}ms`);
    expect(navTime).toBeLessThan(3000);
  });
});