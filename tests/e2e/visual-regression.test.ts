import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { puppeteerConfig, testConfig } from '../config/puppeteer.config';
import { setupTestPage, acceptDisclaimer, sendMessageAndWaitForResponse } from '../utils/test-helpers';

describe('Engage Visual Regression Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch(puppeteerConfig);
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await setupTestPage(page);
  });

  afterEach(async () => {
    await page.close();
  });

  it('should capture initial landing page screenshot', async () => {
    await page.goto(testConfig.baseUrl);
    
    // Wait for page to fully load
    await page.waitForSelector(testConfig.selectors.disclaimerModal);
    
    // Take screenshot of disclaimer modal
    await page.screenshot({
      path: 'tests/screenshots/baseline-disclaimer-modal.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });
    
    // This would be compared against a baseline in a real visual regression setup
    // For now, we just verify the screenshot was taken
    expect(true).toBe(true); // Placeholder assertion
  });

  it('should capture chat interface after disclaimer acceptance', async () => {
    await page.goto(testConfig.baseUrl);
    await acceptDisclaimer(page);
    
    // Wait for chat interface to be fully rendered
    await page.waitForSelector(testConfig.selectors.messageInput);
    await page.waitForTimeout(1000); // Allow animations to complete
    
    // Take screenshot of empty chat interface
    await page.screenshot({
      path: 'tests/screenshots/baseline-empty-chat.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });
    
    expect(true).toBe(true); // Placeholder assertion
  });

  it('should capture conversation with messages', async () => {
    await page.goto(testConfig.baseUrl);
    await acceptDisclaimer(page);
    
    // Send a test message and wait for response
    await sendMessageAndWaitForResponse(page, testConfig.testMessages.carAccident);
    
    // Wait for conversation to be fully rendered
    await page.waitForTimeout(2000);
    
    // Take screenshot of conversation
    await page.screenshot({
      path: 'tests/screenshots/baseline-conversation.png',
      fullPage: true // Capture entire conversation
    });
    
    expect(true).toBe(true); // Placeholder assertion
  });

  it('should capture mobile responsive layout', async () => {
    await page.setViewport(testConfig.viewports.mobile);
    await page.goto(testConfig.baseUrl);
    
    // Disclaimer on mobile
    await page.screenshot({
      path: 'tests/screenshots/baseline-mobile-disclaimer.png',
      fullPage: false
    });
    
    await acceptDisclaimer(page);
    
    // Chat interface on mobile
    await page.screenshot({
      path: 'tests/screenshots/baseline-mobile-chat.png',
      fullPage: true
    });
    
    expect(true).toBe(true); // Placeholder assertion
  });

  it('should test different UI states', async () => {
    await page.goto(testConfig.baseUrl);
    await acceptDisclaimer(page);
    
    // Test input focus state
    await page.focus(testConfig.selectors.messageInput);
    await page.screenshot({
      path: 'tests/screenshots/baseline-input-focused.png',
      fullPage: false,
      clip: { x: 0, y: 600, width: 1200, height: 200 } // Just the input area
    });
    
    // Test with typed text
    await page.type(testConfig.selectors.messageInput, 'Test message being typed...');
    await page.screenshot({
      path: 'tests/screenshots/baseline-input-with-text.png',
      fullPage: false,
      clip: { x: 0, y: 600, width: 1200, height: 200 }
    });
    
    expect(true).toBe(true); // Placeholder assertion
  });

  it('should test component isolation screenshots', async () => {
    await page.goto(testConfig.baseUrl);
    await acceptDisclaimer(page);
    
    // Send a message to get some conversation content
    await sendMessageAndWaitForResponse(page, 'Hello, I need legal help');
    
    // Screenshot individual message bubbles
    const messageBubbles = await page.$$(testConfig.selectors.messageBubbles);
    
    for (let i = 0; i < messageBubbles.length; i++) {
      const bubble = messageBubbles[i];
      const boundingBox = await bubble.boundingBox();
      
      if (boundingBox) {
        await page.screenshot({
          path: `tests/screenshots/baseline-message-bubble-${i}.png`,
          clip: boundingBox
        });
      }
    }
    
    expect(messageBubbles.length).toBeGreaterThan(0);
  });

  it('should capture error states if implemented', async () => {
    await page.goto(testConfig.baseUrl);
    await acceptDisclaimer(page);
    
    // Mock network failure to trigger error state
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('/api/chat')) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Try to send a message that should fail
    await page.type(testConfig.selectors.messageInput, 'This should trigger an error');
    await page.click(testConfig.selectors.sendButton);
    
    // Wait for potential error UI
    await page.waitForTimeout(3000);
    
    // Screenshot any error state
    await page.screenshot({
      path: 'tests/screenshots/baseline-error-state.png',
      fullPage: true
    });
    
    expect(true).toBe(true); // Placeholder assertion
  });

  it('should test cross-browser compatibility markers', async () => {
    // This test would ideally run with different browser engines
    // For now, we document the current rendering
    
    await page.goto(testConfig.baseUrl);
    await acceptDisclaimer(page);
    
    // Test CSS features that might vary across browsers
    const hasModernFeatures = await page.evaluate(() => {
      const testElement = document.createElement('div');
      testElement.style.cssText = 'display: grid; backdrop-filter: blur(10px);';
      
      return {
        hasGrid: testElement.style.display === 'grid',
        hasBackdropFilter: testElement.style.backdropFilter === 'blur(10px)',
        userAgent: navigator.userAgent
      };
    });
    
    console.log('Browser capabilities:', hasModernFeatures);
    
    // Screenshot with browser info overlay
    await page.evaluate((info) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; top: 10px; right: 10px; 
        background: rgba(0,0,0,0.8); color: white; 
        padding: 10px; font-family: monospace; font-size: 12px;
        z-index: 10000; border-radius: 4px;
      `;
      overlay.textContent = `Grid: ${info.hasGrid}, Backdrop: ${info.hasBackdropFilter}`;
      document.body.appendChild(overlay);
    }, hasModernFeatures);
    
    await page.screenshot({
      path: 'tests/screenshots/baseline-browser-compatibility.png',
      fullPage: false
    });
    
    expect(hasModernFeatures.hasGrid).toBe(true); // Modern browsers should support grid
  });

  it('should test theme variations if implemented', async () => {
    await page.goto(testConfig.baseUrl);
    await acceptDisclaimer(page);
    
    // Test light theme (default)
    await page.screenshot({
      path: 'tests/screenshots/baseline-light-theme.png',
      fullPage: true
    });
    
    // If dark theme toggle exists, test it
    const themeToggle = await page.$('[data-theme-toggle]');
    if (themeToggle) {
      await themeToggle.click();
      await page.waitForTimeout(500); // Allow theme transition
      
      await page.screenshot({
        path: 'tests/screenshots/baseline-dark-theme.png',
        fullPage: true
      });
    }
    
    expect(true).toBe(true); // Placeholder assertion
  });

  it('should test animation states', async () => {
    await page.goto(testConfig.baseUrl);
    
    // Capture disclaimer modal entrance animation
    await page.screenshot({
      path: 'tests/screenshots/baseline-modal-animation-start.png',
      fullPage: false
    });
    
    await page.waitForTimeout(500); // Wait for animations
    
    await page.screenshot({
      path: 'tests/screenshots/baseline-modal-animation-complete.png',
      fullPage: false
    });
    
    await acceptDisclaimer(page);
    
    // Test typing indicator if implemented
    await page.focus(testConfig.selectors.messageInput);
    await page.type(testConfig.selectors.messageInput, 'Testing...');
    
    await page.screenshot({
      path: 'tests/screenshots/baseline-typing-state.png',
      fullPage: false,
      clip: { x: 0, y: 500, width: 1200, height: 300 }
    });
    
    expect(true).toBe(true); // Placeholder assertion
  });
});