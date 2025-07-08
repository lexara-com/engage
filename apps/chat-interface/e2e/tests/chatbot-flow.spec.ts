import { test, expect } from '@playwright/test';
import { ChatbotPage } from '../pages/ChatbotPage';
import { personas, getPersonaByType } from '../fixtures/personas';

// Use the same firm ID as the dashboard tests
const TEST_FIRM_ID = 'firm_test_123';

test.describe('Lexara Chatbot - Personal Injury Intake Flow', () => {
  let chatbotPage: ChatbotPage;

  test.beforeEach(async ({ page }) => {
    chatbotPage = new ChatbotPage(page);
    await chatbotPage.openChatForFirm(TEST_FIRM_ID);
  });

  test('Car accident victim completes full intake flow', async ({ page }) => {
    const persona = getPersonaByType('carAccident');
    
    console.log(`🚗 Starting car accident flow for ${persona.name}`);
    
    // Complete the conversation
    await chatbotPage.completeInjuryFlow(persona);
    
    // Get conversation ID for verification
    const conversationId = await chatbotPage.getConversationId();
    console.log(`✅ Conversation completed with ID: ${conversationId}`);
    
    // Take screenshot of completed conversation
    await page.screenshot({ 
      path: `test-results/car-accident-${Date.now()}.png`,
      fullPage: true 
    });
  });

  test('Slip and fall victim completes intake with photos', async ({ page }) => {
    const persona = getPersonaByType('slipAndFall');
    
    console.log(`🚶 Starting slip and fall flow for ${persona.name}`);
    
    // Start conversation
    await chatbotPage.expectBotMessage(['help you', 'How can I', 'What brings you']);
    
    // Select premises liability
    await chatbotPage.selectOption('Premises Liability');
    
    // Describe incident
    await chatbotPage.sendMessage(persona.scenario.description);
    
    // Location details
    await chatbotPage.expectBotMessage(['Where', 'location', 'happen']);
    await chatbotPage.sendMessage(persona.scenario.location!);
    
    // Injury details
    await chatbotPage.expectBotMessage(['injur', 'hurt']);
    await chatbotPage.sendMessage(persona.scenario.injuries.join(', '));
    
    // Medical treatment
    await chatbotPage.expectBotMessage(['medical', 'treatment', 'doctor']);
    await chatbotPage.sendMessage(persona.scenario.medicalTreatment);
    
    // Photos taken
    await chatbotPage.expectBotMessage(['photo', 'picture', 'document']);
    await chatbotPage.sendMessage('Yes, I took photos of the wet floor and my injuries');
    
    // Witnesses
    await chatbotPage.expectBotMessage(['witness', 'anyone see']);
    await chatbotPage.sendMessage(persona.scenario.witnesses!);
    
    // Contact info
    await chatbotPage.expectBotMessage(['contact', 'reach you']);
    await chatbotPage.submitContactForm(persona);
    
    // Success
    await chatbotPage.expectBotMessage(['Thank you', 'received', 'contact you']);
    
    const conversationId = await chatbotPage.getConversationId();
    console.log(`✅ Slip and fall case completed with ID: ${conversationId}`);
  });

  test('Workplace injury with workers comp dispute', async ({ page }) => {
    const persona = getPersonaByType('workplaceInjury');
    
    console.log(`👷 Starting workplace injury flow for ${persona.name}`);
    
    // Complete the flow
    await chatbotPage.completeInjuryFlow(persona);
    
    const conversationId = await chatbotPage.getConversationId();
    console.log(`✅ Workplace injury case completed with ID: ${conversationId}`);
    
    // Verify conversation appears in dashboard by storing ID
    await page.evaluate((convId) => {
      sessionStorage.setItem('test_conversation_id', convId || '');
    }, conversationId);
  });

  test('Multiple choice navigation through injury types', async ({ page }) => {
    console.log('🔄 Testing multiple choice navigation');
    
    // Initial greeting
    await chatbotPage.expectBotMessage(['help you', 'How can I', 'What brings you']);
    
    // Verify all injury type options are available
    const expectedOptions = [
      'Motor Vehicle Accident',
      'Premises Liability',
      'Workplace Accident',
      'Medical Malpractice',
      'Product Liability'
    ];
    
    for (const option of expectedOptions) {
      const optionButton = chatbotPage.optionButtons.filter({ hasText: option });
      await expect(optionButton).toBeVisible();
    }
    
    // Select an option
    await chatbotPage.selectOption('Motor Vehicle Accident');
    
    // Verify follow-up question
    await chatbotPage.expectBotMessage(['tell me', 'what happened', 'describe']);
  });

  test('Form validation and error handling', async ({ page }) => {
    const persona = getPersonaByType('dogBite');
    
    console.log('🐕 Testing form validation with dog bite case');
    
    // Rush to contact form
    await chatbotPage.sendMessage('I was bitten by a dog and need help');
    await chatbotPage.sendMessage('Skip to contact form please');
    
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"], button:has-text("Submit")').last();
    if (await submitButton.isVisible()) {
      await submitButton.click();
      
      // Check for validation errors
      const errorMessages = page.locator('.error, .field-error, [role="alert"]');
      await expect(errorMessages).toHaveCount(3); // name, email, phone
    }
    
    // Fill with invalid data
    await page.fill('input[type="email"]', 'not-an-email');
    await page.fill('input[type="tel"]', '123'); // Too short
    
    await submitButton.click();
    
    // Should still have errors
    await expect(errorMessages.first()).toBeVisible();
  });

  test('Mobile responsiveness', async ({ page, browserName }) => {
    if (browserName !== 'chromium') {
      test.skip();
    }
    
    console.log('📱 Testing mobile viewport');
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const persona = getPersonaByType('medicalMalpractice');
    
    // Verify chat is still usable
    await chatbotPage.expectBotMessage(['help you', 'How can I']);
    
    // Send message on mobile
    await chatbotPage.sendMessage('Medical malpractice case');
    
    // Verify response is visible
    await chatbotPage.expectBotMessage(['sorry to hear', 'tell me more', 'what happened']);
    
    // Check that input is not covered by keyboard
    const input = await chatbotPage.findMessageInput();
    const inputBox = await input.boundingBox();
    expect(inputBox?.y).toBeLessThan(400); // Should be in upper half of screen
  });
});

