// Conversation and messaging types

export type ConversationPhase = 
  | 'pre_login' 
  | 'login_suggested' 
  | 'secured' 
  | 'conflict_check_complete' 
  | 'data_gathering' 
  | 'completed' 
  | 'terminated';

export type ConflictStatus = 'pending' | 'clear' | 'conflict_detected';

export type GoalPriority = 'critical' | 'required' | 'important' | 'optional';

export type GoalCategory = 'identification' | 'conflict_resolution' | 'legal_context' | 'incident_details' | 'evidence';

export type GoalSource = 'base' | 'additional' | 'conflict_checker' | 'manual';

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface Goal {
  id: string;
  description: string;
  priority: GoalPriority;
  category: GoalCategory;
  completed: boolean;
  completionData?: Record<string, unknown>;
  addedAt: Date;
  source: GoalSource;
  relatedConflictId?: string;
}

export interface ConversationSession {
  sessionId: string;
  userId: string;
  firmId: string;
  isAuthenticated: boolean;
  auth0UserId?: string;
  isSecured: boolean;
  resumeToken: string;
  resumeUrl: string;
  loginUrl?: string;
  
  preLoginGoals: {
    userIdentification: boolean;
    conflictCheck: boolean;
    legalNeedsAssessment: boolean;
  };
  
  userIdentity: {
    name?: string;
    email?: string;
    phone?: string;
    legalArea?: string;
    basicSituation?: string;
    address?: string;
    detailedSituation?: string;
  };
  
  phase: ConversationPhase;
  
  conflictCheck: {
    status: ConflictStatus;
    checkedAt?: Date;
    conflictDetails?: string;
    preLoginCheck: boolean;
    checkedIdentity: string[];
  };
  
  dataGoals: Goal[];
  completedGoals: string[];
  supportDocuments: string[];
  messages: Message[];
  allowedAuth0Users: string[];
  
  createdAt: Date;
  lastActivity: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}