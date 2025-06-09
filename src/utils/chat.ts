import type { ChatMessage, ChatSession, StreamingResponse, ApiResponse } from '../types/chat';

// Generate unique IDs for messages and sessions
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Format timestamps for display
export function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  return date.toLocaleDateString();
}

// Create a new chat message
export function createMessage(
  content: string, 
  role: 'user' | 'assistant' | 'system',
  metadata?: ChatMessage['metadata']
): ChatMessage {
  return {
    id: generateId(),
    content,
    role,
    timestamp: new Date(),
    metadata
  };
}

// Create a new chat session
export function createSession(): ChatSession {
  return {
    id: generateId(),
    messages: [],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

// Add message to session
export function addMessageToSession(session: ChatSession, message: ChatMessage): ChatSession {
  return {
    ...session,
    messages: [...session.messages, message],
    updatedAt: new Date()
  };
}

// Update the last message in session (useful for streaming)
export function updateLastMessage(session: ChatSession, content: string, metadata?: ChatMessage['metadata']): ChatSession {
  const messages = [...session.messages];
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    messages[messages.length - 1] = {
      ...lastMessage,
      content,
      metadata: { ...lastMessage.metadata, ...metadata }
    };
  }
  
  return {
    ...session,
    messages,
    updatedAt: new Date()
  };
}

// API utilities
export class EngageApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = '') {
    // Use relative URLs for same-origin requests to leverage Astro's API routes
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  }
  
  async sendMessage(sessionId: string, message: string): Promise<ReadableStream<Uint8Array> | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message,
          stream: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.body;
    } catch (error) {
      console.error('Failed to send message:', error);
      return null;
    }
  }
  
  async createSession(): Promise<ApiResponse<{ sessionId: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firmId: 'firm_test_123' // Default firm ID for demo
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to create session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async getSession(sessionId: string): Promise<ApiResponse<ChatSession>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/session/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Stream processing utilities
export async function processStream(
  stream: ReadableStream<Uint8Array>,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        onComplete();
        break;
      }
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)) as StreamingResponse;
            
            if (data.type === 'chunk' && data.content) {
              onChunk(data.content);
            } else if (data.type === 'error') {
              onError(new Error(data.error || 'Stream error'));
              return;
            } else if (data.type === 'complete') {
              onComplete();
              return;
            }
          } catch (parseError) {
            // Ignore JSON parse errors for partial chunks
          }
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Stream processing error'));
  } finally {
    reader.releaseLock();
  }
}

// Local storage utilities for session persistence
export const SessionStorage = {
  save(session: ChatSession): void {
    try {
      localStorage.setItem(`engage-session-${session.id}`, JSON.stringify(session));
    } catch (error) {
      console.warn('Failed to save session to localStorage:', error);
    }
  },
  
  load(sessionId: string): ChatSession | null {
    try {
      const data = localStorage.getItem(`engage-session-${sessionId}`);
      if (data) {
        const session = JSON.parse(data);
        // Convert timestamp strings back to Date objects
        session.createdAt = new Date(session.createdAt);
        session.updatedAt = new Date(session.updatedAt);
        session.messages = session.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        return session;
      }
    } catch (error) {
      console.warn('Failed to load session from localStorage:', error);
    }
    return null;
  },
  
  remove(sessionId: string): void {
    try {
      localStorage.removeItem(`engage-session-${sessionId}`);
    } catch (error) {
      console.warn('Failed to remove session from localStorage:', error);
    }
  }
};