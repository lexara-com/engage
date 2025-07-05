import { Page, Locator, expect } from '@playwright/test';

export class RegistrationPage {
  readonly page: Page;
  readonly firmNameInput: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly firmSizeSelect: Locator;
  readonly termsCheckbox: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;
  readonly successAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.firmNameInput = page.locator('input[name="firmName"]');
    this.firstNameInput = page.locator('input[name="firstName"]');
    this.lastNameInput = page.locator('input[name="lastName"]');
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.confirmPasswordInput = page.locator('input[name="confirmPassword"]');
    this.firmSizeSelect = page.locator('select[name="firmSize"]');
    this.termsCheckbox = page.locator('input[name="agreedToTerms"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorAlert = page.locator('[role="alert"].error');
    this.successAlert = page.locator('[role="alert"].success');
  }

  async goto() {
    await this.page.goto('/signup');
  }

  async fillRegistrationForm(data: {
    firmName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    firmSize?: string;
  }) {
    await this.firmNameInput.fill(data.firmName);
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.password);
    
    if (data.firmSize) {
      await this.firmSizeSelect.selectOption(data.firmSize);
    }
  }

  async acceptTerms() {
    await this.termsCheckbox.check();
  }

  async submit() {
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorAlert).toBeVisible();
    await expect(this.errorAlert).toContainText(message);
  }

  async expectSuccess() {
    await expect(this.successAlert).toBeVisible();
  }

  async selectPracticeAreas(areas: string[]) {
    for (const area of areas) {
      await this.page.locator(`input[value="${area}"]`).check();
    }
  }

  async selectPlan(plan: 'starter' | 'professional' | 'enterprise') {
    await this.page.locator(`input[value="${plan}"]`).check();
  }
}