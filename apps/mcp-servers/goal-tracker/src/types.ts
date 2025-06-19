// GoalTracker MCP Server Types
// Compliant with Model Context Protocol specification

export interface MCPRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// MCP Server Capability Structures
export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
}

export interface MCPCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: {};
}

export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  serverInfo: MCPServerInfo;
  instructions?: string;
}

// Tool Definitions
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments?: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

// Resource Definitions  
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// GoalTracker Specific Types
export interface GoalAssessmentRequest {
  sessionId: string;
  firmId: string;
  conversationHistory: Array<{
    role: "user" | "agent";
    content: string;
  }>;
  currentGoals: Goal[];
  userIdentity: Record<string, any>;
}

export interface GoalAssessmentResult {
  completedGoals: string[];
  incompleteGoals: Goal[];
  blockers: string[];
  readyForNextPhase: boolean;
  confidence: number;
  reasoning: string;
}

export interface GoalCompletionRequest {
  sessionId: string;
  goalId: string;
  completionData: Record<string, any>;
  confidence: number;
}

export interface AgentRecommendationRequest {
  sessionId: string;
  currentPhase: string;
  goalStatus: GoalAssessmentResult;
  conflictStatus: string;
}

export interface AgentRecommendationResult {
  action: 'continue_gathering' | 'suggest_login' | 'check_conflicts' | 'search_additional_goals' | 'complete_conversation';
  reasoning: string;
  priorityGoals: Goal[];
  suggestedQuestions: string[];
  nextPhase?: string;
}

// Goal Structure (from shared types)
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

// MCP Error Codes (JSON-RPC standard + MCP extensions)
export enum MCPErrorCode {
  // JSON-RPC 2.0 standard errors
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  
  // MCP specific errors  
  CAPABILITY_DISABLED = -32000,
  RESOURCE_NOT_FOUND = -32001,
  TOOL_NOT_FOUND = -32002,
  INITIALIZATION_FAILED = -32003
}