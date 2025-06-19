// AdditionalGoals MCP Server Types
// Handles supporting documents search and goal enhancement

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

// Supporting Documents Search Types
export interface SupportingDocumentRequest {
  sessionId: string;
  firmId: string;
  legalArea: string;
  caseType?: string;
  practiceArea?: string;
  caseDescription?: string;
  currentGoals: Goal[];
  conversationContext?: {
    jurisdiction?: string;
    caseValue?: number;
    urgency?: 'low' | 'medium' | 'high' | 'urgent';
    clientType?: 'individual' | 'business' | 'organization';
  };
}

export interface SupportingDocumentResult {
  matchedDocuments: SupportingDocument[];
  additionalGoals: Goal[];
  documentRequirements: DocumentRequirement[];
  practiceGuidelines: PracticeGuideline[];
  confidence: number;
  reasoning: string;
  searchStrategy: string;
}

export interface SupportingDocument {
  id: string;
  firmId: string;
  title: string;
  practiceArea: string;
  legalAreas: string[];
  caseTypes: string[];
  jurisdiction?: string;
  content: string;
  dataGatheringGoals: Goal[];
  documentRequirements: DocumentRequirement[];
  guidelines: PracticeGuideline[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
    author?: string;
    reviewedBy?: string;
    lastReviewDate?: Date;
    isActive: boolean;
    priority: 'high' | 'medium' | 'low';
  };
  relevanceScore?: number;
}

export interface Goal {
  id: string;
  description: string;
  priority: 'critical' | 'required' | 'important' | 'optional';
  category: 'identification' | 'conflict_resolution' | 'legal_context' | 'incident_details' | 'evidence' | 'documentation' | 'financial' | 'timeline' | 'witnesses';
  completed: boolean;
  completionData?: Record<string, unknown>;
  addedAt: Date;
  source: 'base' | 'additional' | 'conflict_checker' | 'manual' | 'supporting_documents';
  relatedDocumentId?: string;
  estimatedTimeToComplete?: number; // minutes
  dependencies?: string[]; // other goal IDs this depends on
  validationRules?: ValidationRule[];
}

export interface DocumentRequirement {
  id: string;
  name: string;
  description: string;
  required: boolean;
  category: 'identification' | 'evidence' | 'financial' | 'medical' | 'legal' | 'correspondence';
  formats: string[]; // ['pdf', 'doc', 'jpg', 'png']
  maxSizeMB?: number;
  examples?: string[];
  validationRules?: string[];
}

export interface PracticeGuideline {
  id: string;
  type: 'conversation_guidance' | 'legal_requirement' | 'firm_policy' | 'best_practice';
  title: string;
  description: string;
  applicablePhases: string[]; // conversation phases where this applies
  priority: 'critical' | 'important' | 'advisory';
  conditions?: Record<string, any>; // when this guideline applies
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'format' | 'range' | 'custom';
  rule: string;
  message: string;
}

// Enhanced Goals Request Types
export interface EnhanceGoalsRequest {
  sessionId: string;
  currentGoals: Goal[];
  supportingDocuments: SupportingDocument[];
  conversationContext: {
    legalArea: string;
    caseType?: string;
    currentPhase: string;
    userIdentity?: Record<string, any>;
  };
  prioritizationCriteria?: {
    urgency?: 'low' | 'medium' | 'high';
    complexity?: 'simple' | 'moderate' | 'complex';
    timeConstraints?: boolean;
  };
}

export interface EnhanceGoalsResult {
  enhancedGoals: Goal[];
  newGoals: Goal[];
  modifiedGoals: Goal[];
  removedGoalIds: string[];
  priorityChanges: GoalPriorityChange[];
  reasoning: string;
  confidence: number;
  estimatedCompletionTime: number; // total minutes for all goals
}

export interface GoalPriorityChange {
  goalId: string;
  oldPriority: Goal['priority'];
  newPriority: Goal['priority'];
  reason: string;
}

// Document Requirements Request Types
export interface DocumentRequirementsRequest {
  sessionId: string;
  firmId: string;
  legalArea: string;
  caseType?: string;
  jurisdiction?: string;
  caseContext?: {
    estimatedValue?: number;
    hasOpposingParty?: boolean;
    isLitigation?: boolean;
    urgency?: 'low' | 'medium' | 'high';
  };
}

export interface DocumentRequirementsResult {
  requiredDocuments: DocumentRequirement[];
  optionalDocuments: DocumentRequirement[];
  conditionalDocuments: ConditionalDocumentRequirement[];
  uploadGuidelines: UploadGuideline[];
  securityRequirements: SecurityRequirement[];
  reasoning: string;
}

export interface ConditionalDocumentRequirement {
  documentRequirement: DocumentRequirement;
  condition: string;
  triggerQuestion: string;
}

export interface UploadGuideline {
  category: string;
  guidelines: string[];
  maxTotalSizeMB: number;
  acceptedFormats: string[];
  securityNote?: string;
}

export interface SecurityRequirement {
  type: 'encryption' | 'redaction' | 'access_control' | 'retention';
  requirement: string;
  reason: string;
  applies_to: string[]; // document categories
}

// Vectorize Integration Types for Supporting Documents
export interface SupportingDocumentEntry {
  id: string;
  firmId: string;
  title: string;
  practiceArea: string;
  legalAreas: string[];
  caseTypes: string[];
  jurisdiction?: string;
  content: string;
  keywords: string[];
  dataGatheringGoals: Goal[];
  documentRequirements: DocumentRequirement[];
  guidelines: PracticeGuideline[];
  isActive: boolean;
  priority: 'high' | 'medium' | 'low';
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
  metadata: SupportingDocumentEntry;
}

// Search Strategy Types
export interface SearchStrategy {
  type: 'semantic' | 'keyword' | 'hybrid' | 'structured';
  queries: string[];
  weights: number[];
  filters: Record<string, any>;
  explanation: string;
}

export interface SearchAnalysis {
  strategy: SearchStrategy;
  executedQueries: ExecutedQuery[];
  totalResults: number;
  averageConfidence: number;
  reasoning: string;
}

export interface ExecutedQuery {
  query: string;
  type: string;
  results: number;
  topScore: number;
  filter?: Record<string, any>;
}

// Re-export common MCP types
export type { 
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