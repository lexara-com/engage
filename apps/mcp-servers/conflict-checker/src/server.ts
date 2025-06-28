// ConflictChecker MCP Server Implementation
// Handles conflict of interest detection with Vectorize integration

import { 
  MCPRequest, 
  MCPResponse, 
  MCPInitializeParams,
  MCPInitializeResult,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPResource,
  MCPResourceContent,
  MCPErrorCode,
  MCPError
} from '../goal-tracker/types';
import {
  ConflictCheckRequest,
  ConflictCheckResult,
  ConflictMatch,
  ConflictEntry,
  VectorizeSearchRequest,
  VectorizeSearchResult,
  AdditionalGoalRequest,
  AdditionalGoalResult,
  ConflictResolutionStrategy,
  UserIdentifiers,
  Goal
} from './types';

export interface ConflictCheckerEnv {
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  CONFLICT_DATABASE: VectorizeIndex;
}

export class ConflictCheckerMCPServer {
  private initialized = false;
  private capabilities = {
    tools: { listChanged: false },
    resources: { subscribe: false, listChanged: false },
    logging: {}
  };

  private serverInfo = {
    name: "engage-conflict-checker",
    version: "1.0.0",
    protocolVersion: "2024-11-05"
  };

  constructor(private env: ConflictCheckerEnv) {}

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

    if (params.protocolVersion !== this.serverInfo.protocolVersion) {
      throw this.createError(MCPErrorCode.INITIALIZATION_FAILED, 
        `Unsupported protocol version: ${params.protocolVersion}`);
    }

    this.initialized = true;

