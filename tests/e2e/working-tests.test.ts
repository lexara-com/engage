import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { puppeteerConfig, testConfig } from '../config/puppeteer.config';

describe('Engage Working Tests', () => {
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

  it('should load the homepage successfully', async () => {
    const response = await page.goto(testConfig.baseUrl);
    expect(response?.status()).toBe(200);
    
    const title = await page.title();
    expect(title).toContain('Legal Consultation - Engage');
  });

  it('should show disclaimer modal on load', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    
    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if disclaimer modal is visible (no hidden class)
    const isModalVisible = await page.evaluate(() => {
      const modal = document.querySelector('#disclaimer-modal');
      return modal && !modal.classList.contains('hidden');
    });
    
    expect(isModalVisible).toBe(true);
    
    // Check disclaimer content
    const disclaimerText = await page.evaluate(() => {
      const modal = document.querySelector('#disclaimer-modal');
      return modal?.textContent || '';
    });
    
    expect(disclaimerText).toContain('No Attorney-Client Relationship');
    expect(disclaimerText).toContain('No Legal Advice');
  });

  it('should have clickable accept button', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if accept button is present and clickable
    const acceptButton = await page.$('#disclaimer-accept');
    expect(acceptButton).toBeTruthy();
    
    const isClickable = await page.evaluate(() => {
      const button = document.querySelector('#disclaimer-accept');
      return button && !button.hasAttribute('disabled');
    });
    
    expect(isClickable).toBe(true);
  });

  it('should accept disclaimer and hide modal', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify modal is initially visible
    let isVisible = await page.evaluate(() => {
      const modal = document.querySelector('#disclaimer-modal');
      return modal && !modal.classList.contains('hidden');
    });
    expect(isVisible).toBe(true);
    
    // Click accept button
    await page.click('#disclaimer-accept');
    
    // Wait for modal to be hidden
    await page.waitForFunction(
      () => {
        const modal = document.querySelector('#disclaimer-modal');
        return modal && modal.classList.contains('hidden');
      },
      { timeout: 5000 }
    );
    
    // Verify modal is now hidden
    isVisible = await page.evaluate(() => {
      const modal = document.querySelector('#disclaimer-modal');
      return modal && !modal.classList.contains('hidden');
    });
    expect(isVisible).toBe(false);
  });

  it('should enable chat interface after accepting disclaimer', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer
    await page.click('#disclaimer-accept');
    
    // Wait for modal to hide
    await page.waitForFunction(
      () => {
        const modal = document.querySelector('#disclaimer-modal');
        return modal && modal.classList.contains('hidden');
      },
      { timeout: 5000 }
    );
    
    // Check if message input is accessible
    const messageInput = await page.$('#message-input');
    expect(messageInput).toBeTruthy();
    
    // Try to type in input
    await page.focus('#message-input');
    await page.type('#message-input', 'Test message');
    
    const inputValue = await page.$eval('#message-input', (el: HTMLTextAreaElement) => el.value);
    expect(inputValue).toBe('Test message');
    
    // Check send button is present
    const sendButton = await page.$('#send-button');
    expect(sendButton).toBeTruthy();
  });

  it('should send a message and show it in chat', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer
    await page.click('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Get initial message count
    const initialCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    
    // Type and send message
    const testMessage = 'Hello, I need legal help with a contract';
    await page.focus('#message-input');
    await page.type('#message-input', testMessage);
    await page.click('#send-button');
    
    // Wait for user message to appear
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.message-bubble').length > expectedCount,
      {},
      initialCount,
      { timeout: 10000 }
    );
    
    // Check that message was added
    const newCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    expect(newCount).toBeGreaterThan(initialCount);
    
    // Check if the message content appears somewhere on the page
    const pageText = await page.evaluate(() => document.body.textContent || '');
    expect(pageText).toContain(testMessage);
  });

  it('should wait for AI response after sending message', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer
    await page.click('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Send message
    const testMessage = 'I was in a car accident and need legal help';
    await page.focus('#message-input');
    await page.type('#message-input', testMessage);
    
    const initialCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    await page.click('#send-button');
    
    // Wait for user message
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.message-bubble').length > expectedCount,
      {},
      initialCount,
      { timeout: 10000 }
    );
    
    // Wait for AI response (should be at least 2 new messages)
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.message-bubble').length >= expectedCount + 2,
      {},
      initialCount,
      { timeout: 20000 }
    );
    
    // Verify we have both user and AI messages
    const finalCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    expect(finalCount).toBeGreaterThanOrEqual(initialCount + 2);
    
    // Check for typical AI response patterns
    const lastMessage = await page.evaluate(() => {
      const messages = document.querySelectorAll('.message-bubble');
      if (messages.length === 0) return '';
      const lastMsg = messages[messages.length - 1];
      return lastMsg.textContent || '';
    });
    
    // Should contain some typical AI assistant language
    const hasAIResponse = testConfig.aiResponsePatterns.some(pattern => 
      lastMessage.toLowerCase().includes(pattern.toLowerCase())
    );
    
    expect(hasAIResponse).toBe(true);
  });

  it('should work on mobile viewport', async () => {
    await page.setViewport(testConfig.viewports.mobile);
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer
    await page.click('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Check elements are accessible on mobile
    const messageInput = await page.$('#message-input');
    const sendButton = await page.$('#send-button');
    
    expect(messageInput).toBeTruthy();
    expect(sendButton).toBeTruthy();
    
    // Check touch targets are large enough
    const inputBox = await messageInput?.boundingBox();
    const buttonBox = await sendButton?.boundingBox();
    
    expect(inputBox?.height).toBeGreaterThan(30);
    expect(buttonBox?.height).toBeGreaterThan(30);
    
    // Test interaction on mobile
    await page.tap('#message-input');
    await page.type('#message-input', 'Mobile test message');
    
    const inputValue = await page.$eval('#message-input', (el: HTMLTextAreaElement) => el.value);
    expect(inputValue).toBe('Mobile test message');
  });

  it('should handle character count display', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer
    await page.click('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Check initial character count
    const initialCount = await page.evaluate(() => {
      const counter = document.querySelector('#char-count');
      return counter?.textContent || '';
    });
    
    expect(initialCount).toContain('0');
    
    // Type some text and check count updates
    const testText = 'This is a test message';
    await page.focus('#message-input');
    await page.type('#message-input', testText);
    
    const updatedCount = await page.evaluate(() => {
      const counter = document.querySelector('#char-count');
      return counter?.textContent || '';
    });
    
    expect(updatedCount).toContain(testText.length.toString());
  });

  it('should persist session information', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000)); // Give time for session creation
    
    // Accept disclaimer
    await page.click('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Send a message to ensure session is active
    await page.focus('#message-input');
    await page.type('#message-input', 'Create session test');
    await page.click('#send-button');
    
    // Wait a bit for session to be established
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if session exists in URL or storage
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
});

export { };