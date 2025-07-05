import { test, expect } from '../fixtures/auth';
import { DashboardPage } from '../pages/DashboardPage';

test.describe('Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
  });

  test('should display dashboard for authenticated users', async ({ authenticatedPage }) => {
    await dashboardPage.expectToBeLoggedIn();
    
    // Verify dashboard elements
    await expect(dashboardPage.pageTitle).toContainText('Dashboard');
    await expect(dashboardPage.inviteUserButton).toBeVisible();
    await expect(dashboardPage.settingsLink).toBeVisible();
  });

  test('should display firm information', async ({ authenticatedPage }) => {
    await expect(dashboardPage.firmName).toBeVisible();
    await expect(dashboardPage.firmName).not.toBeEmpty();
  });

  test('should navigate to settings page', async ({ authenticatedPage }) => {
    await dashboardPage.navigateToSettings();
    await expect(authenticatedPage).toHaveURL('/firm/settings');
  });

  test('should logout successfully', async ({ authenticatedPage }) => {
    await dashboardPage.logout();
    
    // Should redirect to home or login page
    await expect(authenticatedPage).toHaveURL(/\/(home|login)?$/);
    
    // Should not show user menu anymore
    await expect(dashboardPage.userMenu).not.toBeVisible();
  });

  test('should display users table', async ({ authenticatedPage }) => {
    await expect(dashboardPage.usersTable).toBeVisible();
    
    // Should show at least the current user
    await dashboardPage.expectUserInTable('test@example.com');
  });

  test('should open invite user modal', async ({ authenticatedPage }) => {
    await dashboardPage.inviteUser();
    
    // Verify modal is open
    const modal = authenticatedPage.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Invite User');
  });
});