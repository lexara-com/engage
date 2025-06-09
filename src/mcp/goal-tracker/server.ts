// GoalTracker MCP Server Implementation
// Compliant with Model Context Protocol specification

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
  MCPErrorCode,
  GoalAssessmentRequest,
  GoalAssessmentResult,
  GoalCompletionRequest,
  AgentRecommendationRequest,
  AgentRecommendationResult,
  Goal
} from './types';

export interface GoalTrackerEnv {
  ENVIRONMENT: string;
  LOG_LEVEL: string;
}

export class GoalTrackerMCPServer {
  private initialized = false;
  private capabilities = {
    tools: { listChanged: false },
    resources: { subscribe: false, listChanged: false },
    logging: {}
  };

  private serverInfo = {
    name: "engage-goal-tracker",
    version: "1.0.0",
    protocolVersion: "2024-11-05"
  };

  // Base goals for all conversations
  private baseGoals: Goal[] = [
    {
      id: "user_identification",
      description: "Collect user's name and primary contact information (email or phone)",
      priority: "critical",
      category: "identification", 
      completed: false,
      addedAt: new Date(),
      source: "base"
    },
    {
      id: "legal_needs_assessment",
      description: "Understand the general area of law and basic situation description",
      priority: "critical",
      category: "legal_context",
      completed: false,
      addedAt: new Date(),
      source: "base"
    },
    {
      id: "conflict_check_readiness",
      description: "Gather sufficient information for initial conflict of interest screening",
      priority: "required",
      category: "conflict_resolution",
      completed: false,
      addedAt: new Date(), 
      source: "base"
    }
  ];

  constructor(private env: GoalTrackerEnv) {}

  // MCP Protocol Handler
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      let result: any;

      switch (request.method) {
        case 'initialize':
          result = await this.handleInitialize(request.params as MCPInitializeParams);
          break;
        
        case 'tools/list':
          result = await this.handleToolsList();
          break;
          
        case 'tools/call':
          result = await this.handleToolCall(request.params);
          break;
          
        case 'resources/list':
          result = await this.handleResourcesList();
          break;
          
        case 'resources/read':
          result = await this.handleResourceRead(request.params);
          break;
          
        default:
          throw this.createError(MCPErrorCode.METHOD_NOT_FOUND, `Method not found: ${request.method}`);
      }

