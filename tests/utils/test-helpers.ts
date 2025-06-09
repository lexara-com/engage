import { Page } from 'puppeteer';
import { testConfig } from '../config/puppeteer.config';

/**
 * Test utility functions for Engage application
 */

/**
 * Accept the legal disclaimer modal
 */
export async function acceptDisclaimer(page: Page): Promise<void> {
  // Wait for disclaimer modal to be visible (remove hidden class)
  await page.waitForFunction(
    () => {
      const modal = document.querySelector('#disclaimer-modal');
      return modal && !modal.classList.contains('hidden');
    },
    { timeout: testConfig.timeouts.element }
  );
  
  await page.waitForSelector(testConfig.selectors.disclaimerAccept, { 
    timeout: testConfig.timeouts.element 
  });
  await page.click(testConfig.selectors.disclaimerAccept);
  
  // Wait for disclaimer to hide (get hidden class back)
  await page.waitForFunction(
    () => {
      const modal = document.querySelector('#disclaimer-modal');
      return modal && modal.classList.contains('hidden');
    },
    { timeout: testConfig.timeouts.element }
  );
  
  // Wait for chat container to be visible
  await page.waitForSelector(testConfig.selectors.chatContainer, { 
    timeout: testConfig.timeouts.element 
  });
}

/**
 * Send a message and wait for AI response
 */
export async function sendMessageAndWaitForResponse(
  page: Page, 
  message: string,
  timeout: number = testConfig.timeouts.aiResponse
): Promise<void> {
  // Get initial message count
  const initialCount = await getMessageCount(page);
  
  // Type and send message
  await page.type(testConfig.selectors.messageInput, message);
  await page.click(testConfig.selectors.sendButton);
  
  // Wait for user message to appear
  await page.waitForFunction(
    (expectedCount) => document.querySelectorAll('.message-bubble').length > expectedCount,
    {},
    initialCount,
    { timeout }
  );
  
  // Wait for AI response (expect at least 2 more messages: user + AI)
  await page.waitForFunction(
    (expectedCount) => document.querySelectorAll('.message-bubble').length >= expectedCount + 2,
    {},
    initialCount,
    { timeout }
  );
}

/**
 * Get current number of messages in chat
 */
export async function getMessageCount(page: Page): Promise<number> {
  const messages = await page.$$(testConfig.selectors.messageBubbles);
  return messages.length;
}

/**
 * Get the last message text content
 */
export async function getLastMessageText(page: Page): Promise<string> {
  const messages = await page.$$(testConfig.selectors.messageBubbles);
  if (messages.length === 0) return '';
  
  const lastMessage = messages[messages.length - 1];
  const text = await page.evaluate(el => el.textContent || '', lastMessage);
  return text.trim();
}

/**
 * Check if AI response contains expected patterns
 */
export async function hasAIResponsePattern(page: Page): Promise<boolean> {
  const lastMessage = await getLastMessageText(page);
  
  return testConfig.aiResponsePatterns.some(pattern => 
    lastMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  // Puppeteer doesn't have waitForLoadState, use alternative
  await page.waitForFunction(() => document.readyState === 'complete');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Additional wait
}

/**
 * Setup page with common configurations
 */
export async function setupTestPage(page: Page): Promise<void> {
  // Set viewport
  await page.setViewport(testConfig.viewports.desktop);
  
  // Enable console logging for debugging
  page.on('console', (msg) => {
    if (process.env.DEBUG_TESTS) {
      console.log(`Browser console [${msg.type()}]: ${msg.text()}`);
    }
  });
  
  // Log network errors
  page.on('requestfailed', (request) => {
    if (process.env.DEBUG_TESTS) {
      console.log(`Failed request: ${request.url()} - ${request.failure()?.errorText}`);
    }
  });
  
  // Log response errors
  page.on('response', (response) => {
    if (response.status() >= 400 && process.env.DEBUG_TESTS) {
      console.log(`HTTP Error: ${response.status()} ${response.url()}`);
    }
  });
}

/**
 * Clear message input field
 */
export async function clearMessageInput(page: Page): Promise<void> {
  await page.evaluate((selector) => {
    const input = document.querySelector(selector) as HTMLInputElement;
    if (input) {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, testConfig.selectors.messageInput);
}

/**
 * Take screenshot for debugging
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  if (process.env.SCREENSHOT_ON_FAILURE) {
    await page.screenshot({ 
      path: `tests/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }
}

/**
 * Check if element is visible
 */
export async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const element = await page.$(selector);
    if (!element) return false;
    
    return await element.isIntersectingViewport();
  } catch {
    return false;
  }
}

/**
 * Wait for AI response with specific patterns
 */
export async function waitForAIResponse(
  page: Page, 
  patterns: string[] = testConfig.aiResponsePatterns,
  timeout: number = testConfig.timeouts.aiResponse
): Promise<boolean> {
  try {
    await page.waitForFunction(
      (expectedPatterns) => {
        const messages = document.querySelectorAll('.message-bubble');
        if (messages.length === 0) return false;
        
        const lastMessage = messages[messages.length - 1];
        const text = (lastMessage.textContent || '').toLowerCase();
        
        return expectedPatterns.some((pattern: string) => 
          text.includes(pattern.toLowerCase())
        );
      },
      {},
      patterns,
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Simulate typing with realistic delays
 */
export async function typeWithDelay(
  page: Page, 
  selector: string, 
  text: string, 
  delay: number = 50
): Promise<void> {
  await page.focus(selector);
  await page.type(selector, text, { delay });
}

/**
 * Get session ID from URL or storage
 */
export async function getSessionId(page: Page): Promise<string | null> {
  // Check URL parameters first
  const url = page.url();
  const urlParams = new URLSearchParams(url.split('?')[1] || '');
  const sessionFromUrl = urlParams.get('session') || urlParams.get('sessionId');
  
  if (sessionFromUrl) return sessionFromUrl;
  
  // Check browser storage
  const sessionFromStorage = await page.evaluate(() => {
    return localStorage.getItem('engage-session') || 
           sessionStorage.getItem('engage-session') ||
           localStorage.getItem('sessionId') ||
           sessionStorage.getItem('sessionId');
  });
  
  return sessionFromStorage;
}

/**
 * Validate conversation state
 */
export async function validateConversationState(page: Page): Promise<{
  hasSession: boolean;
  messageCount: number;
  lastMessage: string;
  hasAIResponse: boolean;
}> {
  const sessionId = await getSessionId(page);
  const messageCount = await getMessageCount(page);
  const lastMessage = await getLastMessageText(page);
  const hasAIResponse = await hasAIResponsePattern(page);
  
  return {
    hasSession: !!sessionId,
    messageCount,
    lastMessage,
    hasAIResponse
  };
}

/**
 * Test different viewport sizes
 */
export async function testResponsiveDesign(
  page: Page, 
  testFn: (page: Page) => Promise<void>
): Promise<void> {
  const viewports = Object.entries(testConfig.viewports);
  
  for (const [name, viewport] of viewports) {
    console.log(`Testing ${name} viewport (${viewport.width}x${viewport.height})`);
    await page.setViewport(viewport);
    await testFn(page);
  }
}

export default {
  acceptDisclaimer,
  sendMessageAndWaitForResponse,
  getMessageCount,
  getLastMessageText,
  hasAIResponsePattern,
  waitForPageLoad,
  setupTestPage,
  clearMessageInput,
  takeScreenshot,
  isElementVisible,
  waitForAIResponse,
  typeWithDelay,
  getSessionId,
  validateConversationState,
  testResponsiveDesign
};