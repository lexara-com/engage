import { Page, Locator, expect } from '@playwright/test';
import type { TestPersona } from '../fixtures/personas';

export class ChatbotPage {
  readonly page: Page;
  readonly chatWidget: Locator;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly chatMessages: Locator;
  readonly typingIndicator: Locator;
  readonly optionButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Common selectors for the chatbot interface
    this.chatWidget = page.locator('[data-testid="chat-widget"], #chat-widget, .chat-widget, .lexara-chat, #chat-section');
    this.messageInput = page.locator('#message-input, textarea#message-input');
    this.sendButton = page.locator('#send-button, button:has-text("Send")');
    this.chatMessages = page.locator('.message-bubble');
    this.typingIndicator = page.locator('#typing-indicator, .typing-indicator');
    this.optionButtons = page.locator('button.option, button.choice, [data-testid="chat-option"]');
  }

  /**
   * Open the chatbot for a specific firm
   */
  async openChatForFirm(firmId: string = 'firm_test_123') {
    // Add ack=false to bypass disclaimer modal
    await this.page.goto(`/?firm=${firmId}&ack=false`);
    
    // Wait for chatbot to load - try multiple possible indicators
    const loadedIndicators = [
      this.chatWidget,
      this.page.locator(':has-text("How can I help you today")'),
      this.page.locator(':has-text("Welcome to")'),
      this.page.locator(':has-text("AI ChatBot")'),
      this.page.locator(':has-text("gather information")'),
      this.messageInput
    ];
    
    let loaded = false;
    for (const indicator of loadedIndicators) {
      try {
        await indicator.waitFor({ state: 'visible', timeout: 10000 });
        loaded = true;
        break;
      } catch {
        // Try next indicator
      }
    }
    
    if (!loaded) {
      // Take a screenshot for debugging
      await this.page.screenshot({ path: 'chatbot-load-failure.png' });
      throw new Error('Chatbot failed to load');
    }
  }

  /**
   * Send a message in the chat
   */
  async sendMessage(message: string) {
    // Find the input field - it might be hidden until activated
    const input = await this.findMessageInput();
    await input.fill(message);
    
    // Find and click send button
    const sendBtn = await this.findSendButton();
    await sendBtn.click();
    
    // Wait for message to appear in chat
    await this.waitForBotResponse();
  }

  /**
   * Wait for bot to respond
   */
  async waitForBotResponse() {
    // Wait for typing indicator to appear and disappear
    try {
      await this.typingIndicator.waitFor({ state: 'visible', timeout: 5000 });
      await this.typingIndicator.waitFor({ state: 'hidden', timeout: 30000 });
    } catch {
      // Some chatbots might not have typing indicators
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Select an option button
   */
  async selectOption(optionText: string) {
    const option = this.optionButtons.filter({ hasText: optionText });
    await option.waitFor({ state: 'visible' });
    await option.click();
    await this.waitForBotResponse();
  }

  /**
   * Fill out contact form with persona data
   */
  async submitContactForm(persona: TestPersona) {
    // Fill name
    await this.fillFormField('name', persona.name);
    
    // Fill email
    await this.fillFormField('email', persona.email);
    
    // Fill phone
    await this.fillFormField('phone', persona.phone);
    
    // Submit form
    const submitButton = await this.page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Send")').last();
    await submitButton.click();
  }

  /**
   * Complete an entire conversation flow
   */
  async completeInjuryFlow(persona: TestPersona) {
    // Initial greeting - chatbot should ask about the type of case
    await this.expectBotMessage(['help you', 'How can I', 'What brings you', 'type of case']);
    
    // Select injury type
    if (await this.optionButtons.count() > 0) {
      await this.selectOption(persona.injuryType);
    } else {
      await this.sendMessage(`I need help with a ${persona.injuryType}`);
    }
    
    // Describe the incident
    await this.sendMessage(persona.scenario.description);
    
    // Answer follow-up questions
    if (persona.scenario.date) {
      await this.expectBotMessage(['When', 'date', 'happen']);
      await this.sendMessage(persona.scenario.date);
    }
    
    // Describe injuries
    await this.expectBotMessage(['injur', 'hurt', 'harm']);
    await this.sendMessage(persona.scenario.injuries.join(', '));
    
    // Medical treatment
    await this.expectBotMessage(['medical', 'treatment', 'doctor', 'hospital']);
    await this.sendMessage(persona.scenario.medicalTreatment);
    
    // Contact information
    await this.expectBotMessage(['contact', 'reach', 'name', 'email', 'phone']);
    await this.submitContactForm(persona);
    
    // Success message
    await this.expectBotMessage(['Thank you', 'received', 'contact you', 'reach out']);
  }

  /**
   * Verify a bot message contains expected text
   */
  async expectBotMessage(expectedTexts: string[]) {
    // Wait a bit for messages to appear
    await this.page.waitForTimeout(1000);
    
    // Get all text content from the chat area
    const chatArea = this.page.locator('#messages-list, #messages-container');
    await chatArea.waitFor({ state: 'visible', timeout: 5000 });
    
    // Get all message text
    const allText = await chatArea.textContent();
    
    // Check if any of the expected texts are present
    const hasExpectedText = expectedTexts.some(text => 
      allText?.toLowerCase().includes(text.toLowerCase())
    );
    
    if (!hasExpectedText) {
      console.log('Chat content:', allText);
      console.log('Expected one of:', expectedTexts);
    }
    
    expect(hasExpectedText).toBeTruthy();
  }

  /**
   * Get conversation ID from the chat
   */
  async getConversationId(): Promise<string | null> {
    // Try multiple ways to get conversation ID
    
    // 1. Check data attributes
    const chatElement = await this.chatWidget.elementHandle();
    if (chatElement) {
      const conversationId = await chatElement.getAttribute('data-conversation-id');
      if (conversationId) return conversationId;
    }
    
    // 2. Check URL parameters
    const url = new URL(this.page.url());
    const urlConversationId = url.searchParams.get('conversation');
    if (urlConversationId) return urlConversationId;
    
    // 3. Check local storage
    const storageId = await this.page.evaluate(() => {
      return localStorage.getItem('conversationId') || 
             localStorage.getItem('lexara_conversation_id') ||
             sessionStorage.getItem('conversationId');
    });
    if (storageId) return storageId;
    
    // 4. Check page content for ID patterns
    const pageContent = await this.page.content();
    const idMatch = pageContent.match(/conversation[_-]?id["\s:]+["']?([a-zA-Z0-9-_]+)/i);
    if (idMatch) return idMatch[1];
    
    return null;
  }

  /**
   * Helper to find message input with fallbacks
   */
  private async findMessageInput(): Promise<Locator> {
    const selectors = [
      'input[type="text"][placeholder*="Type"]',
      'input[type="text"][placeholder*="Message"]',
      'textarea[placeholder*="Type"]',
      'textarea[placeholder*="Message"]',
      'input.chat-input',
      'textarea.chat-input',
      '[data-testid="message-input"]'
    ];
    
    for (const selector of selectors) {
      const element = this.page.locator(selector);
      if (await element.count() > 0) {
        return element;
      }
    }
    
    // Fallback to any text input
    return this.messageInput;
  }

  /**
   * Helper to find send button with fallbacks
   */
  private async findSendButton(): Promise<Locator> {
    const selectors = [
      'button[aria-label="Send"]',
      'button:has-text("Send")',
      'button[type="submit"]',
      'button.send-button',
      '[data-testid="send-button"]'
    ];
    
    for (const selector of selectors) {
      const element = this.page.locator(selector);
      if (await element.count() > 0) {
        return element.first();
      }
    }
    
    return this.sendButton;
  }

  /**
   * Helper to fill form fields with various selectors
   */
  private async fillFormField(fieldName: string, value: string) {
    const selectors = [
      `input[name="${fieldName}"]`,
      `input[placeholder*="${fieldName}"]`,
      `input[aria-label*="${fieldName}"]`,
      `#${fieldName}`,
      `[data-testid="${fieldName}-input"]`
    ];
    
    for (const selector of selectors) {
      try {
        const field = this.page.locator(selector);
        if (await field.count() > 0) {
          await field.fill(value);
          return;
        }
      } catch {
        // Try next selector
      }
    }
    
    // If specific selectors fail, try to find by label
    const label = this.page.locator(`label:has-text("${fieldName}")`);
    if (await label.count() > 0) {
      const forAttr = await label.getAttribute('for');
      if (forAttr) {
        await this.page.locator(`#${forAttr}`).fill(value);
      }
    }
  }
}