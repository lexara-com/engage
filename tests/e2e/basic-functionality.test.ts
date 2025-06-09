import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { puppeteerConfig, testConfig } from '../config/puppeteer.config';

describe('Engage Basic Functionality Tests', () => {
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
    
    // Enable console logging if debugging
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

  it('should have disclaimer modal present in DOM', async () => {
    await page.goto(testConfig.baseUrl);
    
    // Check if disclaimer modal exists
    const modal = await page.$('#disclaimer-modal');
    expect(modal).toBeTruthy();
    
    // Check if accept button exists
    const acceptButton = await page.$('#disclaimer-accept');
    expect(acceptButton).toBeTruthy();
  });

  it('should have chat interface elements in DOM', async () => {
    await page.goto(testConfig.baseUrl);
    
    // Check for message input
    const messageInput = await page.$('#message-input');
    expect(messageInput).toBeTruthy();
    
    // Check for send button
    const sendButton = await page.$('#send-button');
    expect(sendButton).toBeTruthy();
    
    // Check for messages container
    const messagesContainer = await page.$('#messages-container');
    expect(messagesContainer).toBeTruthy();
  });

  it('should show disclaimer modal on page load', async () => {
    await page.goto(testConfig.baseUrl);
    
    // Wait a moment for any initial JavaScript to run
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if modal becomes visible (loses hidden class)
    const isModalVisible = await page.evaluate(() => {
      const modal = document.querySelector('#disclaimer-modal');
      return modal && !modal.classList.contains('hidden');
    });
    
    expect(isModalVisible).toBe(true);
  });

  it('should accept disclaimer and hide modal', async () => {
    await page.goto(testConfig.baseUrl);
    
    // Wait for modal to appear
    await page.waitForFunction(
      () => {
        const modal = document.querySelector('#disclaimer-modal');
        return modal && !modal.classList.contains('hidden');
      },
      { timeout: 10000 }
    );
    
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
    
    // Verify modal is hidden
    const isModalHidden = await page.evaluate(() => {
      const modal = document.querySelector('#disclaimer-modal');
      return modal && modal.classList.contains('hidden');
    });
    
    expect(isModalHidden).toBe(true);
  });

  it('should enable message input after accepting disclaimer', async () => {
    await page.goto(testConfig.baseUrl);
    
    // Accept disclaimer
    await page.waitForFunction(
      () => {
        const modal = document.querySelector('#disclaimer-modal');
        return modal && !modal.classList.contains('hidden');
      },
      { timeout: 10000 }
    );
    
    await page.click('#disclaimer-accept');
    
    await page.waitForFunction(
      () => {
        const modal = document.querySelector('#disclaimer-modal');
        return modal && modal.classList.contains('hidden');
      },
      { timeout: 5000 }
    );
    
    // Check if message input is accessible
    const input = await page.$('#message-input');
    expect(input).toBeTruthy();
    
    // Try to focus and type in the input
    await page.focus('#message-input');
    await page.type('#message-input', 'Test message');
    
    const inputValue = await page.$eval('#message-input', (el: HTMLTextAreaElement) => el.value);
    expect(inputValue).toBe('Test message');
  });

  it('should validate send button functionality', async () => {
    await page.goto(testConfig.baseUrl);
    
    // Accept disclaimer
    await page.waitForFunction(
      () => !document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 10000 }
    );
    await page.click('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    // Type a message
    await page.focus('#message-input');
    await page.type('#message-input', 'Hello, I need legal help');
    
    // Get initial message count
    const initialCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    
    // Click send button
    await page.click('#send-button');
    
    // Wait for message to be added (user message should appear immediately)
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.message-bubble').length > expectedCount,
      {},
      initialCount,
      { timeout: 10000 }
    );
    
    // Verify message was added
    const newCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    expect(newCount).toBeGreaterThan(initialCount);
  });

  it('should handle responsive design on mobile', async () => {
    await page.setViewport(testConfig.viewports.mobile);
    await page.goto(testConfig.baseUrl);
    
    // Check that elements are still accessible
    const messageInput = await page.$('#message-input');
    const sendButton = await page.$('#send-button');
    
    expect(messageInput).toBeTruthy();
    expect(sendButton).toBeTruthy();
    
    // Check minimum touch target sizes
    const inputBox = await messageInput?.boundingBox();
    const buttonBox = await sendButton?.boundingBox();
    
    expect(inputBox?.height).toBeGreaterThan(30);
    expect(buttonBox?.height).toBeGreaterThan(30);
  });

  it('should persist session in URL or storage', async () => {
    await page.goto(testConfig.baseUrl);
    
    // Accept disclaimer and interact
    await page.waitForFunction(
      () => !document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 10000 }
    );
    await page.click('#disclaimer-accept');
    
    // Wait a moment for session creation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if session exists in URL or storage
    const hasSession = await page.evaluate(() => {
      // Check URL
      const url = new URL(window.location.href);
      const sessionFromUrl = url.searchParams.get('session') || url.searchParams.get('sessionId');
      
      // Check storage
      const sessionFromStorage = localStorage.getItem('engage-session') || 
                               sessionStorage.getItem('engage-session') ||
                               localStorage.getItem('sessionId') ||
                               sessionStorage.getItem('sessionId');
      
      return !!(sessionFromUrl || sessionFromStorage);
    });
    
    expect(hasSession).toBe(true);
  });

  it('should show connection status indicator', async () => {
    await page.goto(testConfig.baseUrl);
    
    // Check for connection status element
    const connectionStatus = await page.$('#connection-status');
    expect(connectionStatus).toBeTruthy();
    
    // Check for connected state
    const statusText = await page.evaluate(() => {
      const status = document.querySelector('#connection-status');
      return status?.textContent || '';
    });
    
    expect(statusText.toLowerCase()).toContain('connected');
  });
});

export { };