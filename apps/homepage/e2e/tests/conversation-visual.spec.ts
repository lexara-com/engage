import { test, expect } from '../fixtures/auth';
import { DashboardPage } from '../pages/DashboardPage';
import { ConversationDetailPage } from '../pages/ConversationDetailPage';

test.describe('Conversation Visual Tests', () => {
  let dashboardPage: DashboardPage;
  let conversationPage: ConversationDetailPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    conversationPage = new ConversationDetailPage(authenticatedPage);
  });

  test('dashboard conversations section screenshot', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    
    // Wait for conversations to load
    await expect(dashboardPage.conversationsSection).toBeVisible();
    
    // Take screenshot of conversations section
    await expect(dashboardPage.conversationsSection).toHaveScreenshot('dashboard-conversations.png');
  });

  test('conversation detail page screenshot', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    await dashboardPage.clickConversation('Sarah Johnson');
    
    // Wait for transcript to load
    await expect(conversationPage.transcript).toBeVisible();
    
    // Take full page screenshot
    await expect(authenticatedPage).toHaveScreenshot('conversation-detail-full.png');
    
    // Take screenshot of transcript section
    await expect(conversationPage.transcript).toHaveScreenshot('conversation-transcript.png');
  });

  test('conversation status badges visual test', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    
    // Screenshot each status badge type
    const badges = {
      'in-progress': authenticatedPage.locator('span.bg-yellow-100:has-text("In Progress")').first(),
      'qualified': authenticatedPage.locator('span.bg-green-100:has-text("Qualified")').first(),
      'follow-up': authenticatedPage.locator('span.bg-blue-100:has-text("Follow-up")').first()
    };
    
    for (const [name, badge] of Object.entries(badges)) {
      await expect(badge).toHaveScreenshot(`badge-${name}.png`);
    }
  });
});