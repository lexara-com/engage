import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { puppeteerConfig, testConfig } from '../config/puppeteer.config';

describe('Debug Button Clicking Issue', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      ...puppeteerConfig,
      headless: false, // Always show browser for debugging
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport(testConfig.viewports.desktop);
    
    page.on('console', (msg) => {
      console.log(`CONSOLE: ${msg.text()}`);
    });
  });

  afterEach(async () => {
    await page.close();
  });

  it('should debug button clicking after disclaimer', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Accept disclaimer first
    console.log('Clicking disclaimer accept button...');
    await page.click('#disclaimer-accept');
    
    // Wait for modal to hide
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    console.log('Disclaimer hidden, now checking accept button state...');
    
    // Debug the disclaimer accept button state after clicking
    const buttonState = await page.evaluate(() => {
      const button = document.querySelector('#disclaimer-accept');
      if (!button) return { exists: false };
      
      const rect = button.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(button);
      
      return {
        exists: true,
        visible: rect.width > 0 && rect.height > 0,
        position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        zIndex: computedStyle.zIndex,
        pointerEvents: computedStyle.pointerEvents,
        disabled: button.hasAttribute('disabled'),
        parentHidden: button.closest('#disclaimer-modal')?.classList.contains('hidden')
      };
    });
    
    console.log('Disclaimer accept button state after hiding:', buttonState);
    
    // Now check the message input and send button
    const messageInputState = await page.evaluate(() => {
      const input = document.querySelector('#message-input');
      if (!input) return { exists: false };
      
      const rect = input.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(input);
      
      return {
        exists: true,
        visible: rect.width > 0 && rect.height > 0,
        position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        zIndex: computedStyle.zIndex,
        pointerEvents: computedStyle.pointerEvents,
        disabled: (input as HTMLInputElement).disabled,
        readOnly: (input as HTMLInputElement).readOnly,
        tagName: input.tagName
      };
    });
    
    console.log('Message input state:', messageInputState);
    
    const sendButtonState = await page.evaluate(() => {
      const button = document.querySelector('#send-button');
      if (!button) return { exists: false };
      
      const rect = button.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(button);
      
      return {
        exists: true,
        visible: rect.width > 0 && rect.height > 0,
        position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        zIndex: computedStyle.zIndex,
        pointerEvents: computedStyle.pointerEvents,
        disabled: button.hasAttribute('disabled'),
        tagName: button.tagName,
        type: button.getAttribute('type')
      };
    });
    
    console.log('Send button state:', sendButtonState);
    
    // Try alternative clicking methods
    console.log('Trying to focus message input...');
    try {
      await page.focus('#message-input');
      console.log('Focus successful');
    } catch (error) {
      console.log('Focus failed:', error);
    }
    
    console.log('Trying to type in message input...');
    try {
      await page.type('#message-input', 'test message');
      console.log('Type successful');
    } catch (error) {
      console.log('Type failed:', error);
    }
    
    // Try clicking via evaluate
    console.log('Trying to click send button via evaluate...');
    const clickResult = await page.evaluate(() => {
      const button = document.querySelector('#send-button') as HTMLButtonElement;
      if (button) {
        button.click();
        return { success: true, buttonExists: true };
      }
      return { success: false, buttonExists: false };
    });
    
    console.log('Evaluate click result:', clickResult);
    
    // Try clicking with coordinates
    if (sendButtonState.exists && sendButtonState.visible) {
      console.log('Trying to click with coordinates...');
      try {
        await page.mouse.click(
          sendButtonState.position.x + sendButtonState.position.width / 2,
          sendButtonState.position.y + sendButtonState.position.height / 2
        );
        console.log('Coordinate click successful');
      } catch (error) {
        console.log('Coordinate click failed:', error);
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/button-debug.png',
      fullPage: true 
    });
    
    console.log('Screenshot saved, waiting 10 seconds for observation...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  });
});

export { };