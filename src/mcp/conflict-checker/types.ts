// ConflictChecker MCP Server Types
// Handles conflict of interest detection with Vectorize integration

import { 
  MCPRequest, 
  MCPResponse, 
  MCPNotification,
  MCPError,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPResource,
  MCPResourceContent,
  MCPErrorCode
} from '../goal-tracker/types';

// Conflict Detection Specific Types
export interface ConflictCheckRequest {
  sessionId: string;
  firmId: string;
  userIdentity: UserIdentifiers;
  conversationContext: {
    legalArea?: string;
    parties?: string[];
    location?: string;
    caseDescription?: string;
  };
  previousCheckResult?: ConflictCheckResult;
}

export interface ConflictCheckResult {
  status: ConflictStatus;
  confidence: number;
  matchDetails: ConflictMatch[];
  additionalGoals: Goal[];
  stopConversation: boolean;
  checkedAt: Date;
  recommendation: 'proceed' | 'gather_more_info' | 'attorney_handoff';
  reasoning: string;
}

export interface ConflictMatch {
  conflictEntryId: string;
  matchedFields: string[];
  matchType: 'exact' | 'fuzzy' | 'semantic';
  confidence: number;
  conflictDetails: string;
  suggestedGoals: Goal[];
}

export interface UserIdentifiers {
  emails: string[];
  phones: string[];
  names: string[];
  addresses: Address[];
  companies: string[];
  aliases: string[];
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Goal {
  id: string;
  description: string;
  priority: 'critical' | 'required' | 'important' | 'optional';
  category: 'identification' | 'conflict_resolution' | 'legal_context' | 'incident_details' | 'evidence';
  completed: boolean;
  completionData?: Record<string, unknown>;
  addedAt: Date;
  source: 'base' | 'additional' | 'conflict_checker' | 'manual';
  relatedConflictId?: string;
}

export type ConflictStatus = 'pending' | 'clear' | 'conflict_detected';

// Vectorize Integration Types
export interface ConflictEntry {
  id: string;
  firmId: string;
  type: 'client' | 'opposing_party' | 'witness' | 'related_entity' | 'case_matter';
  names: string[];
  aliases: string[];
  companies: string[];
  addresses: Address[];
  emails: string[];
  phones: string[];
  caseNumbers: string[];
  matterDescription: string;
  conflictReason: string;
  severity: 'high' | 'medium' | 'low';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VectorizeSearchRequest {
  query: string;
  topK?: number;
  threshold?: number;
  filter?: Record<string, any>;
}

export interface VectorizeSearchResult {
  id: string;
  score: number;
  metadata: ConflictEntry;
}

// Additional Goals Generation
export interface AdditionalGoalRequest {
  conflictMatches: ConflictMatch[];
  currentGoals: Goal[];
  conversationContext: any;
}

export interface AdditionalGoalResult {
  goals: Goal[];
  reasoning: string;
  priority: 'immediate' | 'before_proceeding' | 'optional';
}

// Conflict Resolution Strategies
export interface ConflictResolutionStrategy {
  strategy: 'immediate_stop' | 'gather_disambiguation' | 'attorney_review' | 'proceed_with_caution';
  reasoning: string;
  requiredActions: string[];
  additionalGoals: Goal[];
  timelineRecommendation: string;
}

export { 
  MCPRequest, 
  MCPResponse, 
  MCPNotification,
  MCPError,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPResource,
  MCPResourceContent,
  MCPErrorCode
};