    return {
      protocolVersion: this.serverInfo.protocolVersion,
      capabilities: this.capabilities,
      serverInfo: this.serverInfo,
      instructions: "ConflictChecker MCP server provides conflict of interest detection using semantic search and generates additional goals for disambiguation."
    };
  }

  // List available tools
  private async handleToolsList(): Promise<{ tools: MCPTool[] }> {
    this.ensureInitialized();

    const tools: MCPTool[] = [
      {
        name: "check_conflicts",
        description: "Check for conflicts of interest using semantic search against firm's conflict database",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Session identifier" },
            firmId: { type: "string", description: "Law firm identifier" },
            userIdentity: {
              type: "object",
              properties: {
                emails: { type: "array", items: { type: "string" } },
                phones: { type: "array", items: { type: "string" } },
                names: { type: "array", items: { type: "string" } },
                addresses: { type: "array", items: { type: "object" } },
                companies: { type: "array", items: { type: "string" } },
                aliases: { type: "array", items: { type: "string" } }
              },
              description: "User identity information for conflict checking"
            },
            conversationContext: {
              type: "object",
              properties: {
                legalArea: { type: "string", description: "Area of law (e.g., personal injury, divorce)" },
                parties: { type: "array", items: { type: "string" }, description: "Other parties involved" },
                location: { type: "string", description: "Geographic location of matter" },
                caseDescription: { type: "string", description: "Brief description of legal matter" }
              },
              description: "Context from conversation for conflict analysis"
            },
            previousCheckResult: {
              type: "object",
              description: "Previous conflict check result if re-checking"
            }
          },
          required: ["sessionId", "firmId", "userIdentity", "conversationContext"]
        }
      },
      {
        name: "generate_disambiguation_goals",
        description: "Generate additional goals to disambiguate potential conflicts",
        inputSchema: {
          type: "object",
          properties: {
            conflictMatches: {
              type: "array",
              items: { type: "object" },
              description: "Potential conflict matches requiring disambiguation"
            },
            currentGoals: {
              type: "array",
              items: { type: "object" },
              description: "Current conversation goals"
            },
            conversationContext: {
              type: "object",
              description: "Current conversation context"
            }
          },
          required: ["conflictMatches", "currentGoals", "conversationContext"]
        }
      },
      {
        name: "analyze_conflict_resolution",
        description: "Analyze conflict situation and recommend resolution strategy",
        inputSchema: {
          type: "object",
          properties: {
            conflictMatches: {
              type: "array",
              items: { type: "object" },
              description: "Confirmed conflict matches"
            },
            userResponse: {
              type: "string",
              description: "User's response to conflict questions"
            },
            conversationHistory: {
              type: "array",
              items: { type: "object" },
              description: "Conversation history for context"
            }
          },
          required: ["conflictMatches", "conversationHistory"]
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
      case "check_conflicts":
        return this.checkConflicts(args as ConflictCheckRequest);
        
      case "generate_disambiguation_goals":
        return this.generateDisambiguationGoals(args as AdditionalGoalRequest);
        
      case "analyze_conflict_resolution":
        return this.analyzeConflictResolution(args);
        
      default:
        throw this.createError(MCPErrorCode.TOOL_NOT_FOUND, `Tool not found: ${name}`);
    }
  }

  // List available resources
  private async handleResourcesList(): Promise<{ resources: MCPResource[] }> {
    this.ensureInitialized();

    const resources: MCPResource[] = [
      {
        uri: "conflict://search-patterns",
        name: "Conflict Search Patterns",
        description: "Patterns and strategies for conflict detection",
        mimeType: "application/json"
      },
      {
        uri: "conflict://resolution-strategies",
        name: "Conflict Resolution Strategies",
        description: "Strategies for handling different types of conflicts",
        mimeType: "application/json"
      },
      {
        uri: "conflict://disambiguation-templates",
        name: "Disambiguation Goal Templates",
        description: "Templates for generating conflict disambiguation goals",
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
      case "conflict://search-patterns":
        return {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(this.getSearchPatterns(), null, 2)
        };
        
      case "conflict://resolution-strategies":
        return {
          uri,
          mimeType: "application/json", 
          text: JSON.stringify(this.getResolutionStrategies(), null, 2)
        };

      case "conflict://disambiguation-templates":
        return {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(this.getDisambiguationTemplates(), null, 2)
        };
        
      default:
        throw this.createError(MCPErrorCode.RESOURCE_NOT_FOUND, `Resource not found: ${uri}`);
    }
  }

  // Tool Implementation: Check Conflicts
  private async checkConflicts(request: ConflictCheckRequest): Promise<{ content: MCPToolResult['content'] }> {
    const { firmId, userIdentity, conversationContext } = request;

    try {
      // Perform semantic searches for different types of matches
      const searches = await Promise.all([
        this.searchByNames(firmId, userIdentity.names),
        this.searchByEmails(firmId, userIdentity.emails),
        this.searchByCompanies(firmId, userIdentity.companies),
        this.searchByParties(firmId, conversationContext.parties || []),
        this.searchByCaseDescription(firmId, conversationContext.caseDescription || '')
      ]);

      // Combine and analyze results
      const allMatches = searches.flat();
      const conflictMatches = this.analyzeMatches(allMatches, userIdentity, conversationContext);

      // Determine overall conflict status
      const status = this.determineConflictStatus(conflictMatches);
      const confidence = this.calculateConflictConfidence(conflictMatches);
      
      // Generate additional goals if potential conflicts found
      const additionalGoals = conflictMatches.length > 0 ? 
        this.generateConflictGoals(conflictMatches, conversationContext) : [];

      const result: ConflictCheckResult = {
        status,
        confidence,
        matchDetails: conflictMatches,
        additionalGoals,
        stopConversation: status === 'conflict_detected' && confidence > 0.8,
        checkedAt: new Date(),
        recommendation: this.getRecommendation(status, confidence, conflictMatches.length),
        reasoning: this.generateConflictReasoning(status, conflictMatches, confidence)
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error) {
      throw this.createError(MCPErrorCode.INTERNAL_ERROR, `Conflict check failed: ${error.message}`);
    }
  }

  // Tool Implementation: Generate Disambiguation Goals
  private async generateDisambiguationGoals(request: AdditionalGoalRequest): Promise<{ content: MCPToolResult['content'] }> {
    const { conflictMatches, currentGoals, conversationContext } = request;

    const goals: Goal[] = [];

    for (const match of conflictMatches) {
      // Generate specific goals based on match type and confidence
      if (match.matchType === 'fuzzy' && match.confidence < 0.8) {
        if (match.matchedFields.includes('name')) {
          goals.push({
            id: `disambiguate_name_${match.conflictEntryId}`,
            description: `Clarify if user is the same person as ${match.conflictDetails}`,
            priority: 'critical',
            category: 'conflict_resolution',
            completed: false,
            addedAt: new Date(),
            source: 'conflict_checker',
            relatedConflictId: match.conflictEntryId
          });
        }

        if (match.matchedFields.includes('company')) {
          goals.push({
            id: `disambiguate_company_${match.conflictEntryId}`,
            description: `Confirm relationship to company: ${match.conflictDetails}`,
            priority: 'required',
            category: 'conflict_resolution',
            completed: false,
            addedAt: new Date(),
            source: 'conflict_checker',
            relatedConflictId: match.conflictEntryId
          });
        }

        if (match.matchedFields.includes('location')) {
          goals.push({
            id: `disambiguate_location_${match.conflictEntryId}`,
            description: `Verify if matter involves same location/jurisdiction as existing case`,
            priority: 'important',
            category: 'conflict_resolution',
            completed: false,
            addedAt: new Date(),
            source: 'conflict_checker',
            relatedConflictId: match.conflictEntryId
          });
        }
      }
    }

    const result: AdditionalGoalResult = {
      goals,
      reasoning: `Generated ${goals.length} disambiguation goals for ${conflictMatches.length} potential conflicts`,
      priority: goals.some(g => g.priority === 'critical') ? 'immediate' : 'before_proceeding'
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  // Tool Implementation: Analyze Conflict Resolution
  private async analyzeConflictResolution(args: any): Promise<{ content: MCPToolResult['content'] }> {
    const { conflictMatches, userResponse, conversationHistory } = args;

    // Analyze user response for conflict resolution
    const strategy = this.determineResolutionStrategy(conflictMatches, userResponse || '', conversationHistory);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(strategy, null, 2)
      }]
    };
  }

  // Vectorize Search Methods
  private async searchByNames(firmId: string, names: string[]): Promise<VectorizeSearchResult[]> {
    if (!names.length) return [];

    const searchQuery = names.join(' ');
    return this.vectorizeSearch(firmId, searchQuery, 'name_search', 5);
  }

  private async searchByEmails(firmId: string, emails: string[]): Promise<VectorizeSearchResult[]> {
    if (!emails.length) return [];

    const searchQuery = emails.join(' ');
    return this.vectorizeSearch(firmId, searchQuery, 'email_search', 3);
  }

  private async searchByCompanies(firmId: string, companies: string[]): Promise<VectorizeSearchResult[]> {
    if (!companies.length) return [];

    const searchQuery = companies.join(' ');
    return this.vectorizeSearch(firmId, searchQuery, 'company_search', 5);
  }

  private async searchByParties(firmId: string, parties: string[]): Promise<VectorizeSearchResult[]> {
    if (!parties.length) return [];

    const searchQuery = parties.join(' ');
    return this.vectorizeSearch(firmId, searchQuery, 'party_search', 5);
  }

  private async searchByCaseDescription(firmId: string, description: string): Promise<VectorizeSearchResult[]> {
    if (!description.trim()) return [];

    return this.vectorizeSearch(firmId, description, 'case_search', 3);
  }

  private async vectorizeSearch(firmId: string, query: string, searchType: string, topK: number): Promise<VectorizeSearchResult[]> {
    try {
      // In a real implementation, this would use the Vectorize binding
      // For now, return mock results for demonstration
      console.log(`Vectorize search: ${searchType} - "${query}" for firm ${firmId}`);
      
      // Mock implementation - in production, use:
      // const results = await this.env.CONFLICT_DATABASE.query(query, { topK, filter: { firmId } });
      
      return []; // Mock empty results for now
    } catch (error) {
      console.error(`Vectorize search failed for ${searchType}:`, error);
      return [];
    }
  }

  // Analysis Methods
  private analyzeMatches(matches: VectorizeSearchResult[], userIdentity: UserIdentifiers, context: any): ConflictMatch[] {
    const conflictMatches: ConflictMatch[] = [];

    for (const match of matches) {
      if (match.score > 0.7) { // Threshold for potential conflicts
        const conflictMatch: ConflictMatch = {
          conflictEntryId: match.id,
          matchedFields: this.determineMatchedFields(match, userIdentity),
          matchType: match.score > 0.9 ? 'exact' : match.score > 0.8 ? 'fuzzy' : 'semantic',
          confidence: match.score,
          conflictDetails: this.formatConflictDetails(match.metadata),
          suggestedGoals: []
        };
        conflictMatches.push(conflictMatch);
      }
    }

    return conflictMatches;
  }

  private determineMatchedFields(match: VectorizeSearchResult, userIdentity: UserIdentifiers): string[] {
    const fields: string[] = [];
    
    // This would analyze which fields matched in a real implementation
    if (userIdentity.names.length > 0) fields.push('name');
    if (userIdentity.emails.length > 0) fields.push('email');
    if (userIdentity.companies.length > 0) fields.push('company');
    
    return fields;
  }

  private formatConflictDetails(metadata: ConflictEntry): string {
    return `${metadata.type}: ${metadata.names.join(', ')} - ${metadata.matterDescription}`;
  }

  private determineConflictStatus(matches: ConflictMatch[]): 'pending' | 'clear' | 'conflict_detected' {
    if (matches.length === 0) return 'clear';
    
    const highConfidenceMatches = matches.filter(m => m.confidence > 0.8);
    if (highConfidenceMatches.length > 0) return 'conflict_detected';
    
    return 'pending'; // Needs more investigation
  }

  private calculateConflictConfidence(matches: ConflictMatch[]): number {
    if (matches.length === 0) return 1.0; // 100% confident no conflicts
    
    const maxConfidence = Math.max(...matches.map(m => m.confidence));
    return 1 - maxConfidence; // Inverse - lower confidence means higher conflict probability
  }

  private getRecommendation(status: string, confidence: number, matchCount: number): 'proceed' | 'gather_more_info' | 'attorney_handoff' {
    if (status === 'conflict_detected' && confidence < 0.2) {
      return 'attorney_handoff';
    }
    if (matchCount > 0 && confidence < 0.8) {
      return 'gather_more_info';
    }
    return 'proceed';
  }

  private generateConflictReasoning(status: string, matches: ConflictMatch[], confidence: number): string {
    if (status === 'clear') {
      return 'No potential conflicts detected in database search.';
    }
    
    if (status === 'conflict_detected') {
      return `High-confidence conflict detected: ${matches.length} matches found with confidence ${(1-confidence).toFixed(2)}. Attorney review required.`;
    }
    
    return `${matches.length} potential conflicts require disambiguation. Gathering additional information recommended.`;
  }

  private generateConflictGoals(matches: ConflictMatch[], context: any): Goal[] {
    const goals: Goal[] = [];

    if (matches.length > 0) {
      goals.push({
        id: 'clarify_conflict_relationship',
        description: 'Clarify relationship to potentially conflicted parties or matters',
        priority: 'critical',
        category: 'conflict_resolution',
        completed: false,
        addedAt: new Date(),
        source: 'conflict_checker'
      });
    }

    return goals;
  }

  private determineResolutionStrategy(matches: ConflictMatch[], userResponse: string, history: any[]): ConflictResolutionStrategy {
    // Analyze user response to determine if conflict is real
    const hasConflict = userResponse.toLowerCase().includes('yes') || 
                       userResponse.toLowerCase().includes('same') ||
                       userResponse.toLowerCase().includes('involved');

    if (hasConflict) {
      return {
        strategy: 'immediate_stop',
        reasoning: 'User confirmed conflict of interest',
        requiredActions: ['End conversation', 'Schedule attorney contact', 'Document conflict'],
        additionalGoals: [],
        timelineRecommendation: 'Immediate - attorney contact within 24 hours'
      };
    }

    return {
      strategy: 'proceed_with_caution',
      reasoning: 'User denied conflict, proceeding with documentation',
      requiredActions: ['Document denial', 'Continue with intake'],
      additionalGoals: [],
      timelineRecommendation: 'Continue normal process'
    };
  }

  // Resource Data
  private getSearchPatterns() {
    return {
      namePatterns: {
        exact: { weight: 1.0, threshold: 0.95 },
        fuzzy: { weight: 0.8, threshold: 0.85 },
        phonetic: { weight: 0.6, threshold: 0.75 }
      },
      emailPatterns: {
        exact: { weight: 1.0, threshold: 0.99 },
        domain: { weight: 0.7, threshold: 0.80 }
      },
      companyPatterns: {
        exact: { weight: 1.0, threshold: 0.95 },
        subsidiary: { weight: 0.8, threshold: 0.85 },
        semantic: { weight: 0.6, threshold: 0.75 }
      }
    };
  }

  private getResolutionStrategies() {
    return {
      immediate_stop: {
        description: "Stop conversation immediately due to confirmed conflict",
        actions: ["End intake", "Schedule attorney contact", "Document conflict"],
        timeline: "Immediate"
      },
      gather_disambiguation: {
        description: "Gather additional information to clarify potential conflicts",
        actions: ["Ask clarifying questions", "Document responses", "Re-evaluate"],
        timeline: "Current conversation"
      },
      attorney_review: {
        description: "Flag for attorney review before proceeding",
        actions: ["Document potential conflict", "Schedule review", "Hold intake"],
        timeline: "24-48 hours"
      },
      proceed_with_caution: {
        description: "Proceed with heightened documentation and monitoring",
        actions: ["Enhanced documentation", "Periodic re-evaluation", "Attorney notification"],
        timeline: "Ongoing"
      }
    };
  }

  private getDisambiguationTemplates() {
    return {
      name_disambiguation: {
        template: "To ensure we can properly assist you, could you confirm if you are the same [NAME] who was involved in [MATTER_DESCRIPTION]?",
        followups: ["When was this?", "What was your role?", "Are you related to this person?"]
      },
      company_disambiguation: {
        template: "I see a reference to [COMPANY_NAME] in our records. What is your relationship to this company?",
        followups: ["Are you an employee?", "Do you own this company?", "Are you representing them?"]
      },
      location_disambiguation: {
        template: "Your matter involves [LOCATION]. Have you been involved in any other legal matters in this area?",
        followups: ["When did this occur?", "What type of matter?", "Who else was involved?"]
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