      return {
        jsonrpc: "2.0",
        id: request.id,
        result
      };

    } catch (error) {
      return {
        jsonrpc: "2.0", 
        id: request.id,
        error: error instanceof Error ? this.createError(MCPErrorCode.INTERNAL_ERROR, error.message) : error
      };
    }
  }

  // Initialize MCP server
  private async handleInitialize(params: MCPInitializeParams): Promise<MCPInitializeResult> {
    if (this.initialized) {
      throw this.createError(MCPErrorCode.INVALID_REQUEST, "Server already initialized");
    }

    // Validate protocol version
    if (params.protocolVersion !== this.serverInfo.protocolVersion) {
      throw this.createError(MCPErrorCode.INITIALIZATION_FAILED, 
        `Unsupported protocol version: ${params.protocolVersion}`);
    }

    this.initialized = true;

    return {
      protocolVersion: this.serverInfo.protocolVersion,
      capabilities: this.capabilities,
      serverInfo: this.serverInfo,
      instructions: "GoalTracker MCP server provides goal assessment, completion tracking, and agent recommendations for legal client intake conversations."
    };
  }

  // List available tools
  private async handleToolsList(): Promise<{ tools: MCPTool[] }> {
    this.ensureInitialized();

    const tools: MCPTool[] = [
      {
        name: "assess_goals",
        description: "Analyze conversation progress and assess goal completion status",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Session identifier" },
            firmId: { type: "string", description: "Law firm identifier" },
            conversationHistory: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string", enum: ["user", "agent"] },
                  content: { type: "string" }
                },
                required: ["role", "content"]
              },
              description: "Recent conversation messages"
            },
            currentGoals: {
              type: "array", 
              items: { type: "object" },
              description: "Current goals for the session"
            },
            userIdentity: {
              type: "object",
              description: "Current user identity information"
            }
          },
          required: ["sessionId", "firmId", "conversationHistory", "currentGoals", "userIdentity"]
        }
      },
      {
        name: "mark_goal_complete",
        description: "Mark a specific goal as completed with completion data",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Session identifier" },
            goalId: { type: "string", description: "Goal identifier to mark complete" },
            completionData: { 
              type: "object", 
              description: "Data extracted that completes the goal"
            },
            confidence: { 
              type: "number", 
              minimum: 0, 
              maximum: 1,
              description: "Confidence level in goal completion (0-1)"
            }
          },
          required: ["sessionId", "goalId", "completionData", "confidence"]
        }
      },
      {
        name: "get_agent_recommendations",
        description: "Get recommendations for agent actions based on current conversation state",
        inputSchema: {
          type: "object", 
          properties: {
            sessionId: { type: "string", description: "Session identifier" },
            currentPhase: { 
              type: "string", 
              enum: ["pre_login", "login_suggested", "secured", "data_gathering", "completed"],
              description: "Current conversation phase"
            },
            goalStatus: { 
              type: "object",
              description: "Current goal assessment results"
            },
            conflictStatus: {
              type: "string",
              enum: ["pending", "clear", "conflict_detected"],
              description: "Current conflict check status"
            }
          },
          required: ["sessionId", "currentPhase", "goalStatus", "conflictStatus"]
        }
      }
    ];

    return { tools };
  }

  // Execute tool calls
  private async handleToolCall(params: any): Promise<{ content: MCPToolResult['content'] }> {
    this.ensureInitialized();

    const { name, arguments: args } = params as MCPToolCall;

    switch (name) {
      case "assess_goals":
        return this.assessGoals(args as GoalAssessmentRequest);
        
      case "mark_goal_complete":
        return this.markGoalComplete(args as GoalCompletionRequest);
        
      case "get_agent_recommendations":
        return this.getAgentRecommendations(args as AgentRecommendationRequest);
        
      default:
        throw this.createError(MCPErrorCode.TOOL_NOT_FOUND, `Tool not found: ${name}`);
    }
  }

  // List available resources
  private async handleResourcesList(): Promise<{ resources: MCPResource[] }> {
    this.ensureInitialized();

    const resources: MCPResource[] = [
      {
        uri: "goal://base-goals",
        name: "Base Goals",
        description: "Standard goals for all legal intake conversations",
        mimeType: "application/json"
      },
      {
        uri: "goal://completion-criteria", 
        name: "Goal Completion Criteria",
        description: "Criteria and patterns for determining goal completion",
        mimeType: "application/json"
      }
    ];

    return { resources };
  }

  // Read resource content
  private async handleResourceRead(params: any): Promise<MCPResourceContent> {
    this.ensureInitialized();

    const { uri } = params;

    switch (uri) {
      case "goal://base-goals":
        return {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(this.baseGoals, null, 2)
        };
        
      case "goal://completion-criteria":
        return {
          uri,
          mimeType: "application/json", 
          text: JSON.stringify(this.getCompletionCriteria(), null, 2)
        };
        
      default:
        throw this.createError(MCPErrorCode.RESOURCE_NOT_FOUND, `Resource not found: ${uri}`);
    }
  }

  // Tool Implementation: Assess Goals
  private async assessGoals(request: GoalAssessmentRequest): Promise<{ content: MCPToolResult['content'] }> {
    const { conversationHistory, currentGoals, userIdentity } = request;

    // Analyze conversation for goal completion
    const completedGoals: string[] = [];
    const incompleteGoals: Goal[] = [];
    const blockers: string[] = [];

    for (const goal of currentGoals) {
      const completion = this.analyzeGoalCompletion(goal, conversationHistory, userIdentity);
      
      if (completion.completed) {
        completedGoals.push(goal.id);
      } else {
        incompleteGoals.push(goal);
        if (completion.blockers) {
          blockers.push(...completion.blockers);
        }
      }
    }

    // Determine readiness for next phase
    const criticalGoalsComplete = incompleteGoals.filter(g => g.priority === 'critical').length === 0;
    const requiredGoalsComplete = incompleteGoals.filter(g => g.priority === 'required').length === 0;
    
    const readyForNextPhase = criticalGoalsComplete && requiredGoalsComplete;
    const confidence = this.calculateConfidence(completedGoals, currentGoals, conversationHistory);

    const result: GoalAssessmentResult = {
      completedGoals,
      incompleteGoals,
      blockers,
      readyForNextPhase,
      confidence,
      reasoning: this.generateAssessmentReasoning(completedGoals, incompleteGoals, readyForNextPhase)
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  // Tool Implementation: Mark Goal Complete
  private async markGoalComplete(request: GoalCompletionRequest): Promise<{ content: MCPToolResult['content'] }> {
    const { sessionId, goalId, completionData, confidence } = request;

    // Validate confidence threshold
    if (confidence < 0.7) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, "Confidence too low for goal completion");
    }

    const result = {
      success: true,
      goalId,
      completedAt: new Date().toISOString(),
      completionData,
      confidence
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  // Tool Implementation: Get Agent Recommendations
  private async getAgentRecommendations(request: AgentRecommendationRequest): Promise<{ content: MCPToolResult['content'] }> {
    const { currentPhase, goalStatus, conflictStatus } = request;

    let action: AgentRecommendationResult['action'] = 'continue_gathering';
    let reasoning = "";
    let priorityGoals: Goal[] = [];
    let suggestedQuestions: string[] = [];
    let nextPhase: string | undefined;

    // Decision logic based on current state
    if (conflictStatus === 'conflict_detected') {
      action = 'complete_conversation';
      reasoning = "Conflict of interest detected - end conversation and schedule attorney contact";
    } else if (goalStatus.readyForNextPhase && currentPhase === 'pre_login') {
      action = 'suggest_login';
      reasoning = "All pre-login goals completed - ready to suggest user authentication";
      nextPhase = 'login_suggested';
    } else if (goalStatus.readyForNextPhase && currentPhase === 'secured') {
      action = 'search_additional_goals';
      reasoning = "Base goals complete in secured phase - search for additional firm-specific goals";
    } else {
      // Continue gathering - prioritize incomplete goals
      priorityGoals = goalStatus.incompleteGoals
        .sort((a, b) => this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority))
        .slice(0, 3);
      
      suggestedQuestions = this.generateSuggestedQuestions(priorityGoals);
      reasoning = `Continue gathering information for ${priorityGoals.length} remaining priority goals`;
    }

    const result: AgentRecommendationResult = {
      action,
      reasoning,
      priorityGoals,
      suggestedQuestions,
      ...(nextPhase && { nextPhase })
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  // Helper Methods
  private analyzeGoalCompletion(goal: Goal, conversation: any[], userIdentity: any) {
    // Simple pattern-based analysis (could be enhanced with NLP)
    const conversationText = conversation.map(m => m.content).join(' ').toLowerCase();
    
    switch (goal.id) {
      case "user_identification":
        const hasName = userIdentity.name || /my name is|i'm |i am /.test(conversationText);
        const hasContact = userIdentity.email || userIdentity.phone || 
          /@\w+\.\w+/.test(conversationText) || /\d{3}[.-]\d{3}[.-]\d{4}/.test(conversationText);
        return { 
          completed: hasName && hasContact,
          blockers: !hasName ? ["Missing user name"] : !hasContact ? ["Missing contact information"] : []
        };
        
      case "legal_needs_assessment":
        const hasLegalArea = /accident|divorce|criminal|contract|injury|employment/.test(conversationText);
        const hasSituation = conversationText.length > 200; // Basic situation described
        return {
          completed: hasLegalArea && hasSituation,
          blockers: !hasLegalArea ? ["Legal area not identified"] : !hasSituation ? ["Situation not described"] : []
        };
        
      case "conflict_check_readiness":
        const hasParties = /other driver|employer|company|defendant|plaintiff/.test(conversationText);
        const hasLocation = /in \w+|at \w+|\w+ county|\w+ state/.test(conversationText);
        return {
          completed: hasParties || hasLocation,
          blockers: ["Need more information about other parties or location for conflict check"]
        };
        
      default:
        return { completed: false, blockers: ["Goal completion logic not implemented"] };
    }
  }

  private calculateConfidence(completed: string[], total: Goal[], conversation: any[]): number {
    const completionRatio = completed.length / Math.max(total.length, 1);
    const conversationDepth = Math.min(conversation.length / 10, 1); // More conversation = higher confidence
    return Math.min((completionRatio * 0.7) + (conversationDepth * 0.3), 1);
  }

  private generateAssessmentReasoning(completed: string[], incomplete: Goal[], readyForNext: boolean): string {
    if (readyForNext) {
      return `All critical and required goals completed (${completed.length} total). Ready for next conversation phase.`;
    }
    
    const criticalIncomplete = incomplete.filter(g => g.priority === 'critical').length;
    const requiredIncomplete = incomplete.filter(g => g.priority === 'required').length;
    
    if (criticalIncomplete > 0) {
      return `${criticalIncomplete} critical goals remain incomplete. Must complete before proceeding.`;
    }
    
    if (requiredIncomplete > 0) {
      return `${requiredIncomplete} required goals remain incomplete. Should complete before next phase.`;
    }
    
    return `${incomplete.length} optional goals remain. Can proceed or continue gathering.`;
  }

  private getPriorityWeight(priority: Goal['priority']): number {
    switch (priority) {
      case 'critical': return 1;
      case 'required': return 2; 
      case 'important': return 3;
      case 'optional': return 4;
      default: return 5;
    }
  }

  private generateSuggestedQuestions(goals: Goal[]): string[] {
    const questions: string[] = [];
    
    for (const goal of goals) {
      switch (goal.category) {
        case 'identification':
          questions.push("Could you please share your full name and best contact information?");
          break;
        case 'legal_context':
          questions.push("Can you tell me more about the type of legal matter you need help with?");
          break;
        case 'conflict_resolution':
          questions.push("Who else was involved in this situation?", "Where did this take place?");
          break;
        case 'incident_details':
          questions.push("When did this occur?", "Can you walk me through what happened?");
          break;
      }
    }
    
    return questions.slice(0, 3); // Limit to 3 suggestions
  }

  private getCompletionCriteria() {
    return {
      user_identification: {
        required: ["name", "email_or_phone"],
        patterns: {
          name: /my name is|i'm |i am |call me/i,
          email: /@\w+\.\w+/,
          phone: /\d{3}[.-]\d{3}[.-]\d{4}/
        }
      },
      legal_needs_assessment: {
        required: ["legal_area", "basic_situation"],
        patterns: {
          legal_areas: /accident|divorce|criminal|contract|injury|employment|estate|business|family/i,
          situation_indicators: /happened|occurred|need help|problem|issue|dispute/i
        }
      },
      conflict_check_readiness: {
        required: ["other_parties_or_location"],
        patterns: {
          parties: /other driver|employer|company|defendant|plaintiff|against|vs\.?/i,
          location: /in \w+|at \w+|\w+ county|\w+ state|\w+ city/i
        }
      }
    };
  }

  private ensureInitialized() {
    if (!this.initialized) {
      throw this.createError(MCPErrorCode.INVALID_REQUEST, "Server not initialized");
    }
  }

  private createError(code: MCPErrorCode, message: string, data?: any): MCPError {
    return { code, message, ...(data && { data }) };
  }
}