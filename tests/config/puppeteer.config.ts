import { PuppeteerLaunchOptions } from 'puppeteer';

export const puppeteerConfig: PuppeteerLaunchOptions = {
  headless: process.env.CI ? true : 'new', // Use new headless mode when not in CI
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--window-size=1200,800'
  ],
  defaultViewport: {
    width: 1200,
    height: 800
  },
  timeout: 30000,
  slowMo: process.env.CI ? 0 : 50, // Slow down actions when not in CI for better debugging
};

export const testConfig = {
  // Current deployment URL - update this when deploying new versions
  baseUrl: 'https://d7fdb312.engage-ui.pages.dev',
  
  // Test timeouts
  timeouts: {
    page: 30000,
    element: 10000,
    navigation: 15000,
    aiResponse: 20000, // AI responses may take longer
  },
  
  // Test data
  testMessages: {
    carAccident: 'Hello, I need legal help with a car accident',
    contractDispute: 'I have a contract dispute with my employer', 
    personalInjury: 'I was injured in a slip and fall accident',
    employment: 'I believe I was wrongfully terminated from my job',
    familyLaw: 'I need help with a divorce proceeding',
  },
  
  // Expected AI response patterns
  aiResponsePatterns: [
    'happy to assist',
    'gather information',
    'legal matter',
    'tell me your name',
    'contact information',
    'attorney',
    'evaluate your situation'
  ],
  
  // Selectors for key UI elements
  selectors: {
    disclaimerModal: '#disclaimer-modal',
    disclaimerAccept: '#disclaimer-accept',
    disclaimerDecline: '#disclaimer-decline',
    chatContainer: '.chat-container',
    messagesContainer: '#messages-container',
    messagesList: '#messages-list',
    messageInput: '#message-input',
    sendButton: '#send-button',
    messageBubbles: '.message-bubble',
    userMessage: '.message-user',
    aiMessage: '.message-ai',
    loadingIndicator: '.loading-spinner',
    typingIndicator: '#typing-indicator',
    charCount: '#char-count'
  },
  
  // Mobile viewports for responsive testing
  viewports: {
    mobile: { width: 375, height: 667 }, // iPhone SE
    tablet: { width: 768, height: 1024 }, // iPad
    desktop: { width: 1200, height: 800 },
    largeDesktop: { width: 1920, height: 1080 }
  }
};

export default { puppeteerConfig, testConfig };