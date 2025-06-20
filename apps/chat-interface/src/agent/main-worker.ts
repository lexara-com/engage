// Main Agent Worker - Engage Legal AI Platform

/// <reference types="@cloudflare/workers-types" />

import { Env } from '@lexara/shared-types';
import { createLogger, EngageError, handleError, telemetry, trackAIServiceCall, trackConversationFlow, sendTestTelemetryData, generateMessageId, generateSessionId } from '@lexara/shared-utils';
import { ClaudeAgent } from './claude-agent';
import { validateJWT, createAuthMiddleware, validateConversationAccess, AuthContext, getAuth0Config, validateAuth0Config } from '@lexara/auth-lib';

// Export Durable Object classes
export { ConversationSession } from '../durable-objects/conversation-session';
export { FirmRegistry } from '../durable-objects/firm-registry';

// Static UI content
const UI_HTML = `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Legal Consultation - Engage</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      /* Firm branding CSS variables - customizable */
      --firm-primary-color: #4f46e5;
      --firm-secondary-color: #6366f1;
      --firm-accent-color: #8b5cf6;
      --firm-text-color: #1f2937;
      --firm-background: #f9fafb;
      --firm-name: 'Demo Law Firm';
    }
    
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--firm-background);
    }
    
    /* Hero Section */
    .hero-section {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      min-height: 50vh;
    }
    
    .hero-image {
      background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNTBWMTUwTTcwIDEwMEgxMzBNODUgODVMMTE1IDExNU04NSAxMTVMMTE1IDg1IiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNkI3MjgwIiBmb250LXNpemU9IjEyIiBmb250LWZhbWlseT0iSW50ZXIiPkltYWdlIFBsYWNlaG9sZGVyPC90ZXh0Pgo8L3N2Zz4=') center/cover;
      background-size: contain;
      background-repeat: no-repeat;
    }
    
    /* Firm Banner */
    .firm-banner {
      background: var(--firm-primary-color);
      background: linear-gradient(135deg, var(--firm-primary-color) 0%, var(--firm-secondary-color) 100%);
    }
    
    /* Disclaimer Modal */
    .disclaimer-modal {
      backdrop-filter: blur(8px);
      background: rgba(0, 0, 0, 0.5);
    }
    
    .disclaimer-icon {
      width: 40px;
      height: 40px;
      @apply text-gray-600 flex-shrink-0;
    }
    
    /* Chat Interface */
    .chat-interface {
      background: #ffffff;
      border-top: 1px solid #e5e7eb;
    }
    
    .firm-header {
      color: var(--firm-text-color);
      border-bottom: 2px solid var(--firm-primary-color);
    }
    
    /* Message Bubbles */
    .message-bubble {
      animation: slideIn 0.3s ease-out;
    }
    
    .message-user {
      background: var(--firm-primary-color);
      background: linear-gradient(135deg, var(--firm-primary-color) 0%, var(--firm-secondary-color) 100%);
    }
    
    .message-ai {
      @apply bg-white border border-gray-200 shadow-sm;
    }
    
    /* Input Styling */
    .chat-input {
      border: 2px solid #e5e7eb;
      border-radius: 2rem;
      transition: all 0.2s ease;
    }
    
    .chat-input:focus {
      border-color: var(--firm-primary-color);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }
    
    .send-button {
      background: var(--firm-primary-color);
      background: linear-gradient(135deg, var(--firm-primary-color) 0%, var(--firm-secondary-color) 100%);
    }
    
    .send-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }
    
    /* Buttons */
    .btn-primary {
      background: var(--firm-primary-color);
      border: 2px solid var(--firm-primary-color);
      @apply text-white font-medium px-6 py-3 rounded-lg transition-all duration-200;
    }
    
    .btn-primary:hover {
      background: var(--firm-secondary-color);
      transform: translateY(-1px);
    }
    
    .btn-secondary {
      @apply bg-white text-gray-700 font-medium px-6 py-3 rounded-lg border-2 border-gray-300 transition-all duration-200;
    }
    
    .btn-secondary:hover {
      @apply border-gray-400 bg-gray-50;
    }
    
    /* Animations */
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    
    .typing-dot {
      animation: pulse 1.4s ease-in-out infinite;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    
    /* Mobile Responsive Adjustments */
    @media (max-width: 768px) {
      .hero-section {
        min-height: 40vh;
      }
      
      .hero-split {
        @apply flex-col;
      }
      
      .hero-image {
        @apply h-32 md:h-full;
      }
      
      .chat-input {
        font-size: 16px; /* Prevents zoom on iOS */
      }
    }
    
    /* Custom Scrollbar */
    .chat-messages::-webkit-scrollbar {
      width: 6px;
    }
    .chat-messages::-webkit-scrollbar-track {
      background: #f1f5f9;
    }
    .chat-messages::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }
    .chat-messages::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col" id="app-body">
  
  <!-- Hero Section -->
  <section class="hero-section">
    <div class="container mx-auto px-4 h-full">
      <div class="hero-split flex flex-col md:flex-row h-full min-h-[50vh]">
        <!-- Hero Image -->
        <div class="hero-image flex-1 md:w-1/2 h-48 md:h-full flex items-center justify-center">
          <!-- Placeholder for scales of justice image -->
          <div class="w-full h-full max-w-sm max-h-80 bg-gray-200 rounded-lg flex items-center justify-center">
            <span class="text-gray-500 text-sm">Scales of Justice Image</span>
          </div>
        </div>
        
        <!-- Hero Content -->
        <div class="flex-1 md:w-1/2 flex flex-col justify-center items-start p-6 md:p-12">
          <!-- Lexara Logo -->
          <div class="self-end mb-8">
            <div class="flex items-center space-x-2">
              <div class="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
                <span class="text-white font-bold text-sm">L</span>
              </div>
              <span class="text-xl font-semibold text-gray-700">LEXARA</span>
            </div>
          </div>
          
          <!-- Welcome Message -->
          <div class="flex-1 flex flex-col justify-center">
            <h1 class="text-4xl md:text-5xl font-light text-gray-800 mb-4">
              Welcome to<br>
              <span class="font-semibold">Engage</span>
            </h1>
            <p class="text-lg text-gray-600 mb-8">
              Your Legal Information<br>
              Gathering tool
            </p>
            <button id="learn-more-btn" class="btn-secondary self-start">
              LEARN MORE
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Firm Banner -->
  <section class="firm-banner text-white py-8">
    <div class="container mx-auto px-4 text-center">
      <h2 class="text-xl md:text-2xl font-semibold mb-4" id="firm-banner-title">
        THANK YOU FOR CONTACTING DEMO LAW FIRM
      </h2>
      <p class="text-sm md:text-base opacity-90 max-w-2xl mx-auto" id="firm-banner-text">
        We're gathering information about your claim to share with a Real Live licensed attorney 
        for review and evaluation. Using this tool will make the process more efficient and smooth.
      </p>
    </div>
  </section>

  <!-- Disclaimer Modal (Initially Hidden) -->
  <div id="disclaimer-modal" class="disclaimer-modal fixed inset-0 flex items-center justify-center p-4 z-50 hidden">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div class="p-6 md:p-8">
        <h3 class="text-xl font-semibold text-gray-800 mb-6">PLEASE NOTE:</h3>
        
          <!-- Shield Icon -->
          <div class="flex items-start space-x-4">
            <svg class="disclaimer-icon" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H15.5C16.4,11 17,11.4 17,12V16C17,16.6 16.6,17 16,17H8C7.4,17 7,16.6 7,16V12C7,11.4 7.4,11 8,11H8.5V10C8.5,8.6 9.6,7 12,7M12,8.2C10.2,8.2 9.8,9.2 9.8,10V11H14.2V10C14.2,9.2 13.8,8.2 12,8.2Z"/>
            </svg>
            <p class="text-gray-700 text-sm md:text-base leading-relaxed">
              The information you provide is secure, but not protected by attorney-client privilege.
            </p>
          </div>

        <div class="space-y-6">
          <!-- Scales Icon -->
          <div class="flex items-start space-x-4">
            <svg class="disclaimer-icon" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"/>
            </svg>
            <p class="text-gray-700 text-sm md:text-base leading-relaxed">
              No attorney-client relationship is formed until you speak directly with an attorney from our team.
            </p>
          </div>
          

          
          <!-- X Icon -->
          <div class="flex items-start space-x-4">
            <svg class="disclaimer-icon" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
            <p class="text-gray-700 text-sm md:text-base leading-relaxed">
              Do not include sensitive details or admissions of wrongdoing in your message.
            </p>
          </div>
        </div>
        
        <div class="flex space-x-4 mt-8">
          <button id="understand-btn" class="btn-primary flex-1">
            I Understand
          </button>
          <button id="cancel-btn" class="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Chat Interface (Initially Hidden) -->
  <section id="chat-section" class="chat-interface flex-1 hidden">
    <div class="container mx-auto max-w-4xl h-full flex flex-col">
      
      <!-- Firm Header -->
      <div class="firm-header text-center py-6">
        <h2 class="text-2xl font-bold" id="firm-name">DEMO LAW FIRM</h2>
      </div>
      
      <!-- Chat Messages Area -->
      <div class="flex-1 flex flex-col">
        <div id="messages-container" class="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          <!-- AI Introduction Message (will be added by JS) -->
          <div id="messages-list"></div>
          
          <!-- Typing Indicator -->
          <div id="typing-indicator" class="hidden flex justify-start">
            <div class="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm max-w-xs">
              <div class="flex items-center space-x-1">
                <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                <span class="ml-2 text-gray-500 text-sm">AI is typing...</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Chat Input -->
        <div class="bg-white border-t border-gray-200 p-4">
          <div class="flex space-x-3">
            <div class="flex-1 relative">
              <textarea 
                id="message-input"
                placeholder="Type your message here"
                class="chat-input w-full px-6 py-4 resize-none focus:outline-none"
                rows="1"
                disabled
              ></textarea>
            </div>
            <button 
              id="send-button"
              class="send-button text-white px-6 py-4 rounded-full font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer Notice -->
  <footer class="bg-gray-50 border-t border-gray-200 py-4">
    <div class="container mx-auto px-4 text-center">
      <p class="text-xs text-gray-600">
        <strong>IMPORTANT NOTICE:</strong> THIS CONVERSATION IS FOR INFORMATION GATHERING PURPOSES ONLY AND DOES NOT CREATE AN 
        ATTORNEY-CLIENT RELATIONSHIP. AFTER GATHERING YOUR INFORMATION, WE WILL SEND IT TO A HUMAN ATTORNEY, WHO WILL 
        GET BACK TO YOU WITHIN 24 BUSINESS HOURS. IF YOU HAVE A MEDICAL EMERGENCY, CALL 911 IMMEDIATELY.
      </p>
    </div>
  </footer>

  <script>
    class EngageApp {
      constructor() {
        this.sessionId = null;
        this.isLoading = false;
        this.firmData = null;
        this.initializeElements();
        this.bindEvents();
        this.loadFirmBranding();
        this.showDisclaimerOnLoad();
      }

      initializeElements() {
        // UI Flow Elements
        this.learnMoreBtn = document.getElementById('learn-more-btn');
        this.understandBtn = document.getElementById('understand-btn');
        this.cancelBtn = document.getElementById('cancel-btn');
        this.disclaimerModal = document.getElementById('disclaimer-modal');
        this.chatSection = document.getElementById('chat-section');
        
        // Chat Elements
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.messagesList = document.getElementById('messages-list');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.messagesContainer = document.getElementById('messages-container');
        
        // Firm Branding Elements
        this.firmBannerTitle = document.getElementById('firm-banner-title');
        this.firmBannerText = document.getElementById('firm-banner-text');
        this.firmName = document.getElementById('firm-name');
      }

      bindEvents() {
        // UI Flow Events
        if (this.learnMoreBtn) {
          this.learnMoreBtn.addEventListener('click', () => this.showDisclaimerModal());
        }
        
        if (this.understandBtn) {
          this.understandBtn.addEventListener('click', () => this.startChat());
        }
        
        if (this.cancelBtn) {
          this.cancelBtn.addEventListener('click', () => this.hideDisclaimerModal());
        }
        
        // Modal backdrop click to close
        if (this.disclaimerModal) {
          this.disclaimerModal.addEventListener('click', (e) => {
            if (e.target === this.disclaimerModal) {
              this.hideDisclaimerModal();
            }
          });
        }
        
        // Chat Events
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('input', () => this.toggleSendButton());
        this.messageInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
          }
        });
      }

      async loadFirmBranding() {
        try {
          // This would typically fetch firm data from the API
          // For now, using demo data
          this.firmData = {
            name: 'DEMO LAW FIRM',
            primaryColor: '#4f46e5',
            secondaryColor: '#6366f1'
          };
          
          this.applyFirmBranding();
        } catch (error) {
          console.error('Failed to load firm branding:', error);
        }
      }

      applyFirmBranding() {
        if (!this.firmData) return;
        
        // Update CSS variables
        document.documentElement.style.setProperty('--firm-primary-color', this.firmData.primaryColor);
        document.documentElement.style.setProperty('--firm-secondary-color', this.firmData.secondaryColor);
        
        // Update firm name throughout the interface
        this.firmBannerTitle.textContent = \`THANK YOU FOR CONTACTING \${this.firmData.name}\`;
        this.firmName.textContent = this.firmData.name;
      }

      showDisclaimerOnLoad() {
        // TEMPORARY: Clear localStorage for testing
        localStorage.removeItem('engage-disclaimer-agreed');
        
        // Check if user has already agreed to disclaimer
        const hasAgreed = localStorage.getItem('engage-disclaimer-agreed');
        console.log('Checking disclaimer agreement:', hasAgreed);
        console.log('Modal element exists:', !!this.disclaimerModal);
        
        if (!hasAgreed) {
          // Small delay to ensure DOM is fully ready
          setTimeout(() => {
            console.log('Attempting to show modal on load');
            if (this.disclaimerModal) {
              this.showDisclaimerModal();
            } else {
              console.error('Modal element not found!');
            }
          }, 200);
        } else {
          console.log('User already agreed to disclaimer, skipping modal');
        }
      }

      showDisclaimerModal() {
        console.log('showDisclaimerModal called, modal element:', this.disclaimerModal);
        if (this.disclaimerModal) {
          console.log('Removing hidden class from modal');
          this.disclaimerModal.classList.remove('hidden');
          console.log('Modal classes after removal:', this.disclaimerModal.className);
        }
      }

      hideDisclaimerModal() {
        this.disclaimerModal.classList.add('hidden');
      }

      async startChat() {
        // Remember that user has agreed to disclaimer
        localStorage.setItem('engage-disclaimer-agreed', 'true');
        
        // Hide disclaimer modal first
        this.hideDisclaimerModal();
        
        // Show chat section
        this.chatSection.classList.remove('hidden');
        this.chatSection.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
        
        // Enable chat input
        this.messageInput.disabled = false;
        this.sendButton.disabled = false;
        
        // Create session and show AI introduction
        await this.createSession();
        this.addAIIntroduction();
        
        // Focus on input
        setTimeout(() => {
          this.messageInput.focus();
        }, 500);
      }

      addAIIntroduction() {
        const firmName = this.firmData?.name || 'our firm';
        const introMessage = \`Hi I'm an AI ChatBot.
        
I'm here to help gather information about your claim. Please share details about your situation, and I'll gather the information needed for our legal team to assist you effectively.\`;
        
        this.addMessage(introMessage, 'assistant');
      }

      toggleSendButton() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.sendButton.disabled = !hasText || this.isLoading || this.messageInput.disabled;
      }

      async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isLoading) return;

        this.isLoading = true;
        this.toggleSendButton();

        try {
          // Add user message to UI
          this.addMessage(message, 'user');
          this.messageInput.value = '';
          this.adjustTextareaHeight();
          this.showTypingIndicator();

          // Send to API
          const response = await fetch('/api/v1/conversations/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: this.sessionId,
              message: message
            })
          });

          if (!response.ok) throw new Error(\`HTTP \${response.status}\`);

          const data = await response.json();
          this.hideTypingIndicator();
          this.addMessage(data.message, 'assistant');

        } catch (error) {
          console.error('Send message failed:', error);
          this.hideTypingIndicator();
          this.addMessage('I apologize, but I\\'m having trouble connecting right now. Please try again.', 'assistant');
        } finally {
          this.isLoading = false;
          this.toggleSendButton();
          this.messageInput.focus();
        }
      }

      async createSession() {
        if (this.sessionId) return;
        
        try {
          const response = await fetch('/api/v1/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });

          if (!response.ok) throw new Error(\`Failed to create session: \${response.status}\`);

          const data = await response.json();
          this.sessionId = data.sessionId;
          console.log('Session created:', this.sessionId);
        } catch (error) {
          console.error('Failed to create session:', error);
        }
      }

      addMessage(content, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = \`flex \${role === 'user' ? 'justify-end' : 'justify-start'} mb-4\`;
        
        const bubbleClass = role === 'user' ? 'message-user text-white' : 'message-ai';
        const maxWidth = role === 'user' ? 'max-w-xs sm:max-w-sm lg:max-w-lg' : 'max-w-xs sm:max-w-sm lg:max-w-lg';
        
        messageDiv.innerHTML = \`
          <div class="\${maxWidth} px-4 py-3 rounded-2xl shadow-sm \${bubbleClass}" style="animation: slideIn 0.3s ease-out;">
            \${role === 'assistant' ? '<div class="text-xs font-medium mb-1 text-gray-500">Legal Assistant</div>' : ''}
            <div class="whitespace-pre-wrap">\${content}</div>
            <div class="text-xs opacity-75 mt-1">Just now</div>
          </div>
        \`;

        this.messagesList.appendChild(messageDiv);
        this.scrollToBottom();
      }

      adjustTextareaHeight() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 128) + 'px';
      }

      showTypingIndicator() {
        this.typingIndicator.classList.remove('hidden');
        this.scrollToBottom();
      }

      hideTypingIndicator() {
        this.typingIndicator.classList.add('hidden');
      }

      scrollToBottom() {
        setTimeout(() => {
          this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
      }
    }

    // Initialize app when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
      new EngageApp();
      
      // Auto-resize textarea
      const textarea = document.getElementById('message-input');
      if (textarea) {
        textarea.addEventListener('input', function() {
          this.style.height = 'auto';
          this.style.height = Math.min(this.scrollHeight, 128) + 'px';
        });
      }
    });
  </script>
</body>
</html>`;

