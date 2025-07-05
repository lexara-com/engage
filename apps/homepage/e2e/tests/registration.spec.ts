import { test, expect } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage';

test.describe('Firm Registration Flow', () => {
  let registrationPage: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    registrationPage = new RegistrationPage(page);
    await registrationPage.goto();
  });

  test('should display registration form with all required fields', async ({ page }) => {
    // Verify all form elements are present
    await expect(registrationPage.firmNameInput).toBeVisible();
    await expect(registrationPage.firstNameInput).toBeVisible();
    await expect(registrationPage.lastNameInput).toBeVisible();
    await expect(registrationPage.emailInput).toBeVisible();
    await expect(registrationPage.passwordInput).toBeVisible();
    await expect(registrationPage.confirmPasswordInput).toBeVisible();
    await expect(registrationPage.firmSizeSelect).toBeVisible();
    await expect(registrationPage.termsCheckbox).toBeVisible();
    await expect(registrationPage.submitButton).toBeVisible();
  });

  test('should show validation errors for empty required fields', async ({ page }) => {
    // Try to submit without filling any fields
    await registrationPage.submit();
    
    // Should show validation error
    await registrationPage.expectError('Please fill in all required fields');
  });

  test('should show error for mismatched passwords', async ({ page }) => {
    await registrationPage.fillRegistrationForm({
      firmName: 'Test Law Firm',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@testfirm.com',
      password: 'SecurePass123!',
    });
    
    // Enter different confirm password
    await registrationPage.confirmPasswordInput.fill('DifferentPass123!');
    await registrationPage.acceptTerms();
    await registrationPage.submit();
    
    await registrationPage.expectError('Passwords do not match');
  });

  test('should show error for weak password', async ({ page }) => {
    await registrationPage.fillRegistrationForm({
      firmName: 'Test Law Firm',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@testfirm.com',
      password: 'weak',
    });
    
    await registrationPage.acceptTerms();
    await registrationPage.submit();
    
    await registrationPage.expectError('Password must be at least 8 characters');
  });

  test('should require terms acceptance', async ({ page }) => {
    await registrationPage.fillRegistrationForm({
      firmName: 'Test Law Firm',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@testfirm.com',
      password: 'SecurePass123!',
      firmSize: '1-5',
    });
    
    // Don't check terms
    await registrationPage.submit();
    
    await registrationPage.expectError('Please agree to the Terms of Service');
  });

  test('should successfully register a new firm', async ({ page }) => {
    // Fill out the registration form
    await registrationPage.fillRegistrationForm({
      firmName: 'E2E Test Law Firm',
      firstName: 'Jane',
      lastName: 'Smith',
      email: `test-${Date.now()}@e2etest.com`,
      password: 'SecurePass123!',
      firmSize: '1-5',
    });
    
    // Select practice areas
    await registrationPage.selectPracticeAreas(['personal_injury', 'family_law']);
    
    // Select plan
    await registrationPage.selectPlan('starter');
    
    // Accept terms
    await registrationPage.acceptTerms();
    
    // Submit form
    await registrationPage.submit();
    
    // Should show success message
    await registrationPage.expectSuccess();
    
    // Should redirect to verification or dashboard page
    await expect(page).toHaveURL(/\/(verify|dashboard|login)/);
  });

  test('should handle duplicate email registration', async ({ page }) => {
    const duplicateEmail = 'existing@testfirm.com';
    
    await registrationPage.fillRegistrationForm({
      firmName: 'Another Test Firm',
      firstName: 'Jane',
      lastName: 'Doe',
      email: duplicateEmail,
      password: 'SecurePass123!',
      firmSize: '6-10',
    });
    
    await registrationPage.acceptTerms();
    await registrationPage.submit();
    
    // Should show error about existing email
    await registrationPage.expectError('already registered');
  });

  test('should validate email format', async ({ page }) => {
    await registrationPage.fillRegistrationForm({
      firmName: 'Test Law Firm',
      firstName: 'John',
      lastName: 'Doe',
      email: 'invalid-email',
      password: 'SecurePass123!',
    });
    
    await registrationPage.acceptTerms();
    await registrationPage.submit();
    
    await registrationPage.expectError('valid email');
  });
});