// API Response Types for Firm Portal

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    firmId: string;
    timestamp: string;
  };
}

export interface Conversation {
  sessionId: string;
  userId: string;
  firmId: string;
  clientName: string;
  clientEmail?: string;
  practiceArea: string;
  status: 'active' | 'completed' | 'assigned' | 'pending_review' | 'conflict_detected';
  phase: 'pre_login' | 'login_suggested' | 'secured' | 'completed';
  assignedTo?: string;
  conflictStatus: 'pending' | 'clear' | 'conflict_detected';
  goalsCompleted: number;
  goalsTotal: number;
  dataQualityScore: number;
  createdAt: string;
  lastActivity: string;
  isDeleted: boolean;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
  userIdentity: {
    name?: string;
    email?: string;
    phone?: string;
    legalArea?: string;
  };
  dataGoals: DataGoal[];
  completedGoals: string[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    source?: string;
    [key: string]: any;
  };
}

export interface DataGoal {
  id: string;
  description: string;
  completed: boolean;
}

export interface User {
  userId: string;
  firmId: string;
  auth0UserId: string;
  email: string;
  name: string;
  role: 'attorney' | 'paralegal' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  conversationCount: number;
  createdAt: string;
}

export interface FirmAnalytics {
  totalConversations: number;
  completedConversations: number;
  activeConversations: number;
  conversionRate: number;
  averageCompletionTime: number;
  topPracticeAreas: {
    practiceArea: string;
    totalConversations: number;
    conversionRate: number;
  }[];
  statusDistribution: {
    status: string;
    count: number;
  }[];
  weeklyTrends: {
    week: string;
    conversations: number;
    completed: number;
  }[];
}

export interface FirmSettings {
  firmName: string;
  practiceAreas: string[];
  conflictCheckEnabled: boolean;
  autoAssignmentEnabled: boolean;
  notificationSettings: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    slackIntegration: boolean;
  };
  workflowSettings: {
    requireConflictCheck: boolean;
    autoCompleteGoals: number;
    maxSessionDuration: number;
  };
}

export interface SearchResult {
  sessionId: string;
  clientName: string;
  practiceArea: string;
  status: string;
  snippet: string;
  lastActivity: string;
  score: number;
}

// Auth0 User Profile
export interface UserProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  org_id?: string;
  org_name?: string;
  role?: string;
  permissions?: string[];
}