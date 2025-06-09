import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { puppeteerConfig, testConfig } from '../config/puppeteer.config';

describe('Debug Disclaimer Button', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      ...puppeteerConfig,
      headless: false,
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

  it('should debug disclaimer accept button', async () => {
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Debug disclaimer accept button before clicking
    const buttonState = await page.evaluate(() => {
      const button = document.querySelector('#disclaimer-accept');
      if (!button) return { exists: false };
      
      const rect = button.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(button);
      
      // Check if button is covered by another element
      const elementAtCenter = document.elementFromPoint(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2
      );
      
      return {
        exists: true,
        selector: '#disclaimer-accept',
        visible: rect.width > 0 && rect.height > 0,
        position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        zIndex: computedStyle.zIndex,
        pointerEvents: computedStyle.pointerEvents,
        disabled: button.hasAttribute('disabled'),
        tagName: button.tagName,
        className: button.className,
        id: button.id,
        innerHTML: button.innerHTML.substring(0, 100),
        elementAtCenter: elementAtCenter?.tagName + '#' + elementAtCenter?.id + '.' + elementAtCenter?.className,
        isElementAtCenterSameAsButton: elementAtCenter === button,
        parentVisible: button.parentElement ? !button.parentElement.classList.contains('hidden') : null,
        modalState: document.querySelector('#disclaimer-modal')?.classList.contains('hidden')
      };
    });
    
    console.log('Disclaimer accept button state:', JSON.stringify(buttonState, null, 2));
    
    // Try alternative methods to click
    console.log('Trying evaluate click...');
    const evaluateClick = await page.evaluate(() => {
      const button = document.querySelector('#disclaimer-accept') as HTMLButtonElement;
      if (button) {
        button.click();
        return { success: true, clicked: true };
      }
      return { success: false, clicked: false };
    });
    console.log('Evaluate click result:', evaluateClick);
    
    // Wait and check if modal hides
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const modalStateAfter = await page.evaluate(() => {
      const modal = document.querySelector('#disclaimer-modal');
      return {
        exists: !!modal,
        hasHidden: modal?.classList.contains('hidden'),
        allClasses: modal?.className
      };
    });
    
    console.log('Modal state after evaluate click:', modalStateAfter);
    
    // If evaluate click didn't work, try coordinates
    if (!modalStateAfter.hasHidden && buttonState.exists && buttonState.visible) {
      console.log('Trying coordinate click...');
      try {
        await page.mouse.click(
          buttonState.position.x + buttonState.position.width / 2,
          buttonState.position.y + buttonState.position.height / 2
        );
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const modalStateAfterCoords = await page.evaluate(() => {
          const modal = document.querySelector('#disclaimer-modal');
          return {
            hasHidden: modal?.classList.contains('hidden')
          };
        });
        
        console.log('Modal state after coordinate click:', modalStateAfterCoords);
      } catch (error) {
        console.log('Coordinate click failed:', error);
      }
    }
    
    // Try triggering the click event directly
    if (!modalStateAfter.hasHidden) {
      console.log('Trying direct event dispatch...');
      const directEvent = await page.evaluate(() => {
        const button = document.querySelector('#disclaimer-accept');
        if (button) {
          const event = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
          });
          button.dispatchEvent(event);
          return { success: true };
        }
        return { success: false };
      });
      
      console.log('Direct event result:', directEvent);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalModalState = await page.evaluate(() => {
        const modal = document.querySelector('#disclaimer-modal');
        return {
          hasHidden: modal?.classList.contains('hidden')
        };
      });
      
      console.log('Final modal state:', finalModalState);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/disclaimer-debug.png',
      fullPage: true 
    });
    
    console.log('Screenshot saved, waiting for observation...');
    await new Promise(resolve => setTimeout(resolve, 15000));
  });
});

export { };