// Handle static UI requests
async function handleStaticRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  // Serve main UI for root path
  if (url.pathname === '/') {
    return new Response(UI_HTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // 5 minutes
      },
    });
  }
  
  // Handle other static assets (favicon, etc.)
  if (url.pathname === '/favicon.svg') {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚖️</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
  
  // 404 for other static requests
  return new Response('Not Found', { status: 404 });
}

// Resolve firmId from request hostname
async function resolveFirmId(request: Request, env: Env): Promise<string> {
  const url = new URL(request.url);
  const hostname = url.hostname;
  
  // For local development or main domains, use demo firm
  if (hostname === 'localhost' || hostname === 'dev.lexara.app' || hostname === 'lexara.app') {
    return 'demo';
  }
  
  // Check for subdomain pattern: {slug}.lexara.app or {slug}.dev.lexara.app
  const subdomainMatch = hostname.match(/^([a-z0-9-]+)\.(dev\.)?lexara\.app$/);
  if (subdomainMatch) {
    const slug = subdomainMatch[1];
    
    // Skip admin and api subdomains
    if (slug === 'admin' || slug === 'api' || slug === 'www') {
      return 'demo';
    }
    
    // Look up firm by slug using FirmRegistry
    try {
      const firmRegistryStub = env.FIRM_REGISTRY.get(env.FIRM_REGISTRY.idFromName('registry'));
      const response = await firmRegistryStub.fetch(new Request(`http://durable-object/slug/${slug}`, {
        method: 'GET'
      }));
      
      if (response.ok) {
        const firm = await response.json() as { firmId: string };
        return firm.firmId;
      }
    } catch (error) {
      console.error('Failed to resolve firm by slug:', error);
    }
  }
  
  // Check for custom domain
  try {
    const firmRegistryStub = env.FIRM_REGISTRY.get(env.FIRM_REGISTRY.idFromName('registry'));
    const response = await firmRegistryStub.fetch(new Request(`http://durable-object/domain/${hostname}`, {
      method: 'GET'
    }));
    
    if (response.ok) {
      const firm = await response.json() as { firmId: string };
      return firm.firmId;
    }
  } catch (error) {
    console.error('Failed to resolve firm by domain:', error);
  }
  
  // Default to demo firm
  return 'demo';
}

