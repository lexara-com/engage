import { test, expect } from '@playwright/test';
import { ChatbotPage } from '../pages/ChatbotPage';
import { getPersonaByType } from '../fixtures/personas';

// Use the same firm ID as the dashboard tests
const TEST_FIRM_ID = 'firm_test_123';

test.describe('Simple Chatbot Test', () => {
  test('Create a car accident conversation for dashboard', async ({ page }) => {
    const chatbotPage = new ChatbotPage(page);
    const persona = getPersonaByType('carAccident');
    
    console.log(`🚗 Creating conversation for ${persona.name}`);
    
    // Open chatbot with ack=false to skip disclaimer
    await chatbotPage.openChatForFirm(TEST_FIRM_ID);
    
    // Wait for the AI introduction message
    await page.waitForTimeout(2000);
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: `test-results/chatbot-initial-${Date.now()}.png`,
      fullPage: true 
    });
    
    // Send the injury description
    console.log('Sending injury description...');
    const messageInput = page.locator('#message-input');
    await messageInput.fill(persona.scenario.description);
    
    const sendButton = page.locator('#send-button');
    await sendButton.click();
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Send injury details
    console.log('Sending injury details...');
    await messageInput.fill(`I have ${persona.scenario.injuries.join(', ')}`);
    await sendButton.click();
    
    await page.waitForTimeout(5000);
    
    // Send contact info
    console.log('Sending contact information...');
    await messageInput.fill(`My name is ${persona.name}, email: ${persona.email}, phone: ${persona.phone}`);
    await sendButton.click();
    
    await page.waitForTimeout(5000);
    
    // Take final screenshot
    await page.screenshot({ 
      path: `test-results/chatbot-conversation-${Date.now()}.png`,
      fullPage: true 
    });
    
    console.log(`✅ Conversation created for ${persona.name}`);
    console.log(`📧 Email: ${persona.email}`);
    console.log(`📱 Phone: ${persona.phone}`);
    console.log('');
    console.log('To see this conversation in the dashboard:');
    console.log('1. Go to https://dev.console.lexara.app');
    console.log('2. Log in with your credentials');
    console.log('3. Navigate to Conversations');
    console.log(`4. Look for "${persona.name}"`);
  });
});