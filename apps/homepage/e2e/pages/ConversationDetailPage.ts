import { Page, Locator, expect } from '@playwright/test';

export class ConversationDetailPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly clientName: Locator;
  readonly caseType: Locator;
  readonly conversationStatus: Locator;
  readonly transcript: Locator;
  readonly messages: Locator;
  readonly caseSummary: Locator;
  readonly qualificationScore: Locator;
  readonly nextSteps: Locator;
  readonly internalNotes: Locator;
  readonly exportButton: Locator;
  readonly scheduleConsultationButton: Locator;
  readonly breadcrumbs: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1');
    this.clientName = page.locator('h1');
    this.caseType = page.locator('p:has-text("Started"):first-of-type');
    this.conversationStatus = page.locator('span.rounded-full');
    this.transcript = page.locator('div:has(h2:text("Conversation Transcript"))');
    this.messages = page.locator('div.space-y-4 > div');
    this.caseSummary = page.locator('div:has(h3:text("Case Summary")) p');
    this.qualificationScore = page.locator('span:has-text("%")');
    this.nextSteps = page.locator('div:has(h3:text("Recommended Next Steps")) ul li');
    this.internalNotes = page.locator('div:has(h3:text("Internal Notes")) p');
    this.exportButton = page.locator('button:has-text("Export Transcript")');
    this.scheduleConsultationButton = page.locator('button:has-text("Schedule Consultation")');
    this.breadcrumbs = page.locator('div.flex.items-center.text-sm');
  }

  async expectToBeOnConversationPage(clientName: string) {
    await expect(this.clientName).toContainText(clientName);
    await expect(this.transcript).toBeVisible();
  }

  async expectMessageCount(count: number) {
    await expect(this.messages).toHaveCount(count);
  }

  async expectMessage(text: string, role: 'agent' | 'client') {
    const messageSelector = role === 'agent' 
      ? `div:has-text("Lexara AI") >> .. >> div:has-text("${text}")`
      : `div:has-text("${text}"):not(:has-text("Lexara AI"))`;
    const message = this.page.locator(messageSelector);
    await expect(message).toBeVisible();
  }

  async expectQualificationScore(score: number) {
    await expect(this.qualificationScore).toContainText(`${score}%`);
  }

  async expectNextStep(step: string) {
    const nextStep = this.page.locator(`li:has-text("${step}")`);
    await expect(nextStep).toBeVisible();
  }

  async expectCaseSummary(summary: string) {
    await expect(this.caseSummary.first()).toContainText(summary);
  }

  async exportTranscript() {
    await this.exportButton.click();
  }

  async scheduleConsultation() {
    await this.scheduleConsultationButton.click();
  }

  async navigateBackToDashboard() {
    const dashboardLink = this.breadcrumbs.locator('a:has-text("Dashboard")');
    await dashboardLink.click();
  }
}