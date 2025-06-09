export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: {
    isStreaming?: boolean;
    isComplete?: boolean;
    error?: string;
  };
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  status: 'active' | 'completed' | 'error';
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    firmId?: string;
    userId?: string;
    clientInfo?: Partial<ClientInfo>;
  };
}

export interface ClientInfo {
  email?: string;
  name?: string;
  phone?: string;
  legalMatter?: string;
  additionalInfo?: Record<string, any>;
}

export interface StreamingResponse {
  type: 'chunk' | 'complete' | 'error';
  content?: string;
  messageId?: string;
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ChatConfig {
  apiEndpoint: string;
  maxMessageLength: number;
  streamingEnabled: boolean;
  autoSave: boolean;
}

// UI State types
export interface ChatUIState {
  isLoading: boolean;
  isTyping: boolean;
  error: string | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
}

// Component props
export interface ChatWindowProps {
  session: ChatSession;
  config: ChatConfig;
  onSendMessage: (content: string) => Promise<void>;
  onUpdateSession: (session: ChatSession) => void;
}

export interface MessageBubbleProps {
  message: ChatMessage;
  isLatest?: boolean;
}

export interface InputAreaProps {
  onSendMessage: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}