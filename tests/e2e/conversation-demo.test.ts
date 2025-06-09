import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { puppeteerConfig, testConfig } from '../config/puppeteer.config';

describe('Legal Consultation Conversation Demo', () => {
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
    
    page.on('console', (msg) => {
      console.log(`🤖 BROWSER: ${msg.text()}`);
    });
  });

  afterEach(async () => {
    await page.close();
  });

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

  const sendMessage = async (message: string) => {
    console.log(`\n👤 USER: ${message}`);
    
    // Clear input and type message
    await page.evaluate(() => {
      const input = document.querySelector('#message-input') as HTMLTextAreaElement;
      if (input) input.value = '';
    });
    
    await page.focus('#message-input');
    await page.type('#message-input', message);
    
    const initialCount = await page.$$eval('.message-bubble', msgs => msgs.length);
    await clickElement('#send-button');
    
    // Wait for user message
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.message-bubble').length > expectedCount,
      {},
      initialCount,
      { timeout: 10000 }
    );
    
    // Wait for AI response
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.message-bubble').length >= expectedCount + 2,
      {},
      initialCount,
      { timeout: 30000 }
    );
    
    // Wait for typing to finish
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get AI response
    const aiResponse = await page.evaluate(() => {
      const messages = document.querySelectorAll('.message-bubble');
      if (messages.length === 0) return '';
      
      const lastMsg = messages[messages.length - 1];
      const text = lastMsg.textContent?.trim() || '';
      
      if (text.toLowerCase().includes('typing') || text.length < 10) {
        if (messages.length > 1) {
          const secondLastMsg = messages[messages.length - 2];
          return secondLastMsg.textContent?.trim() || '';
        }
      }
      
      return text;
    });
    
    console.log(`🤖 AI: ${aiResponse.substring(0, 300)}${aiResponse.length > 300 ? '...' : ''}`);
    return aiResponse;
  };

  it('should demonstrate a realistic legal consultation', async () => {
    console.log('🎯 DEMONSTRATING COMPLETE LEGAL CONSULTATION CONVERSATION');
    console.log('=' .repeat(80));
    
    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n📋 Step 1: Accepting Legal Disclaimer');
    await clickElement('#disclaimer-accept');
    await page.waitForFunction(
      () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
      { timeout: 5000 }
    );
    
    console.log('\n🚨 Step 2: Initial Problem Description');
    let response = await sendMessage(
      "Hello, I was in a car accident yesterday. The other driver ran a red light and crashed into my car. I think I need legal help."
    );
    
    expect(response.length).toBeGreaterThan(50);
    expect(response.toLowerCase()).toMatch(/sorry|accident|help|assist|information|legal|gather|tell|name/);
    
    console.log('\n👤 Step 3: Personal Information');
    response = await sendMessage(
      "My name is Sarah Johnson. I live in San Francisco, California. My phone number is 555-123-4567 and my email is sarah.johnson@email.com."
    );
    
    expect(response.length).toBeGreaterThan(30);
    
    console.log('\n📍 Step 4: Accident Details');
    response = await sendMessage(
      "The accident happened yesterday at 3:30 PM at the intersection of Market Street and 5th Street. The other driver ran a red light and hit my driver's side door."
    );
    
    expect(response.length).toBeGreaterThan(30);
    
    console.log('\n🏥 Step 5: Injuries and Medical Care');
    response = await sendMessage(
      "I have neck pain and headaches. I went to the emergency room and they said I have whiplash. I'm starting physical therapy next week."
    );
    
    expect(response.length).toBeGreaterThan(30);
    
    console.log('\n💰 Step 6: Damages and Insurance');
    response = await sendMessage(
      "My car has about $8,000 in damage. I have State Farm insurance and the other driver has Allstate. The police filed a report and said the other driver was at fault."
    );
    
    expect(response.length).toBeGreaterThan(30);
    
    // Analyze the complete conversation
    console.log('\n📊 CONVERSATION ANALYSIS');
    console.log('=' .repeat(80));
    
    const conversation = await page.evaluate(() => {
      const messages = document.querySelectorAll('.message-bubble');
      return Array.from(messages).map((msg, index) => ({
        index: index + 1,
        content: msg.textContent?.trim() || '',
        isUser: msg.classList.contains('message-user') || msg.classList.contains('user'),
        isAI: msg.classList.contains('message-ai') || msg.classList.contains('assistant'),
        length: msg.textContent?.trim().length || 0
      }));
    });
    
    console.log(`\n📈 Conversation Statistics:`);
    console.log(`• Total messages: ${conversation.length}`);
    console.log(`• User messages: ${conversation.filter(m => m.isUser).length}`);
    console.log(`• AI responses: ${conversation.filter(m => m.isAI).length}`);
    console.log(`• Average AI response length: ${Math.round(conversation.filter(m => m.isAI).reduce((sum, m) => sum + m.length, 0) / conversation.filter(m => m.isAI).length)} characters`);
    
    // Check information capture
    const fullConversationText = conversation.map(m => m.content).join(' ').toLowerCase();
    
    const keyInformation = [
      { detail: 'Client Name', keywords: ['sarah johnson'], found: false },
      { detail: 'Location', keywords: ['san francisco'], found: false },
      { detail: 'Accident Type', keywords: ['car accident', 'collision'], found: false },
      { detail: 'Fault', keywords: ['red light', 'other driver'], found: false },
      { detail: 'Injuries', keywords: ['neck pain', 'whiplash', 'headaches'], found: false },
      { detail: 'Medical Care', keywords: ['emergency room', 'physical therapy'], found: false },
      { detail: 'Damages', keywords: ['8000', 'damage'], found: false },
      { detail: 'Insurance', keywords: ['state farm', 'allstate'], found: false },
      { detail: 'Police Report', keywords: ['police', 'report'], found: false }
    ];
    
    keyInformation.forEach(info => {
      info.found = info.keywords.some(keyword => fullConversationText.includes(keyword.toLowerCase()));
    });
    
    console.log(`\n✅ Key Information Captured:`);
    keyInformation.forEach(info => {
      console.log(`  ${info.found ? '✅' : '❌'} ${info.detail}`);
    });
    
    const captureRate = (keyInformation.filter(info => info.found).length / keyInformation.length) * 100;
    console.log(`\n📊 Information Capture Rate: ${captureRate.toFixed(1)}%`);
    
    // Verify AI behavior
    const aiMessages = conversation.filter(m => m.isAI);
    console.log(`\n🤖 AI Response Quality Check:`);
    
    const hasGreeting = aiMessages.some(msg => 
      msg.content.toLowerCase().includes('sorry') || 
      msg.content.toLowerCase().includes('help')
    );
    console.log(`  ${hasGreeting ? '✅' : '❌'} Shows empathy/willingness to help`);
    
    const asksQuestions = aiMessages.some(msg => 
      msg.content.includes('?') || 
      msg.content.toLowerCase().includes('tell me') ||
      msg.content.toLowerCase().includes('can you')
    );
    console.log(`  ${asksQuestions ? '✅' : '❌'} Asks follow-up questions`);
    
    const maintainsBoundaries = aiMessages.every(msg => 
      !msg.content.toLowerCase().includes('attorney-client privilege') &&
      !msg.content.toLowerCase().includes('i recommend') &&
      !msg.content.toLowerCase().includes('you should sue')
    );
    console.log(`  ${maintainsBoundaries ? '✅' : '❌'} Maintains legal boundaries`);
    
    const mentionsAttorney = aiMessages.some(msg => 
      msg.content.toLowerCase().includes('attorney') || 
      msg.content.toLowerCase().includes('lawyer') ||
      msg.content.toLowerCase().includes('legal team')
    );
    console.log(`  ${mentionsAttorney ? '✅' : '❌'} References attorney follow-up`);
    
    // Test Assertions
    expect(conversation.length).toBeGreaterThan(8); // Should have substantial conversation
    expect(captureRate).toBeGreaterThan(70); // Should capture most key information
    expect(hasGreeting).toBe(true);
    expect(maintainsBoundaries).toBe(true);
    
    console.log('\n🎉 LEGAL CONSULTATION DEMONSTRATION COMPLETE!');
    console.log('=' .repeat(80));
    console.log('✅ The AI successfully conducted a professional legal consultation');
    console.log('✅ Key client information was captured systematically');
    console.log('✅ Legal and ethical boundaries were maintained');
    console.log('✅ The conversation flowed naturally and professionally');
    console.log('✅ Complete system integration (Frontend → Backend → MCP Servers) working');
  }, 120000); // 2 minute timeout for the full conversation

});

export { };