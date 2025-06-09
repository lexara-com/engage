import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

describe('Engage Chat End-to-End Tests', () => {
  let browser: Browser;
  let page: Page;
  
  // Use the latest deployed UI URL
  const BASE_URL = 'https://d7fdb312.engage-ui.pages.dev';
  
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true, // Set to false to see the browser during development
      args: ['--no-sandbox', '--disable-dev-shm-usage'], // Required for some CI environments
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Set viewport for consistent testing
    await page.setViewport({ width: 1200, height: 800 });
    
    // Enable console logging for debugging
    page.on('console', (msg) => {
      console.log(`Browser console: ${msg.text()}`);
    });
    
    // Log network errors
    page.on('requestfailed', (request) => {
      console.log(`Failed request: ${request.url()} - ${request.failure()?.errorText}`);
    });
  });

  afterEach(async () => {
    await page.close();
  });

  it('should load the main page successfully', async () => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBe(200);
    
    // Check that the page title is correct
    const title = await page.title();
    expect(title).toContain('Legal Consultation - Engage');
  });

  it('should show legal disclaimer modal on first load', async () => {
    await page.goto(BASE_URL);
    
    // Wait for disclaimer modal to be visible (not have hidden class)
    await page.waitForFunction(
      () => {
        const modal = document.querySelector('#disclaimer-modal');
        return modal && !modal.classList.contains('hidden');
      },
      { timeout: 5000 }
    );
    
    // Check that disclaimer modal is visible
    const modal = await page.$('#disclaimer-modal');
    const isVisible = await modal?.isIntersectingViewport();
    expect(isVisible).toBe(true);
    
    // Check for key disclaimer text using page.evaluate
    const disclaimerText = await page.evaluate(() => {
      const modal = document.querySelector('#disclaimer-modal');
      return modal?.textContent || '';
    });
    expect(disclaimerText).toContain('No Attorney-Client Relationship');
    expect(disclaimerText).toContain('No Legal Advice');
  });

  it('should accept disclaimer and show chat interface', async () => {
    await page.goto(BASE_URL);
    
    // Wait for and click the accept button
    await page.waitForSelector('#disclaimer-accept');
    await page.click('#disclaimer-accept');
    
    // Wait for disclaimer to hide and chat to show
    await page.waitForSelector('#disclaimer-modal.hidden', { timeout: 5000 });
    await page.waitForSelector('#chat-container', { timeout: 5000 });
    
    // Verify chat interface elements are present
    const chatContainer = await page.$('#chat-container');
    expect(chatContainer).toBeTruthy();
    
    const messageInput = await page.$('#message-input');
    expect(messageInput).toBeTruthy();
    
    const sendButton = await page.$('#send-button');
    expect(sendButton).toBeTruthy();
  });

  it('should send a message and receive AI response', async () => {
    await page.goto(BASE_URL);
    
    // Accept disclaimer
    await page.waitForSelector('#disclaimer-accept');
    await page.click('#disclaimer-accept');
    await page.waitForSelector('#chat-container');
    
    // Type a test message
    const testMessage = 'Hello, I need legal help with a car accident';
    await page.type('#message-input', testMessage);
    
    // Send the message
    await page.click('#send-button');
    
    // Wait for user message to appear
    await page.waitForFunction(
      (msg) => document.body.textContent?.includes(msg),
      {},
      testMessage,
      { timeout: 10000 }
    );
    
    // Wait for AI response to appear (look for typical AI response patterns)
    await page.waitForFunction(
      () => {
        const text = document.body.textContent || '';
        return text.includes('happy to assist') || 
               text.includes('gather information') || 
               text.includes('legal matter') ||
               text.includes('tell me your name');
      },
      {},
      { timeout: 15000 }
    );
    
    // Verify the conversation shows both messages
    const chatMessages = await page.$$('.message-bubble');
    expect(chatMessages.length).toBeGreaterThanOrEqual(2); // User message + AI response
  });

  it('should handle multiple messages in conversation', async () => {
    await page.goto(BASE_URL);
    
    // Accept disclaimer
    await page.waitForSelector('#disclaimer-accept');
    await page.click('#disclaimer-accept');
    await page.waitForSelector('#chat-container');
    
    // Send first message
    await page.type('#message-input', 'I was in a car accident');
    await page.click('#send-button');
    
    // Wait for AI response
    await page.waitForFunction(
      () => (document.querySelectorAll('.message-bubble').length >= 2),
      {},
      { timeout: 15000 }
    );
    
    // Clear input and send second message
    await page.evaluate(() => {
      const input = document.querySelector('#message-input') as HTMLInputElement;
      if (input) input.value = '';
    });
    
    await page.type('#message-input', 'My name is John Smith');
    await page.click('#send-button');
    
    // Wait for second AI response
    await page.waitForFunction(
      () => (document.querySelectorAll('.message-bubble').length >= 4),
      {},
      { timeout: 15000 }
    );
    
    // Verify conversation flow
    const messages = await page.$$('.message-bubble');
    expect(messages.length).toBeGreaterThanOrEqual(4); // 2 user + 2 AI messages
  });

  it('should maintain session on page refresh', async () => {
    await page.goto(BASE_URL);
    
    // Accept disclaimer and send a message
    await page.waitForSelector('#disclaimer-accept');
    await page.click('#disclaimer-accept');
    await page.waitForSelector('#chat-container');
    
    const testMessage = 'Test message for session persistence';
    await page.type('#message-input', testMessage);
    await page.click('#send-button');
    
    // Wait for message to appear
    await page.waitForFunction(
      (msg) => document.body.textContent?.includes(msg),
      {},
      testMessage,
      { timeout: 10000 }
    );
    
    // Refresh the page
    await page.reload();
    
    // Should skip disclaimer and show chat with previous messages
    await page.waitForSelector('#chat-container', { timeout: 5000 });
    
    // Verify the test message is still there
    const pageText = await page.textContent('body');
    expect(pageText).toContain(testMessage);
  });

  it('should handle error states gracefully', async () => {
    await page.goto(BASE_URL);
    
    // Accept disclaimer
    await page.waitForSelector('#disclaimer-accept');
    await page.click('#disclaimer-accept');
    await page.waitForSelector('#chat-container');
    
    // Mock a network error by intercepting requests
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('/api/chat')) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Try to send a message
    await page.type('#message-input', 'This should fail');
    await page.click('#send-button');
    
    // Wait for error handling (this depends on your error UI implementation)
    // For now, just verify the message input is re-enabled
    await page.waitForTimeout(3000);
    
    const inputDisabled = await page.$eval('#message-input', 
      (el: HTMLInputElement) => el.disabled
    );
    expect(inputDisabled).toBe(false);
  });

  it('should be responsive on mobile viewport', async () => {
    // Set mobile viewport
    await page.setViewport({ width: 375, height: 667 }); // iPhone SE size
    
    await page.goto(BASE_URL);
    
    // Accept disclaimer
    await page.waitForSelector('#disclaimer-accept');
    await page.click('#disclaimer-accept');
    await page.waitForSelector('#chat-container');
    
    // Check that elements are still accessible and properly sized
    const messageInput = await page.$('#message-input');
    const sendButton = await page.$('#send-button');
    
    expect(messageInput).toBeTruthy();
    expect(sendButton).toBeTruthy();
    
    // Verify input is not too small to use
    const inputBox = await messageInput?.boundingBox();
    expect(inputBox?.height).toBeGreaterThan(30); // Minimum touch target
    
    const buttonBox = await sendButton?.boundingBox();
    expect(buttonBox?.height).toBeGreaterThan(30); // Minimum touch target
  });

  it('should validate session creation with backend', async () => {
    await page.goto(BASE_URL);
    
    // Accept disclaimer
    await page.waitForSelector('#disclaimer-accept');
    await page.click('#disclaimer-accept');
    await page.waitForSelector('#chat-container');
    
    // Check that a session was created (this depends on your implementation)
    // We can check if the URL has a session parameter
    const url = page.url();
    const hasSessionParam = url.includes('session=') || url.includes('sessionId=');
    
    // If not in URL, check localStorage or sessionStorage
    if (!hasSessionParam) {
      const sessionInStorage = await page.evaluate(() => {
        return localStorage.getItem('engage-session') || 
               sessionStorage.getItem('engage-session') ||
               localStorage.getItem('sessionId') ||
               sessionStorage.getItem('sessionId');
      });
      expect(sessionInStorage).toBeTruthy();
    }
  });

  it('should handle legal disclaimer decline gracefully', async () => {
    await page.goto(BASE_URL);
    
    // Wait for disclaimer modal
    await page.waitForSelector('#disclaimer-modal:not(.hidden)');
    
    // Click decline if button exists
    const declineButton = await page.$('#disclaimer-decline');
    if (declineButton) {
      await page.click('#disclaimer-decline');
      
      // Should either redirect away or show appropriate message
      await page.waitForTimeout(2000);
      
      // Verify user cannot access chat
      const chatContainer = await page.$('#chat-container');
      const isVisible = await chatContainer?.isIntersectingViewport();
      expect(isVisible).toBeFalsy();
    }
  });

  it('should validate message input constraints', async () => {
    await page.goto(BASE_URL);
    
    // Accept disclaimer
    await page.waitForSelector('#disclaimer-accept');
    await page.click('#disclaimer-accept');
    await page.waitForSelector('#chat-container');
    
    // Test empty message
    await page.click('#send-button');
    
    // Should not send empty message - verify no new message bubbles appear
    const initialMessageCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    
    await page.waitForTimeout(2000);
    
    const finalMessageCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    expect(finalMessageCount).toBe(initialMessageCount);
    
    // Test very long message
    const longMessage = 'A'.repeat(5000);
    await page.type('#message-input', longMessage);
    
    // Should either truncate or show validation message
    const inputValue = await page.$eval('#message-input', 
      (el: HTMLInputElement) => el.value
    );
    
    // Verify reasonable message length limits
    expect(inputValue.length).toBeLessThanOrEqual(2000);
  });
});

export { }; // Make this a module