test.describe('Dashboard Integration', () => {
  test('Verify conversation appears in firm dashboard', async ({ page, context }) => {
    // First, complete a chatbot conversation
    const chatbotPage = new ChatbotPage(page);
    await chatbotPage.openChatForFirm(TEST_FIRM_ID);
    
    const persona = getPersonaByType('carAccident');
    await chatbotPage.completeInjuryFlow(persona);
    
    const conversationId = await chatbotPage.getConversationId();
    console.log(`📝 Created conversation ${conversationId}`);
    
    // Now open dashboard in new tab
    const dashboardPage = await context.newPage();
    
    // Set mock authentication for dashboard
    await dashboardPage.addInitScript(() => {
      // Mock auth for dashboard access
      const mockSession = {
        isAuthenticated: true,
        userId: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        firmId: 'firm_test_123',
        firmName: 'Test Law Firm',
        roles: ['FirmAdmin'],
        exp: Math.floor(Date.now() / 1000) + 3600
      };
      
      document.cookie = `firm_session=${encodeURIComponent(JSON.stringify(mockSession))}; path=/; max-age=3600`;
    });
    
    // Navigate to conversations page
    await dashboardPage.goto('https://dev.console.lexara.app/firm/conversations');
    
    // Look for the conversation
    const conversationRow = dashboardPage.locator(`tr:has-text("${persona.name}")`);
    await expect(conversationRow).toBeVisible({ timeout: 30000 });
    
    // Verify conversation details
    await expect(conversationRow).toContainText(persona.injuryType);
    await expect(conversationRow).toContainText('New'); // Status
    
    console.log(`✅ Conversation for ${persona.name} appears in dashboard`);
  });
});