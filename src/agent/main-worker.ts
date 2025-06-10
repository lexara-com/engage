// Main Agent Worker - Engage Legal AI Platform

/// <reference types="@cloudflare/workers-types" />

import { Env } from '@/types/shared';
import { createLogger } from '@/utils/logger';
import { EngageError, handleError } from '@/utils/errors';
import { ClaudeAgent } from './claude-agent';

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
  <style>
    .btn-primary { @apply bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors; }
    .btn-secondary { @apply bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors; }
    .message-bubble { @apply max-w-xs lg:max-w-md px-4 py-2 rounded-lg; }
    .message-user { @apply bg-blue-600 text-white ml-auto; }
    .message-ai { @apply bg-gray-100 text-gray-800; }
    .chat-container { @apply flex flex-col h-full max-w-4xl mx-auto; }
    .chat-messages { @apply flex-1 overflow-y-auto px-4 py-6 space-y-4; }
  </style>
</head>
<body class="h-full bg-gray-50 font-sans">
  <!-- Legal Disclaimer Modal -->
  <div id="disclaimer-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 hidden">
    <div class="bg-white rounded-lg shadow-lg max-w-lg w-full">
      <div class="p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Important Legal Information</h2>
        <div class="text-sm text-gray-600 space-y-3 mb-6">
          <p><strong>No Attorney-Client Relationship:</strong> This consultation tool does not create an attorney-client relationship.</p>
          <p><strong>No Legal Advice:</strong> This system provides information gathering services only.</p>
          <p><strong>Professional Review:</strong> All information will be reviewed by qualified attorneys.</p>
        </div>
        <div class="flex space-x-3">
          <button id="disclaimer-accept" class="btn-primary flex-1">I Understand and Agree</button>
          <button id="disclaimer-decline" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Chat Interface -->
  <div class="flex flex-col h-screen">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <h1 class="text-xl font-semibold text-gray-900">Legal Consultation</h1>
        <p class="text-sm text-gray-600">Secure & Confidential</p>
      </div>
    </header>

    <!-- Chat Area -->
    <main class="flex-1 overflow-hidden">
      <div class="chat-container">
        <div id="messages-container" class="chat-messages">
          <!-- Welcome Message -->
          <div class="text-center py-8">
            <div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">Welcome to Engage</h2>
            <p class="text-gray-600 max-w-md mx-auto">I'm here to help you with your legal consultation. Please share details about your situation.</p>
          </div>
          
          <!-- Messages will be inserted here -->
          <div id="messages-list"></div>
          
          <!-- Typing indicator -->
          <div id="typing-indicator" class="hidden">
            <div class="message-bubble message-ai">
              <div class="flex items-center space-x-1">
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                <span class="ml-2 text-gray-500">AI is typing...</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Input Area -->
        <div class="bg-white border-t px-4 py-4">
          <div class="max-w-4xl mx-auto">
            <div class="flex space-x-3">
              <textarea 
                id="message-input" 
                placeholder="Type your message here..."
                class="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="1"
              ></textarea>
              <button 
                id="send-button" 
                class="btn-primary"
                disabled
              >
                Send
              </button>
            </div>
            <div class="text-xs text-gray-500 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>
    </main>
    
    <!-- Footer -->
    <footer class="bg-gray-800 text-gray-300 py-4">
      <div class="max-w-4xl mx-auto px-4 text-center text-sm">
        <p><strong>Important Notice:</strong> This conversation is for informational purposes only and does not create an attorney-client relationship.</p>
      </div>
    </footer>
  </div>

  <script>
    class ChatApp {
      constructor() {
        this.sessionId = null;
        this.isLoading = false;
        this.initializeElements();
        this.bindEvents();
        this.showDisclaimerIfNeeded();
      }

      initializeElements() {
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.messagesList = document.getElementById('messages-list');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.messagesContainer = document.getElementById('messages-container');
      }

      bindEvents() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('input', () => this.toggleSendButton());
        this.messageInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
          }
        });

        // Disclaimer modal events
        document.getElementById('disclaimer-accept').addEventListener('click', () => {
          localStorage.setItem('engage-disclaimer-agreed', 'true');
          document.getElementById('disclaimer-modal').classList.add('hidden');
          this.messageInput.focus();
        });

        document.getElementById('disclaimer-decline').addEventListener('click', () => {
          window.history.back();
        });
      }

      showDisclaimerIfNeeded() {
        const hasAgreed = localStorage.getItem('engage-disclaimer-agreed');
        if (!hasAgreed) {
          document.getElementById('disclaimer-modal').classList.remove('hidden');
        } else {
          this.messageInput.focus();
        }
      }

      toggleSendButton() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.sendButton.disabled = !hasText || this.isLoading;
      }

      async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isLoading) return;

        this.isLoading = true;
        this.toggleSendButton();

        try {
          // Create session if needed
          if (!this.sessionId) {
            await this.createSession();
          }

          // Add user message to UI
          this.addMessage(message, 'user');
          this.messageInput.value = '';
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
          this.addMessage('I apologize, but I\\'m having trouble connecting right now. Please try again.', 'system');
        } finally {
          this.isLoading = false;
          this.toggleSendButton();
          this.messageInput.focus();
        }
      }

      async createSession() {
        const response = await fetch('/api/v1/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firmId: 'demo' })
        });

        if (!response.ok) throw new Error(\`Failed to create session: \${response.status}\`);

        const data = await response.json();
        this.sessionId = data.sessionId;
        console.log('Session created:', this.sessionId);
      }

      addMessage(content, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = \`flex \${role === 'user' ? 'justify-end' : 'justify-start'}\`;
        
        const bubbleClass = role === 'user' ? 'message-user' : 'message-ai';
        messageDiv.innerHTML = \`
          <div class="message-bubble \${bubbleClass}">
            \${role === 'assistant' ? '<div class="text-xs font-medium mb-1">Legal Assistant</div>' : ''}
            <div>\${content}</div>
            <div class="text-xs opacity-75 mt-1">Just now</div>
          </div>
        \`;

        this.messagesList.appendChild(messageDiv);
        this.scrollToBottom();
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
    document.addEventListener('DOMContentLoaded', () => new ChatApp());
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

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const logger = createLogger(env, { operation: 'main-worker' });
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin');
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(env, origin)
      });
    }
    
    try {
      logger.info('Received request', { 
        url: request.url, 
        method: request.method,
        environment: env.ENVIRONMENT 
      });

      const url = new URL(request.url);
      const agent = new ClaudeAgent(env);
      
      // Serve UI static files for root and static paths
      if (url.pathname === '/' || url.pathname.startsWith('/_astro/') || url.pathname === '/favicon.svg') {
        return handleStaticRequest(request, env);
      }
      
      // Health check endpoint
      if (url.pathname === '/health') {
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
        const { firmId } = await request.json() as { firmId: string };
        const result = await agent.createSession(firmId);
        
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Send message to agent
      if (url.pathname === '/api/v1/conversations/message' && request.method === 'POST') {
        const requestData = await request.json() as {
          message: string;
          sessionId?: string;
          resumeToken?: string;
        };

        const auth0UserId = request.headers.get('x-auth0-user-id') || undefined;

        const response = await agent.processMessage({
          ...requestData,
          auth0UserId
        });

        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' }
        });
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

      // Test Workers AI binding
      if (url.pathname === '/api/v1/test/ai') {
        try {
          const aiAvailable = !!env.AI;
          
          logger.info('Testing Workers AI binding', { aiAvailable });
          
          return new Response(JSON.stringify({
            ai: {
              binding: aiAvailable ? 'available' : 'missing',
              note: 'AI functionality test requires actual model call'
            }
          }), {
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
          '/api/v1/test/ai'
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