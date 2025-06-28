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
  
  constructor(baseUrl?: string) {
    // Use the environment-specific API base URL
    this.baseUrl = baseUrl || 
      (typeof window !== 'undefined' && (window as any).__ENV_API_BASE_URL__) ||
      import.meta.env.PUBLIC_API_BASE_URL ||
      'https://dev.lexara.app';
  }
  
  async sendMessage(sessionId: string, message: string): Promise<any> {
    console.log('sendMessage called:', { sessionId, message, baseUrl: this.baseUrl });
    
    try {
      const url = `${this.baseUrl}/api/v1/conversations/message`;
      console.log('Making request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message
        })
      });
      
      console.log('Response received:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        console.error('API Error:', errorData);
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('API Response:', result);
      return result;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }
  
  async createSession(): Promise<ApiResponse<{ sessionId: string }>> {
    console.log('createSession called with baseUrl:', this.baseUrl);
    
    try {
      const url = `${this.baseUrl}/api/v1/conversations`;
      console.log('Creating session at:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firmId: 'demo' // Default firm ID for demo
        })
      });
      
      console.log('Session creation response:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Session creation failed:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Session created successfully:', data);
      
      return {
        success: true,
        sessionId: data.sessionId,
        data: { sessionId: data.sessionId }
      };
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
      // For now, we don't have a get session endpoint, so return failure
      // This will trigger the client to create a new session
      return {
        success: false,
        error: 'Session retrieval not implemented'
      };
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