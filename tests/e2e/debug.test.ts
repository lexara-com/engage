import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { puppeteerConfig, testConfig } from '../config/puppeteer.config';

describe('Debug Engage Application', () => {
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
    
    // Log everything
    page.on('console', (msg) => {
      console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
    });
    
    page.on('pageerror', (error) => {
      console.log(`BROWSER ERROR: ${error.message}`);
    });
    
    page.on('requestfailed', (request) => {
      console.log(`FAILED REQUEST: ${request.url()} - ${request.failure()?.errorText}`);
    });
    
    page.on('response', (response) => {
      if (response.status() >= 400) {
        console.log(`HTTP ERROR: ${response.status()} ${response.url()}`);
      }
    });
  });

  afterEach(async () => {
    await page.close();
  });

  it('should inspect page state after loading', async () => {
    console.log('Navigating to:', testConfig.baseUrl);
    const response = await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    console.log('Response status:', response?.status());
    
    // Wait for initial JavaScript to run
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check disclaimer modal state
    const modalState = await page.evaluate(() => {
      const modal = document.querySelector('#disclaimer-modal');
      return {
        exists: !!modal,
        hasHidden: modal?.classList.contains('hidden'),
        allClasses: modal?.className,
        isVisible: modal ? !modal.classList.contains('hidden') : false,
        innerHTML: modal?.innerHTML?.substring(0, 200) + '...'
      };
    });
    
    console.log('Modal state:', modalState);
    
    // Check if any JavaScript files loaded
    const scripts = await page.evaluate(() => {
      return Array.from(document.scripts).map(script => ({
        src: script.src,
        hasContent: script.innerHTML.length > 0
      }));
    });
    
    console.log('Scripts loaded:', scripts);
    
    // Check for any errors in window.onerror
    const windowErrors = await page.evaluate(() => {
      return (window as any).__errors__ || [];
    });
    
    console.log('Window errors:', windowErrors);
    
    // Try to manually trigger modal show
    const manualTrigger = await page.evaluate(() => {
      const modal = document.querySelector('#disclaimer-modal');
      if (modal) {
        modal.classList.remove('hidden');
        return { success: true, newClasses: modal.className };
      }
      return { success: false };
    });
    
    console.log('Manual trigger result:', manualTrigger);
    
    // Take a screenshot for visual inspection
    await page.screenshot({ 
      path: 'tests/screenshots/debug-page-state.png',
      fullPage: true 
    });
    
    console.log('Screenshot saved to tests/screenshots/debug-page-state.png');
    
    // Wait a bit longer to observe
    await new Promise(resolve => setTimeout(resolve, 10000));
  });
});

export { };