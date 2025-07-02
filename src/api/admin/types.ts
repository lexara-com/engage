// Admin API Types

export interface AdminEnv {
  // D1 Database
  DB: D1Database;
  
  // Durable Objects
  CONVERSATION_SESSION: DurableObjectNamespace;
  
  // Vectorize indexes
  SUPPORTING_DOCUMENTS: VectorizeIndex;
  CONFLICT_DATABASE: VectorizeIndex;
  
  // R2 bucket for document storage
  DOCUMENTS_BUCKET: R2Bucket;
  
  // Queue for DO->D1 sync
  SYNC_QUEUE: Queue<SyncEvent>;
  
  // Environment config
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  
  // Auth0 config
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
  
  // CORS allowed origins
  ALLOWED_ORIGINS: string;
}

// Request context with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;           // Auth0 user ID
    firmId: string;        // User's firm
    role: 'admin' | 'attorney' | 'staff';
    email: string;
    permissions: string[];
  };
}

// Sync event from DO to D1
export interface SyncEvent {
  type: 'conversation.created' | 'conversation.message_added' | 'conversation.status_changed' | 
        'conversation.user_identified' | 'conversation.goals_updated' | 'conversation.conflict_checked';
  conversationId: string;
  firmId: string;
  doVersion: number;
  timestamp: Date;
  data: Record<string, any>;
}

// API Error Response
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

// Pagination params
export interface PaginationParams {
  page: number;
  limit: number;
}

// Pagination response
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Conversation list filters
export interface ConversationFilters {
  status?: 'active' | 'completed' | 'terminated';
  assignedTo?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

// Firm entity
export interface Firm {
  id: string;
  name: string;
  domain?: string;
  status: 'active' | 'suspended' | 'inactive';
  subscriptionPlan: 'starter' | 'professional' | 'enterprise';
  conversationLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

// Conversation summary (from D1)
export interface ConversationSummary {
  id: string;
  firmId: string;
  userId: string;
  sessionId: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  status: 'active' | 'completed' | 'terminated';
  phase: string;
  conflictStatus: 'pending' | 'clear' | 'conflict_detected';
  assignedTo?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags: string[];
  followUpDate?: Date;
  messageCount: number;
  completedGoals: number;
  totalGoals: number;
  createdAt: Date;
  lastActivity: Date;
}

// Full conversation detail (D1 + DO merge)
export interface ConversationDetail extends ConversationSummary {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
  userIdentity: Record<string, any>;
  dataGoals: Array<{
    id: string;
    description: string;
    completed: boolean;
  }>;
  supportDocuments: string[];
  internalNotes: ConversationNote[];
  auditLog: AuditEntry[];
}

// Internal note
export interface ConversationNote {
  id: string;
  conversationId: string;
  firmId: string;
  noteType: 'assessment' | 'follow_up' | 'general';
  noteContent: string;
  createdBy: string;
  createdAt: Date;
}

// Audit log entry
export interface AuditEntry {
  id: string;
  conversationId: string;
  firmId: string;
  action: 'status_change' | 'assignment' | 'priority_change' | 'tag_update' | 'note_added' | 'follow_up_set';
  performedBy: string;
  performedAt: Date;
  details: Record<string, any>;
}

// Update conversation request
export interface UpdateConversationRequest {
  status?: 'active' | 'completed' | 'terminated';
  assignedTo?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  tags?: string[];
  followUpDate?: Date;
}

// Add note request
export interface AddNoteRequest {
  note: string;
  type?: 'assessment' | 'follow_up' | 'general';
}

// Conversation action request
export interface ConversationActionRequest {
  action: 'assign' | 'reassign' | 'flag_review' | 'mark_urgent' | 'request_follow_up';
  assigneeId?: string;
  note?: string;
  metadata?: Record<string, any>;
}

// Conflict entry
export interface ConflictEntry {
  id: string;
  firmId: string;
  name: string;
  type: 'client' | 'party' | 'matter' | 'other';
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Supporting document
export interface SupportingDocument {
  id: string;
  firmId: string;
  title: string;
  description?: string;
  category: 'case_template' | 'goal_definition' | 'agent_instruction' | 'other';
  fileType: 'pdf' | 'docx' | 'txt' | 'md';
  fileSize: number;
  contentUrl?: string;
  metadata?: Record<string, any>;
  vectorized: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Guideline
export interface Guideline {
  id: string;
  firmId: string;
  content: string;
  priority: number;
  category: 'conversation_style' | 'data_gathering' | 'compliance' | 'other';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}