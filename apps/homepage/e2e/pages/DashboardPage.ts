import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly firmName: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly inviteUserButton: Locator;
  readonly usersTable: Locator;
  readonly settingsLink: Locator;
  readonly conversationsSection: Locator;
  readonly conversationItems: Locator;
  readonly statsCards: Locator;
  readonly intakeLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1');
    this.firmName = page.locator('[data-testid="firm-name"]');
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.logoutButton = page.locator('a:has-text("Sign Out")');
    this.inviteUserButton = page.locator('[data-testid="invite-user-button"]');
    this.usersTable = page.locator('[data-testid="users-table"]');
    this.settingsLink = page.locator('a[href="/firm/settings"]');
    this.conversationsSection = page.locator('div:has(h3:text("Recent Conversations"))');
    this.conversationItems = page.locator('a[href^="/firm/conversations/"]');
    this.statsCards = page.locator('div.grid > div:has(p:text("New conversations"), p:text("In progress"), p:text("Completed"), p:text("Lead to client"))');
    this.intakeLink = page.locator('code:has-text("https://intake.lexara.app/")');
  }

  async goto() {
    await this.page.goto('/firm/dashboard');
  }

  async expectToBeLoggedIn() {
    await expect(this.userMenu).toBeVisible();
    await expect(this.firmName).toBeVisible();
  }

  async logout() {
    await this.userMenu.click();
    await this.logoutButton.click();
  }

  async navigateToSettings() {
    await this.settingsLink.click();
  }

  async expectUserInTable(email: string) {
    const userRow = this.page.locator(`tr:has-text("${email}")`);
    await expect(userRow).toBeVisible();
  }

  async inviteUser() {
    await this.inviteUserButton.click();
  }

  async clickConversation(clientName: string) {
    const conversationLink = this.page.locator(`a[href^="/firm/conversations/"]:has-text("${clientName}")`);
    await conversationLink.click();
  }

  async expectConversationCount(count: number) {
    await expect(this.conversationItems).toHaveCount(count);
  }

  async expectStatsCard(label: string, value: string) {
    const card = this.page.locator(`div:has(p:text("${label}")) >> p:has-text("${value}")`);
    await expect(card).toBeVisible();
  }

  async expectIntakeLinkVisible() {
    await expect(this.intakeLink).toBeVisible();
  }
}