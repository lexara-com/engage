import { test, expect } from '../fixtures/auth';
import { DashboardPage } from '../pages/DashboardPage';
import { ConversationDetailPage } from '../pages/ConversationDetailPage';

test.describe('Conversation Performance Tests', () => {
  let dashboardPage: DashboardPage;
  let conversationPage: ConversationDetailPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    conversationPage = new ConversationDetailPage(authenticatedPage);
  });

  test('dashboard should load conversations quickly', async ({ authenticatedPage }) => {
    const startTime = Date.now();
    
    await dashboardPage.goto();
    await expect(dashboardPage.conversationsSection).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Log performance metrics
    const performanceMetrics = await authenticatedPage.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
    
    console.log('Dashboard Performance Metrics:', performanceMetrics);
    
    // First contentful paint should be under 1.5 seconds
    expect(performanceMetrics.firstContentfulPaint).toBeLessThan(1500);
  });

  test('conversation detail page should load efficiently', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    
    const navigationPromise = authenticatedPage.waitForNavigation();
    const startTime = Date.now();
    
    await dashboardPage.clickConversation('Sarah Johnson');
    await navigationPromise;
    
    await expect(conversationPage.transcript).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Conversation page should load within 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });

  test('should handle multiple conversation clicks efficiently', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    
    const conversations = ['Sarah Johnson', 'Michael Chen', 'Emily Rodriguez'];
    const loadTimes: number[] = [];
    
    for (const clientName of conversations) {
      const startTime = Date.now();
      
      await dashboardPage.goto();
      await dashboardPage.clickConversation(clientName);
      await expect(conversationPage.transcript).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      loadTimes.push(loadTime);
    }
    
    // Average load time should be under 2 seconds
    const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
    expect(avgLoadTime).toBeLessThan(2000);
    
    console.log('Load times for each conversation:', loadTimes);
    console.log('Average load time:', avgLoadTime);
  });

  test('conversation transcript should render efficiently', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    await dashboardPage.clickConversation('Sarah Johnson');
    
    // Measure time to render all messages
    const renderStartTime = await authenticatedPage.evaluate(() => performance.now());
    
    await expect(conversationPage.messages.first()).toBeVisible();
    await expect(conversationPage.messages.last()).toBeVisible();
    
    const renderEndTime = await authenticatedPage.evaluate(() => performance.now());
    const renderTime = renderEndTime - renderStartTime;
    
    // Messages should render within 500ms
    expect(renderTime).toBeLessThan(500);
    
    // Check that all 8 messages are rendered
    await conversationPage.expectMessageCount(8);
  });

  test('should not have memory leaks when switching conversations', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    
    // Get initial memory usage
    const initialMemory = await authenticatedPage.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Navigate through multiple conversations
    for (let i = 0; i < 5; i++) {
      await dashboardPage.goto();
      await dashboardPage.clickConversation('Sarah Johnson');
      await expect(conversationPage.transcript).toBeVisible();
      
      await dashboardPage.navigateBackToDashboard();
      await dashboardPage.clickConversation('Michael Chen');
      await expect(conversationPage.transcript).toBeVisible();
    }
    
    // Force garbage collection if available
    await authenticatedPage.evaluate(() => {
      if ('gc' in window) {
        (window as any).gc();
      }
    });
    
    // Check final memory usage
    const finalMemory = await authenticatedPage.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Memory increase should be reasonable (less than 50MB)
    const memoryIncrease = finalMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
    
    console.log('Memory usage - Initial:', initialMemory, 'Final:', finalMemory, 'Increase:', memoryIncrease);
  });
});