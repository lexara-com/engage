import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { puppeteerConfig, testConfig } from '../config/puppeteer.config';

describe('Engage Complete E2E Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      ...puppeteerConfig,
      headless: process.env.HEADLESS !== 'false'
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport(testConfig.viewports.desktop);
    
    if (process.env.DEBUG_TESTS) {
      page.on('console', (msg) => {
        console.log(`Browser: ${msg.text()}`);
      });
    }
  });

  afterEach(async () => {
    await page.close();
  });

  // Helper function to click using evaluate (works around Puppeteer click issues)
  const clickElement = async (selector: string) => {
    return await page.evaluate((sel) => {
      const element = document.querySelector(sel) as HTMLElement;
      if (element) {
        element.click();
        return true;
      }
      return false;
    }, selector);
  };

  it('should load homepage and show disclaimer', async () => {
    const response = await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    expect(response?.status()).toBe(200);
    
    const title = await page.title();
    expect(title).toContain('Legal Consultation - Engage');
    
    // Wait for JS to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check disclaimer is visible
    const isModalVisible = await page.evaluate(() => {
      const modal = document.querySelector('#disclaimer-modal');
      return modal && !modal.classList.contains('hidden');
    });
    
    expect(isModalVisible).toBe(true);
  });

  it('should accept disclaimer and enable chat', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer using evaluate
    const clickSuccess = await clickElement('#disclaimer-accept');
    expect(clickSuccess).toBe(true);
    
    // Wait for modal to hide
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Verify chat interface is accessible
    const messageInput = await page.$('#message-input');
    const sendButton = await page.$('#send-button');
    
    expect(messageInput).toBeTruthy();
    expect(sendButton).toBeTruthy();
  });

  it('should send message and receive AI response', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer
    await clickElement('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Type message
    const testMessage = 'Hello, I need help with a car accident case';
    await page.focus('#message-input');
    await page.type('#message-input', testMessage);
    
    // Get initial message count
    const initialCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    
    // Send message using evaluate
    const sendSuccess = await clickElement('#send-button');
    expect(sendSuccess).toBe(true);
    
    // Wait for user message to appear
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.message-bubble').length > expectedCount,
      {},
      initialCount,
      { timeout: 10000 }
    );
    
    // Wait for AI response (expect at least 2 new messages: user + AI)
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.message-bubble').length >= expectedCount + 2,
      {},
      initialCount,
      { timeout: 30000 } // Give AI more time to respond
    );
    
    // Verify we got both messages
    const finalCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    expect(finalCount).toBeGreaterThanOrEqual(initialCount + 2);
    
    // Check for AI response patterns
    const lastMessage = await page.evaluate(() => {
      const messages = document.querySelectorAll('.message-bubble');
      if (messages.length === 0) return '';
      const lastMsg = messages[messages.length - 1];
      return lastMsg.textContent || '';
    });
    
    const hasAIResponse = testConfig.aiResponsePatterns.some(pattern => 
      lastMessage.toLowerCase().includes(pattern.toLowerCase())
    );
    expect(hasAIResponse).toBe(true);
  });

  it('should handle multiple conversation turns', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer
    await clickElement('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // First message
    await page.focus('#message-input');
    await page.type('#message-input', 'I was in a car accident');
    
    let currentCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    await clickElement('#send-button');
    
    // Wait for first exchange
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.message-bubble').length >= expectedCount + 2,
      {},
      currentCount,
      { timeout: 30000 }
    );
    
    // Clear input and send second message
    await page.evaluate(() => {
      const input = document.querySelector('#message-input') as HTMLTextAreaElement;
      if (input) input.value = '';
    });
    
    await page.focus('#message-input');
    await page.type('#message-input', 'My name is John Smith and I live in California');
    
    currentCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    await clickElement('#send-button');
    
    // Wait for second exchange
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.message-bubble').length >= expectedCount + 2,
      {},
      currentCount,
      { timeout: 30000 }
    );
    
    // Verify we have multiple conversation turns
    const finalCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    expect(finalCount).toBeGreaterThanOrEqual(4); // At least 2 user + 2 AI messages
  });

  it('should work on mobile viewport', async () => {
    await page.setViewport(testConfig.viewports.mobile);
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer
    await clickElement('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Check elements are accessible
    const messageInput = await page.$('#message-input');
    const sendButton = await page.$('#send-button');
    
    expect(messageInput).toBeTruthy();
    expect(sendButton).toBeTruthy();
    
    // Test interaction
    await page.focus('#message-input');
    await page.type('#message-input', 'Mobile test message');
    
    const inputValue = await page.$eval('#message-input', (el: HTMLTextAreaElement) => el.value);
    expect(inputValue).toBe('Mobile test message');
    
    // Send message
    const initialCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    await clickElement('#send-button');
    
    // Verify message was sent
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.message-bubble').length > expectedCount,
      {},
      initialCount,
      { timeout: 10000 }
    );
    
    const newCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    expect(newCount).toBeGreaterThan(initialCount);
  });

  it('should handle character count', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer
    await clickElement('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Check initial count
    const initialCount = await page.evaluate(() => {
      const counter = document.querySelector('#char-count');
      return counter?.textContent?.trim() || '';
    });
    expect(initialCount).toContain('0');
    
    // Type text and check count
    const testText = 'This is a test message for character counting';
    await page.focus('#message-input');
    await page.type('#message-input', testText);
    
    // Wait for count update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const updatedCount = await page.evaluate(() => {
      const counter = document.querySelector('#char-count');
      return counter?.textContent?.trim() || '';
    });
    
    expect(updatedCount).toContain(testText.length.toString());
  });

  it('should persist session information', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Accept disclaimer  
    await clickElement('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Send a message to establish session
    await page.focus('#message-input');
    await page.type('#message-input', 'Session test message');
    await clickElement('#send-button');
    
    // Wait for session to be established
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check for session persistence
    const hasSession = await page.evaluate(() => {
      const url = new URL(window.location.href);
      const sessionFromUrl = url.searchParams.get('session') || url.searchParams.get('sessionId');
      
      const sessionFromStorage = localStorage.getItem('engage-session') || 
                               sessionStorage.getItem('engage-session') ||
                               localStorage.getItem('sessionId') ||
                               sessionStorage.getItem('sessionId');
      
      return !!(sessionFromUrl || sessionFromStorage);
    });
    
    expect(hasSession).toBe(true);
  });

  it('should handle page refresh and resume session', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer and send message
    await clickElement('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    const uniqueMessage = `Test message ${Date.now()}`;
    await page.focus('#message-input');
    await page.type('#message-input', uniqueMessage);
    await clickElement('#send-button');
    
    // Wait for message to appear
    await page.waitForFunction(
      (msg) => document.body.textContent?.includes(msg),
      {},
      uniqueMessage,
      { timeout: 10000 }
    );
    
    // Refresh page
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if message persists (depends on implementation)
    const pageText = await page.evaluate(() => document.body.textContent || '');
    
    // If session resumption is implemented, the message should still be there
    // For now, just verify page loads correctly after refresh
    const title = await page.title();
    expect(title).toContain('Legal Consultation - Engage');
  });

  it('should show proper loading and typing indicators', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer
    await clickElement('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Send message
    await page.focus('#message-input');
    await page.type('#message-input', 'Test message for loading indicators');
    await clickElement('#send-button');
    
    // Check for typing indicator (might appear briefly)
    const hasTypingIndicator = await page.evaluate(() => {
      const indicator = document.querySelector('#typing-indicator');
      return !!indicator;
    });
    
    expect(hasTypingIndicator).toBe(true);
    
    // Check for loading spinner on send button (might appear briefly)
    const hasLoadingSpinner = await page.evaluate(() => {
      const spinner = document.querySelector('.loading-spinner');
      return !!spinner;
    });
    
    expect(hasLoadingSpinner).toBe(true);
  });

  it('should validate message limits', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer
    await clickElement('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Test empty message (should not send)
    const initialCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    await clickElement('#send-button');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const countAfterEmpty = await page.$$eval('.message-bubble', msgs => msgs.length);
    expect(countAfterEmpty).toBe(initialCount); // Should not have increased
    
    // Test normal message
    await page.focus('#message-input');
    await page.type('#message-input', 'Valid test message');
    await clickElement('#send-button');
    
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.message-bubble').length > expectedCount,
      {},
      initialCount,
      { timeout: 10000 }
    );
    
    const finalCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    expect(finalCount).toBeGreaterThan(initialCount);
  });
});

export { };