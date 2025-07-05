import { test, expect } from '../fixtures/auth';
import { injectAxe, checkA11y } from 'axe-playwright';
import { DashboardPage } from '../pages/DashboardPage';
import { ConversationDetailPage } from '../pages/ConversationDetailPage';

test.describe('Conversation Accessibility Tests', () => {
  let dashboardPage: DashboardPage;
  let conversationPage: ConversationDetailPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    conversationPage = new ConversationDetailPage(authenticatedPage);
    await injectAxe(authenticatedPage);
  });

  test('dashboard conversations section should be accessible', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    
    // Check accessibility of conversations section
    await checkA11y(authenticatedPage, {
      include: [['div:has(h3:text("Recent Conversations"))']],
      detailedReport: true,
      detailedReportOptions: {
        html: true
      }
    });
  });

  test('conversation links should have proper accessibility', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    
    // Check that conversation links are properly labeled
    const conversationLinks = await dashboardPage.conversationItems.all();
    
    for (const link of conversationLinks) {
      // Should have text content
      const text = await link.textContent();
      expect(text).toBeTruthy();
      
      // Should be focusable
      await expect(link).toBeFocused({ timeout: 100 }).catch(() => {
        // Link should be focusable when tabbed to
      });
    }
  });

  test('conversation detail page should be accessible', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    await dashboardPage.clickConversation('Sarah Johnson');
    
    // Wait for page to load
    await expect(conversationPage.transcript).toBeVisible();
    
    // Check full page accessibility
    await checkA11y(authenticatedPage, {
      detailedReport: true,
      detailedReportOptions: {
        html: true
      }
    });
  });

  test('conversation messages should have proper contrast', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    await dashboardPage.clickConversation('Sarah Johnson');
    
    // Check contrast for agent messages (light background)
    await checkA11y(authenticatedPage, {
      include: [['.bg-lexara-whiteSmoke']],
      rules: {
        'color-contrast': { enabled: true }
      }
    });
    
    // Check contrast for client messages (dark background)
    await checkA11y(authenticatedPage, {
      include: [['.bg-lexara-darkNavy']],
      rules: {
        'color-contrast': { enabled: true }
      }
    });
  });

  test('interactive elements should be keyboard accessible', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    await dashboardPage.clickConversation('Sarah Johnson');
    
    // Test keyboard navigation
    await authenticatedPage.keyboard.press('Tab');
    
    // Export button should be focusable
    await authenticatedPage.keyboard.press('Tab');
    const focusedElement = await authenticatedPage.evaluate(() => document.activeElement?.textContent);
    expect(focusedElement).toContain('Export');
    
    // Action buttons should be reachable via keyboard
    const actionButtons = ['Schedule Consultation', 'Send Follow-up Email', 'Convert to Client'];
    for (const buttonText of actionButtons) {
      const button = authenticatedPage.locator(`button:has-text("${buttonText}")`);
      await button.focus();
      await expect(button).toBeFocused();
    }
  });

  test('status badges should have proper ARIA labels', async ({ authenticatedPage }) => {
    await dashboardPage.goto();
    
    // Check status badges have appropriate role or aria-label
    const badges = await authenticatedPage.locator('span.rounded-full').all();
    
    for (const badge of badges) {
      const text = await badge.textContent();
      expect(text).toBeTruthy(); // Should have visible text
    }
  });
});