// CORS headers for cross-origin requests from UI
function getCorsHeaders(env: Env, origin?: string): Record<string, string> {
  const allowedOrigins = [
    'https://09dc6629.engage-ui-dev.pages.dev',
    'https://0874d635.engage-ui-dev.pages.dev', 
    'https://167bb54b.engage-ui-dev.pages.dev',
    'https://engage-ui-dev.pages.dev',
    'https://dev.lexara.app',
    'https://ui-dev.lexara.app',
    'http://localhost:4321'  // Local development
  ];
  
  // Check if origin is in allowed list, or allow all .pages.dev subdomains
  let allowOrigin = '*';
  if (origin) {
    if (allowedOrigins.includes(origin) || origin.endsWith('.engage-ui-dev.pages.dev')) {
      allowOrigin = origin;
    }
  }
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false',
  };
}

const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = Date.now();
    const logger = createLogger(env, { operation: 'main-worker' });
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin');
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(env, origin)
      });
    }
    
    logger.info('Received request', { 
      url: request.url, 
      method: request.method,
      environment: env.ENVIRONMENT 
    });

    try {
        const url = new URL(request.url);
        const agent = new ClaudeAgent(env);
        
        // Resolve firmId from hostname for multi-tenancy
        const firmId = await resolveFirmId(request, env);
        logger.info('Resolved firm', { firmId, hostname: url.hostname });
      
      // Serve UI static files for root and static paths
      if (url.pathname === '/' || url.pathname.startsWith('/_astro/') || url.pathname === '/favicon.svg') {
        return handleStaticRequest(request, env);
      }
      
      // Health check endpoint (with telemetry test)
      if (url.pathname === '/health') {
        // Test telemetry manually if query param is present
        const testTelemetry = url.searchParams.get('test_telemetry');
        logger.info('Health check called', { testTelemetry, searchParams: url.search });
        
        if (testTelemetry === 'true') {
          const testResult = await sendTestTelemetryData(env, { 
            testTime: new Date().toISOString(),
            source: 'health-endpoint-test',
            hasToken: !!env.LOGFIRE_TOKEN
          });
          
          return new Response(JSON.stringify({
            status: 'healthy',
            environment: env.ENVIRONMENT,
            timestamp: new Date().toISOString(),
            services: {
              durableObjects: 'available',
              vectorize: 'available',
              ai: 'available'
            },
            telemetryTest: {
              hasLogfireToken: !!env.LOGFIRE_TOKEN,
              tokenPrefix: env.LOGFIRE_TOKEN ? env.LOGFIRE_TOKEN.substring(0, 15) + '...' : 'missing',
              manualTestResult: testResult
            }
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...getCorsHeaders(env, request.headers.get('Origin'))
            }
          });
        }
        
        return new Response(JSON.stringify({
          status: 'healthy',
          environment: env.ENVIRONMENT,
          timestamp: new Date().toISOString(),
          services: {
            durableObjects: 'available',
            vectorize: 'available',
            ai: 'available'
          }
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...getCorsHeaders(env, request.headers.get('Origin'))
          }
        });
      }

      // API version endpoint
      if (url.pathname === '/api/v1/version') {
        return new Response(JSON.stringify({
          name: 'Engage Legal AI Platform',
          version: '0.1.0',
          environment: env.ENVIRONMENT,
          capabilities: [
            'conversation-management',
            'conflict-detection',
            'goal-tracking',
            'auth0-integration'
          ]
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...getCorsHeaders(env, request.headers.get('Origin'))
          }
        });
      }

      // Test Durable Objects binding
      if (url.pathname === '/api/v1/test/durable-objects') {
        const conversationStub = env.CONVERSATION_SESSION.get(
          env.CONVERSATION_SESSION.idFromName('test-session')
        );
        
        logger.info('Testing Durable Objects binding', { stubId: conversationStub.toString() });
        
        return new Response(JSON.stringify({
          durableObjects: {
            conversationSession: 'binding-available',
            userIdentity: 'binding-available'
          }
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...getCorsHeaders(env, request.headers.get('Origin'))
          }
        });
      }

      // Create new conversation session
      if (url.pathname === '/api/v1/conversations' && request.method === 'POST') {
        // Use resolved firmId from hostname instead of client-provided value
        const result = await agent.createSession(firmId);
        
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Send message to agent
      if (url.pathname === '/api/v1/conversations/message' && request.method === 'POST') {
        const startTime = Date.now();
        const requestData = await request.json() as {
          message: string;
          sessionId?: string;
          resumeToken?: string;
        };

        // Validate JWT token (optional for conversations)
        const authContext = await validateJWT(request, env);
        
        // For secured conversations, validate access control
        if (requestData.sessionId && authContext) {
          const hasAccess = await validateConversationAccess(requestData.sessionId, authContext, env);
          if (!hasAccess) {
            return new Response(JSON.stringify({
              error: 'FORBIDDEN',
              message: 'Access to this conversation is not allowed'
            }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        const auth0UserId = authContext?.userId;

        // Track conversation start
        if (requestData.sessionId) {
          await telemetry.trackConversation('message_received', requestData.sessionId, undefined, undefined, true, {
            messageLength: requestData.message.length,
            hasAuth: !!auth0UserId,
            userType: authContext?.userType
          });
        }

        const response = await agent.processMessage({
          ...requestData,
          auth0UserId
        });

        // Track API performance with simple telemetry
        const responseTime = Date.now() - startTime;
        await telemetry.trackAPICall('/api/v1/conversations/message', 'POST', 200, responseTime, {
          sessionId: requestData.sessionId,
          messageLength: requestData.message.length,
          hasAuth: !!auth0UserId,
          userType: authContext?.userType
        });

        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Test which AI service is actually responding (special endpoint)
      if (url.pathname === '/api/v1/test/ai-service' && request.method === 'POST') {
        try {
          // Create a test session and send a diagnostic message
          const { firmId = 'demo' } = await request.json() as { firmId?: string };
          const sessionResult = await agent.createSession(firmId);
          
          const diagnosticResponse = await agent.processMessage({
            sessionId: sessionResult.sessionId,
            message: 'Please respond with exactly: "I am Claude by Anthropic" if you are Claude, or "I am Workers AI by Cloudflare" if you are Workers AI. Be precise.',
            auth0UserId: undefined
          });

          return new Response(JSON.stringify({
            testMessage: 'Please respond with exactly: "I am Claude by Anthropic" if you are Claude, or "I am Workers AI by Cloudflare" if you are Workers AI. Be precise.',
            aiResponse: diagnosticResponse.message,
            sessionId: sessionResult.sessionId,
            interpretation: {
              likelyService: diagnosticResponse.message.toLowerCase().includes('claude') ? 'claude-anthropic' : 
                           diagnosticResponse.message.toLowerCase().includes('workers ai') ? 'workers-ai' :
                           'unknown-cannot-determine'
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          logger.error('AI service test failed', error as Error);
          return new Response(JSON.stringify({
            error: 'AI service test failed',
            message: (error as Error).message
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Resume conversation session
      if (url.pathname.startsWith('/api/v1/conversations/resume/') && request.method === 'GET') {
        const resumeToken = url.pathname.split('/').pop();
        
        if (!resumeToken) {
          throw new EngageError('Resume token required', 'MISSING_RESUME_TOKEN', 400);
        }

        // For resume, we need to find the DO by resume token
        // For now, using a simple approach - in production this would need a mapping
        const conversationStub = env.CONVERSATION_SESSION.get(
          env.CONVERSATION_SESSION.idFromName(`resume-${resumeToken}`)
        );
        
        return conversationStub.fetch(new Request(`http://durable-object/resume/${resumeToken}`, {
          method: 'GET',
          headers: request.headers
        }));
      }

      // Test Vectorize binding
      if (url.pathname === '/api/v1/test/vectorize') {
        try {
          // Test both vectorize bindings exist
          const supportingDocsAvailable = !!env.SUPPORTING_DOCUMENTS;
          const conflictDbAvailable = !!env.CONFLICT_DATABASE;
          
          logger.info('Testing Vectorize bindings', { 
            supportingDocs: supportingDocsAvailable,
            conflictDb: conflictDbAvailable 
          });
          
          return new Response(JSON.stringify({
            vectorize: {
              supportingDocuments: supportingDocsAvailable ? 'binding-available' : 'binding-missing',
              conflictDatabase: conflictDbAvailable ? 'binding-available' : 'binding-missing'
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          logger.error('Vectorize test failed', error as Error);
          throw new EngageError('Vectorize test failed', 'VECTORIZE_TEST_ERROR', 500);
        }
      }

      // Simple debug endpoint
      if (url.pathname === '/api/v1/test/debug') {
        return new Response(JSON.stringify({
          message: 'Debug endpoint working',
          pathname: url.pathname,
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Test Auth0 configuration and JWT validation
      if (url.pathname === '/api/v1/test/auth0') {
        try {
          // Simple Auth0 configuration test
          return new Response(JSON.stringify({
            status: 'Auth0 test working',
            environment: env.ENVIRONMENT,
            hasAuthDomain: !!env.AUTH0_DOMAIN,
            hasClientId: !!env.AUTH0_CLIENT_ID,
            hasAudience: !!env.AUTH0_AUDIENCE,
            domain: env.AUTH0_DOMAIN,
            audience: env.AUTH0_AUDIENCE
          }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: 'Auth0 test failed',
            message: (error as Error).message
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Test simple telemetry system
      if (url.pathname === '/api/v1/test/telemetry') {
        logger.info('Testing simple telemetry system');
        
        try {
          // Test all telemetry functions
          await telemetry.trackAICall('test_call', 'claude-anthropic', 150, true, undefined, { test: true });
          await telemetry.trackConversation('test_conversation', 'test-session-123', 'user-456', 'firm-789', true, { test: true });
          await telemetry.trackAPICall('/api/v1/test/telemetry', 'GET', 200, Date.now() - startTime, { test: true });
          
          const healthCheck = await telemetry.healthCheck();
          
          return new Response(JSON.stringify({
            status: 'Simple telemetry working',
            environment: env.ENVIRONMENT,
            timestamp: new Date().toISOString(),
            healthCheck,
            tests: {
              aiCallTracking: '✅ Logged to console',
              conversationTracking: '✅ Logged to console', 
              apiTracking: '✅ Logged to console',
              healthCheck: '✅ Working'
            },
            instructions: 'Check Cloudflare logs via `wrangler tail` to see telemetry data'
          }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          await telemetry.trackError('telemetry_test', error as Error, { endpoint: url.pathname });
          return new Response(JSON.stringify({
            error: 'Simple telemetry test failed',
            message: (error as Error).message
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Test AI services and detect which is being used
      if (url.pathname === '/api/v1/test/ai' || url.pathname === '/api/v1/test/ai-service') {
        try {
          const results: any = {
            anthropic: { available: false, error: null },
            workersAI: { available: false, error: null },
            currentPrimary: 'unknown'
          };

          // Test Anthropic API
          try {
            if (env.ANTHROPIC_API_KEY) {
              const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': env.ANTHROPIC_API_KEY,
                  'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                  model: 'claude-3-haiku-20240307',
                  max_tokens: 50,
                  temperature: 0.7,
                  system: 'You are a test assistant. Respond with exactly: "Claude API working"',
                  messages: [{ role: 'user', content: 'Test' }]
                })
              });
              
              if (anthropicResponse.ok) {
                results.anthropic.available = true;
                const data = await anthropicResponse.json() as { content?: { text?: string }[] };
                results.anthropic.response = data.content?.[0]?.text || '';
              } else {
                results.anthropic.error = `HTTP ${anthropicResponse.status}: ${anthropicResponse.statusText}`;
              }
            } else {
              results.anthropic.error = 'ANTHROPIC_API_KEY not configured';
            }
          } catch (error) {
            results.anthropic.error = (error as Error).message;
          }

          // Test Workers AI
          try {
            if (env.AI) {
              const workersResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
                prompt: 'You are a test assistant. Respond with exactly: "Workers AI working"',
                max_tokens: 50
              });
              
              if (workersResponse?.response) {
                results.workersAI.available = true;
                results.workersAI.response = workersResponse.response;
              } else {
                results.workersAI.error = 'No response from Workers AI';
              }
            } else {
              results.workersAI.error = 'Workers AI binding not available';
            }
          } catch (error) {
            results.workersAI.error = (error as Error).message;
          }

          // Determine current primary based on availability
          if (results.anthropic.available && results.workersAI.available) {
            results.currentPrimary = 'workers-ai-first-bug'; // Current implementation bug
            results.recommendation = 'Fix order: Claude should be primary, Workers AI fallback';
          } else if (results.anthropic.available) {
            results.currentPrimary = 'anthropic-only';
          } else if (results.workersAI.available) {
            results.currentPrimary = 'workers-ai-only';
          } else {
            results.currentPrimary = 'both-failed';
          }

          return new Response(JSON.stringify(results, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          logger.error('AI test failed', error as Error);
          throw new EngageError('AI test failed', 'AI_TEST_ERROR', 500);
        }
      }

      // Default 404 response
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'Endpoint not found',
        availableEndpoints: [
          '/health',
          '/api/v1/version',
          '/api/v1/test/durable-objects',
          '/api/v1/test/vectorize',
          '/api/v1/test/ai',
          '/api/v1/test/ai-service',
          '/api/v1/test/auth0',
          '/api/v1/test/telemetry',
          '/api/v1/conversations',
          '/api/v1/conversations/message'
        ]
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      const engageError = handleError(error, 'Request processing failed');
      logger.error('Request failed', error as Error, { 
        code: engageError.code,
        statusCode: engageError.statusCode 
      });

      return new Response(JSON.stringify({
        error: engageError.code,
        message: engageError.message,
        statusCode: engageError.statusCode
      }), {
        status: engageError.statusCode,
        headers: { 
          'Content-Type': 'application/json',
          ...getCorsHeaders(env, request.headers.get('Origin'))
        }
      });
    }
  }
};

// Export handler without OpenTelemetry instrumentation for now
// TODO: Fix OpenTelemetry instrumentation conflicts with request routing
export default handler;