import { test, expect } from '../fixtures/auth';
import { DashboardPage } from '../pages/DashboardPage';
import { ConversationDetailPage } from '../pages/ConversationDetailPage';

test.describe('Conversations Feature', () => {
  let dashboardPage: DashboardPage;
  let conversationPage: ConversationDetailPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    conversationPage = new ConversationDetailPage(authenticatedPage);
    await dashboardPage.goto();
  });

  test.describe('Dashboard Conversations', () => {
    test('should navigate to conversations page', async ({ authenticatedPage }) => {
      // The dashboard is successfully loaded after Auth0 login
      await expect(authenticatedPage.locator('h1:has-text("Welcome back")')).toBeVisible();
      
      // Click on View Conversations link
      const viewConversationsLink = authenticatedPage.locator('a:has-text("View Conversations")');
      await expect(viewConversationsLink).toBeVisible();
      await viewConversationsLink.click();
      
      // Should navigate to conversations page
      await authenticatedPage.waitForURL('**/conversations');
      
      // Verify we're on the conversations page
      const pageTitle = authenticatedPage.locator('h1');
      await expect(pageTitle).toContainText('Conversations');
    });

    test('should display conversation items with correct information', async ({ authenticatedPage }) => {
      // Check that we have 3 sample conversations
      await dashboardPage.expectConversationCount(3);
      
      // Verify Sarah Johnson conversation
      const sarahConv = authenticatedPage.locator('a[href="/firm/conversations/conv-001"]');
      await expect(sarahConv).toContainText('Sarah Johnson');
      await expect(sarahConv).toContainText('Personal injury case');
      await expect(sarahConv).toContainText('Started 2 hours ago');
      await expect(sarahConv.locator('span.rounded-full')).toContainText('In Progress');
      
      // Verify Michael Chen conversation
      const michaelConv = authenticatedPage.locator('a[href="/firm/conversations/conv-002"]');
      await expect(michaelConv).toContainText('Michael Chen');
      await expect(michaelConv).toContainText('Employment law');
      await expect(michaelConv).toContainText('Qualified');
      
      // Verify Emily Rodriguez conversation
      const emilyConv = authenticatedPage.locator('a[href="/firm/conversations/conv-003"]');
      await expect(emilyConv).toContainText('Emily Rodriguez');
      await expect(emilyConv).toContainText('Family law');
      await expect(emilyConv).toContainText('Follow-up');
    });

    test('should display stats cards with metrics', async ({ authenticatedPage }) => {
      // Today's conversations
      await dashboardPage.expectStatsCard('New conversations', '12');
      
      // Active conversations
      await dashboardPage.expectStatsCard('In progress', '8');
      
      // This week completed
      await dashboardPage.expectStatsCard('Completed', '47');
      
      // Conversion rate
      await dashboardPage.expectStatsCard('Lead to client', '68%');
    });

    test('should display intake link', async ({ authenticatedPage }) => {
      await dashboardPage.expectIntakeLinkVisible();
      
      // Verify copy button exists
      const copyButton = authenticatedPage.locator('button:has-text("Copy Link")');
      await expect(copyButton).toBeVisible();
    });
  });

  test.describe('Conversation Detail Page', () => {
    test('should navigate to conversation detail when clicking a conversation', async ({ authenticatedPage }) => {
      // Click on Sarah Johnson conversation
      await dashboardPage.clickConversation('Sarah Johnson');
      
      // Wait for navigation
      await authenticatedPage.waitForURL('**/conversations/conv-001');
      
      // Verify we're on the conversation page
      await conversationPage.expectToBeOnConversationPage('Sarah Johnson');
    });

    test('should display conversation transcript', async ({ authenticatedPage }) => {
      await dashboardPage.clickConversation('Sarah Johnson');
      
      // Check that transcript section is visible
      await expect(conversationPage.transcript).toBeVisible();
      
      // Verify message count (8 messages in our mock data)
      await conversationPage.expectMessageCount(8);
      
      // Verify first agent message
      await conversationPage.expectMessage(
        "Hello! I'm here to help you with your legal inquiry",
        'agent'
      );
      
      // Verify client response
      await conversationPage.expectMessage(
        "Hi, my name is Sarah Johnson",
        'client'
      );
      
      // Verify accident description
      await conversationPage.expectMessage(
        "I was in a car accident last week on I-95",
        'client'
      );
    });

    test('should display case summary and details', async ({ authenticatedPage }) => {
      await dashboardPage.clickConversation('Sarah Johnson');
      
      // Check case type
      await expect(conversationPage.caseType).toContainText('Personal Injury');
      
      // Check case summary
      await conversationPage.expectCaseSummary('Car accident on I-95');
      
      // Check qualification score
      await conversationPage.expectQualificationScore(85);
      
      // Check status
      await expect(conversationPage.conversationStatus).toContainText('In Progress');
    });

    test('should display recommended next steps', async ({ authenticatedPage }) => {
      await dashboardPage.clickConversation('Sarah Johnson');
      
      // Verify next steps are visible
      await conversationPage.expectNextStep('Schedule consultation');
      await conversationPage.expectNextStep('Gather medical records');
      await conversationPage.expectNextStep('Obtain police report');
    });

    test('should display internal notes', async ({ authenticatedPage }) => {
      await dashboardPage.clickConversation('Sarah Johnson');
      
      // Check internal notes
      await expect(conversationPage.internalNotes.first()).toContainText('Strong personal injury case');
      await expect(conversationPage.internalNotes.first()).toContainText('Clear liability');
    });

    test('should have action buttons', async ({ authenticatedPage }) => {
      await dashboardPage.clickConversation('Sarah Johnson');
      
      // Verify export button
      await expect(conversationPage.exportButton).toBeVisible();
      
      // Verify quick action buttons
      await expect(conversationPage.scheduleConsultationButton).toBeVisible();
      const followUpButton = authenticatedPage.locator('button:has-text("Send Follow-up Email")');
      await expect(followUpButton).toBeVisible();
      const convertButton = authenticatedPage.locator('button:has-text("Convert to Client")');
      await expect(convertButton).toBeVisible();
    });

    test('should navigate back to dashboard using breadcrumbs', async ({ authenticatedPage }) => {
      await dashboardPage.clickConversation('Sarah Johnson');
      
      // Click dashboard breadcrumb
      await conversationPage.navigateBackToDashboard();
      
      // Should be back on dashboard
      await expect(authenticatedPage).toHaveURL('**/dashboard');
      await expect(dashboardPage.pageTitle).toBeVisible();
    });
  });

  test.describe('Conversation Status Badges', () => {
    test('should display correct status colors', async ({ authenticatedPage }) => {
      // In Progress - Yellow
      const inProgressBadge = authenticatedPage.locator('span.bg-yellow-100:has-text("In Progress")');
      await expect(inProgressBadge).toBeVisible();
      
      // Qualified - Green
      const qualifiedBadge = authenticatedPage.locator('span.bg-green-100:has-text("Qualified")');
      await expect(qualifiedBadge).toBeVisible();
      
      // Follow-up - Blue
      const followUpBadge = authenticatedPage.locator('span.bg-blue-100:has-text("Follow-up")');
      await expect(followUpBadge).toBeVisible();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should display conversations properly on mobile', async ({ authenticatedPage }) => {
      // Set mobile viewport
      await authenticatedPage.setViewportSize({ width: 375, height: 667 });
      
      // Conversations should still be visible
      await expect(dashboardPage.conversationsSection).toBeVisible();
      
      // Click conversation should still work
      await dashboardPage.clickConversation('Sarah Johnson');
      await conversationPage.expectToBeOnConversationPage('Sarah Johnson');
    });
  });
});

test.describe('Conversation Search and Filters', () => {
  test.skip('should search conversations by client name', async ({ authenticatedPage }) => {
    // This test is skipped as search functionality is not yet implemented
    // but included as a placeholder for future development
  });

  test.skip('should filter conversations by status', async ({ authenticatedPage }) => {
    // This test is skipped as filter functionality is not yet implemented
    // but included as a placeholder for future development
  });
});