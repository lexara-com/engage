// AdditionalGoals MCP Server Implementation
// Handles supporting documents search and goal enhancement with Vectorize integration

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
  SupportingDocumentRequest,
  SupportingDocumentResult,
  EnhanceGoalsRequest,
  EnhanceGoalsResult,
  DocumentRequirementsRequest,
  DocumentRequirementsResult,
  SupportingDocument,
  SupportingDocumentEntry,
  VectorizeSearchRequest,
  VectorizeSearchResult,
  Goal,
  DocumentRequirement,
  PracticeGuideline,
  SearchStrategy,
  SearchAnalysis,
  ExecutedQuery,
  GoalPriorityChange
} from './types';

export interface AdditionalGoalsEnv {
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  SUPPORTING_DOCUMENTS: VectorizeIndex;
}

export class AdditionalGoalsMCPServer {
  private initialized = false;
  private capabilities = {
    tools: { listChanged: false },
    resources: { subscribe: false, listChanged: false },
    logging: {}
  };

  private serverInfo = {
    name: "engage-additional-goals",
    version: "1.0.0",
    protocolVersion: "2024-11-05"
  };

  constructor(private env: AdditionalGoalsEnv) {}

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
      instructions: "AdditionalGoals MCP server provides supporting documents search, goal enhancement, and document requirements for legal client intake."
    };
  }

  // List available tools
  private async handleToolsList(): Promise<{ tools: MCPTool[] }> {
    this.ensureInitialized();

    const tools: MCPTool[] = [
      {
        name: "query_supporting_documents",
        description: "Search supporting documents database to find additional guidance and requirements based on legal area and case context",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Session identifier" },
            firmId: { type: "string", description: "Law firm identifier" },
            legalArea: { type: "string", description: "Area of law (e.g., personal injury, family law, criminal defense)" },
            caseType: { type: "string", description: "Specific case type within legal area" },
            practiceArea: { type: "string", description: "Firm's practice area specialization" },
            caseDescription: { type: "string", description: "Brief description of the legal matter" },
            currentGoals: {
              type: "array",
              items: { type: "object" },
              description: "Current conversation goals to enhance"
            },
            conversationContext: {
              type: "object",
              properties: {
                jurisdiction: { type: "string", description: "Legal jurisdiction" },
                caseValue: { type: "number", description: "Estimated case value" },
                urgency: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                clientType: { type: "string", enum: ["individual", "business", "organization"] }
              },
              description: "Additional context for document search"
            }
          },
          required: ["sessionId", "firmId", "legalArea", "currentGoals"]
        }
      },
      {
        name: "enhance_goals",
        description: "Enhance existing goals with additional requirements and priorities based on supporting documents",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Session identifier" },
            currentGoals: {
              type: "array",
              items: { type: "object" },
              description: "Current goals to enhance"
            },
            supportingDocuments: {
              type: "array",
              items: { type: "object" },
              description: "Supporting documents found for this case type"
            },
            conversationContext: {
              type: "object",
              properties: {
                legalArea: { type: "string" },
                caseType: { type: "string" },
                currentPhase: { type: "string" },
                userIdentity: { type: "object" }
              },
              required: ["legalArea", "currentPhase"],
              description: "Current conversation context"
            },
            prioritizationCriteria: {
              type: "object",
              properties: {
                urgency: { type: "string", enum: ["low", "medium", "high"] },
                complexity: { type: "string", enum: ["simple", "moderate", "complex"] },
                timeConstraints: { type: "boolean" }
              },
              description: "Criteria for goal prioritization"
            }
          },
          required: ["sessionId", "currentGoals", "supportingDocuments", "conversationContext"]
        }
      },
      {
        name: "get_document_requirements",
        description: "Get required documents for a specific case type and jurisdiction",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Session identifier" },
            firmId: { type: "string", description: "Law firm identifier" },
            legalArea: { type: "string", description: "Area of law" },
            caseType: { type: "string", description: "Specific case type" },
            jurisdiction: { type: "string", description: "Legal jurisdiction" },
            caseContext: {
              type: "object",
              properties: {
                estimatedValue: { type: "number", description: "Estimated case value" },
                hasOpposingParty: { type: "boolean", description: "Whether there's an opposing party" },
                isLitigation: { type: "boolean", description: "Whether this involves litigation" },
                urgency: { type: "string", enum: ["low", "medium", "high"] }
              },
              description: "Additional case context for requirements"
            }
          },
          required: ["sessionId", "firmId", "legalArea"]
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
      case "query_supporting_documents":
        return this.querySupportingDocuments(args as SupportingDocumentRequest);
        
      case "enhance_goals":
        return this.enhanceGoals(args as EnhanceGoalsRequest);
        
      case "get_document_requirements":
        return this.getDocumentRequirements(args as DocumentRequirementsRequest);
        
      default:
        throw this.createError(MCPErrorCode.TOOL_NOT_FOUND, `Tool not found: ${name}`);
    }
  }

  // List available resources
  private async handleResourcesList(): Promise<{ resources: MCPResource[] }> {
    this.ensureInitialized();

    const resources: MCPResource[] = [
      {
        uri: "supporting-docs://search-strategies",
        name: "Document Search Strategies",
        description: "Strategies for searching supporting documents based on legal area and case type",
        mimeType: "application/json"
      },
      {
        uri: "supporting-docs://goal-enhancement-rules",
        name: "Goal Enhancement Rules",
        description: "Rules and patterns for enhancing goals based on supporting documents",
        mimeType: "application/json"
      },
      {
        uri: "supporting-docs://document-templates",
        name: "Document Requirement Templates",
        description: "Templates for common document requirements by practice area",
        mimeType: "application/json"
      },
      {
        uri: "supporting-docs://priority-matrix",
        name: "Goal Priority Matrix",
        description: "Matrix for determining goal priorities based on case characteristics",
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
      case "supporting-docs://search-strategies":
        return {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(this.getSearchStrategies(), null, 2)
        };
        
      case "supporting-docs://goal-enhancement-rules":
        return {
          uri,
          mimeType: "application/json", 
          text: JSON.stringify(this.getGoalEnhancementRules(), null, 2)
        };

      case "supporting-docs://document-templates":
        return {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(this.getDocumentTemplates(), null, 2)
        };

      case "supporting-docs://priority-matrix":
        return {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(this.getPriorityMatrix(), null, 2)
        };
        
      default:
        throw this.createError(MCPErrorCode.RESOURCE_NOT_FOUND, `Resource not found: ${uri}`);
    }
  }

  // Tool Implementation: Query Supporting Documents
  private async querySupportingDocuments(request: SupportingDocumentRequest): Promise<{ content: MCPToolResult['content'] }> {
    const { firmId, legalArea, caseType, caseDescription, currentGoals, conversationContext } = request;

    try {
      // Develop search strategy based on available information
      const searchStrategy = this.buildSearchStrategy(legalArea, caseType, caseDescription, conversationContext);
      
      // Execute searches using different strategies
      const searchResults = await this.executeDocumentSearch(firmId, searchStrategy);
      
      // Analyze and rank results
      const matchedDocuments = this.analyzeDocumentMatches(searchResults, legalArea, caseType);
      
      // Extract additional goals from matched documents
      const additionalGoals = this.extractAdditionalGoals(matchedDocuments, currentGoals);
      
      // Extract document requirements
      const documentRequirements = this.extractDocumentRequirements(matchedDocuments);
      
      // Extract practice guidelines
      const practiceGuidelines = this.extractPracticeGuidelines(matchedDocuments);
      
      // Calculate confidence and generate reasoning
      const confidence = this.calculateSearchConfidence(matchedDocuments, searchStrategy);
      const reasoning = this.generateSearchReasoning(searchStrategy, matchedDocuments, additionalGoals);

      const result: SupportingDocumentResult = {
        matchedDocuments,
        additionalGoals,
        documentRequirements,
        practiceGuidelines,
        confidence,
        reasoning,
        searchStrategy: searchStrategy.explanation
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error) {
      throw this.createError(MCPErrorCode.INTERNAL_ERROR, `Supporting documents query failed: ${error.message}`);
    }
  }

  // Tool Implementation: Enhance Goals
  private async enhanceGoals(request: EnhanceGoalsRequest): Promise<{ content: MCPToolResult['content'] }> {
    const { currentGoals, supportingDocuments, conversationContext, prioritizationCriteria } = request;

    const enhancedGoals: Goal[] = [];
    const newGoals: Goal[] = [];
    const modifiedGoals: Goal[] = [];
    const removedGoalIds: string[] = [];
    const priorityChanges: GoalPriorityChange[] = [];

    // Enhance existing goals based on supporting documents
    for (const goal of currentGoals) {
      const enhanced = this.enhanceExistingGoal(goal, supportingDocuments, conversationContext);
      
      if (enhanced) {
        enhancedGoals.push(enhanced);
        
        if (enhanced.priority !== goal.priority) {
          priorityChanges.push({
            goalId: goal.id,
            oldPriority: goal.priority,
            newPriority: enhanced.priority,
            reason: `Priority adjusted based on ${enhanced.source} guidance`
          });
        }
        
        if (JSON.stringify(enhanced) !== JSON.stringify(goal)) {
          modifiedGoals.push(enhanced);
        }
      }
    }

    // Add new goals from supporting documents
    for (const document of supportingDocuments) {
      for (const docGoal of document.dataGatheringGoals) {
        // Check if this goal already exists or is covered
        const existsOrCovered = enhancedGoals.some(eg => 
          eg.id === docGoal.id || 
          this.goalsAreSimilar(eg, docGoal)
        );
        
        if (!existsOrCovered) {
          const newGoal: Goal = {
            ...docGoal,
            id: `${docGoal.id}_${Date.now()}`,
            addedAt: new Date(),
            source: 'supporting_documents',
            relatedDocumentId: document.id
          };
          
          // Apply prioritization criteria
          if (prioritizationCriteria) {
            newGoal.priority = this.adjustPriorityBasedOnCriteria(newGoal.priority, prioritizationCriteria);
          }
          
          newGoals.push(newGoal);
          enhancedGoals.push(newGoal);
        }
      }
    }

    // Calculate total estimated completion time
    const estimatedCompletionTime = enhancedGoals.reduce((total, goal) => 
      total + (goal.estimatedTimeToComplete || 5), 0
    );

    const confidence = this.calculateEnhancementConfidence(currentGoals, supportingDocuments, enhancedGoals);
    const reasoning = this.generateEnhancementReasoning(
      currentGoals.length, 
      newGoals.length, 
      modifiedGoals.length, 
      priorityChanges.length,
      supportingDocuments.length
    );

    const result: EnhanceGoalsResult = {
      enhancedGoals,
      newGoals,
      modifiedGoals,
      removedGoalIds,
      priorityChanges,
      reasoning,
      confidence,
      estimatedCompletionTime
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  // Tool Implementation: Get Document Requirements
  private async getDocumentRequirements(request: DocumentRequirementsRequest): Promise<{ content: MCPToolResult['content'] }> {
    const { firmId, legalArea, caseType, jurisdiction, caseContext } = request;

    try {
      // Search for documents related to requirements for this case type
      const searchQuery = this.buildRequirementsSearchQuery(legalArea, caseType, jurisdiction);
      const searchResults = await this.vectorizeSearch(firmId, searchQuery, 'requirements_search', 10);
      
      const matchedDocuments = this.analyzeDocumentMatches(searchResults, legalArea, caseType);
      
      // Extract and categorize document requirements
      const allRequirements = matchedDocuments.flatMap(doc => doc.documentRequirements);
      
      const requiredDocuments = allRequirements.filter(req => req.required);
      const optionalDocuments = allRequirements.filter(req => !req.required);
      
      // Generate conditional requirements based on case context
      const conditionalDocuments = this.generateConditionalRequirements(
        allRequirements, 
        caseContext, 
        legalArea
      );
      
      // Generate upload guidelines
      const uploadGuidelines = this.generateUploadGuidelines(allRequirements, legalArea);
      
      // Generate security requirements
      const securityRequirements = this.generateSecurityRequirements(legalArea, caseContext);
      
      const reasoning = this.generateRequirementsReasoning(
        requiredDocuments.length,
        optionalDocuments.length,
        conditionalDocuments.length,
        matchedDocuments.length
      );

      const result: DocumentRequirementsResult = {
        requiredDocuments,
        optionalDocuments,
        conditionalDocuments,
        uploadGuidelines,
        securityRequirements,
        reasoning
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error) {
      throw this.createError(MCPErrorCode.INTERNAL_ERROR, `Document requirements query failed: ${error.message}`);
    }
  }

  // Vectorize Search Methods
  private async executeDocumentSearch(firmId: string, strategy: SearchStrategy): Promise<VectorizeSearchResult[]> {
    const allResults: VectorizeSearchResult[] = [];
    
    for (let i = 0; i < strategy.queries.length; i++) {
      const query = strategy.queries[i];
      const weight = strategy.weights[i];
      
      try {
        const results = await this.vectorizeSearch(
          firmId, 
          query, 
          strategy.type, 
          Math.ceil(10 * weight)
        );
        
        // Weight the scores based on query importance
        const weightedResults = results.map(result => ({
          ...result,
          score: result.score * weight
        }));
        
        allResults.push(...weightedResults);
      } catch (error) {
        console.warn(`Search query failed: ${query}`, error);
      }
    }
    
    // Deduplicate and sort by score
    const uniqueResults = this.deduplicateSearchResults(allResults);
    return uniqueResults.sort((a, b) => b.score - a.score);
  }

  private async vectorizeSearch(
    firmId: string, 
    query: string, 
    searchType: string, 
    topK: number
  ): Promise<VectorizeSearchResult[]> {
    try {
      console.log(`Vectorize search: ${searchType} - "${query}" for firm ${firmId}`);
      
      // In a real implementation, this would use the Vectorize binding
      // const results = await this.env.SUPPORTING_DOCUMENTS.query(query, { 
      //   topK, 
      //   filter: { firmId, isActive: true } 
      // });
      
      // Mock implementation for demonstration
      return this.getMockSearchResults(query, firmId, topK);
      
    } catch (error) {
      console.error(`Vectorize search failed for ${searchType}:`, error);
      return [];
    }
  }

  // Analysis and Enhancement Methods
  private buildSearchStrategy(
    legalArea: string, 
    caseType?: string, 
    description?: string, 
    context?: any
  ): SearchStrategy {
    const queries: string[] = [];
    const weights: number[] = [];
    const filters: Record<string, any> = { isActive: true };

    // Primary query - legal area
    queries.push(legalArea);
    weights.push(1.0);

    // Secondary query - case type if available
    if (caseType) {
      queries.push(`${legalArea} ${caseType}`);
      weights.push(0.8);
    }

    // Tertiary query - description if available
    if (description && description.length > 20) {
      queries.push(description);
      weights.push(0.6);
    }

    // Context-based query
    if (context?.jurisdiction) {
      queries.push(`${legalArea} ${context.jurisdiction}`);
      weights.push(0.7);
      filters.jurisdiction = context.jurisdiction;
    }

    return {
      type: 'hybrid',
      queries,
      weights,
      filters,
      explanation: `Hybrid search strategy: primary focus on ${legalArea}${caseType ? ` and ${caseType}` : ''}, with context-aware filtering`
    };
  }

  private analyzeDocumentMatches(
    results: VectorizeSearchResult[], 
    legalArea: string, 
    caseType?: string
  ): SupportingDocument[] {
    return results
      .filter(result => result.score > 0.7) // Threshold for relevance
      .map(result => ({
        ...result.metadata,
        relevanceScore: result.score,
        dataGatheringGoals: result.metadata.dataGatheringGoals || [],
        documentRequirements: result.metadata.documentRequirements || [],
        guidelines: result.metadata.guidelines || [],
        metadata: result.metadata.metadata || {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0',
          isActive: true,
          priority: 'medium' as const
        }
      }))
      .slice(0, 5); // Limit to top 5 most relevant documents
  }

  private extractAdditionalGoals(documents: SupportingDocument[], currentGoals: Goal[]): Goal[] {
    const additionalGoals: Goal[] = [];
    const currentGoalIds = new Set(currentGoals.map(g => g.id));
    
    for (const document of documents) {
      for (const goal of document.dataGatheringGoals) {
        if (!currentGoalIds.has(goal.id) && !this.isDuplicateGoal(goal, currentGoals)) {
          additionalGoals.push({
            ...goal,
            addedAt: new Date(),
            source: 'supporting_documents',
            relatedDocumentId: document.id
          });
        }
      }
    }
    
    // Sort by priority and estimated completion time
    return additionalGoals.sort((a, b) => {
      const priorityOrder = { critical: 0, required: 1, important: 2, optional: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private extractDocumentRequirements(documents: SupportingDocument[]): DocumentRequirement[] {
    const requirements: DocumentRequirement[] = [];
    const seen = new Set<string>();
    
    for (const document of documents) {
      for (const req of document.documentRequirements) {
        if (!seen.has(req.id)) {
          requirements.push(req);
          seen.add(req.id);
        }
      }
    }
    
    return requirements.sort((a, b) => 
      (b.required ? 1 : 0) - (a.required ? 1 : 0)
    );
  }

  private extractPracticeGuidelines(documents: SupportingDocument[]): PracticeGuideline[] {
    const guidelines: PracticeGuideline[] = [];
    const seen = new Set<string>();
    
    for (const document of documents) {
      for (const guideline of document.guidelines) {
        if (!seen.has(guideline.id)) {
          guidelines.push(guideline);
          seen.add(guideline.id);
        }
      }
    }
    
    return guidelines.sort((a, b) => {
      const priorityOrder = { critical: 0, important: 1, advisory: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // Helper Methods
  private enhanceExistingGoal(
    goal: Goal, 
    documents: SupportingDocument[], 
    context: any
  ): Goal | null {
    // Look for enhancements to this goal in the supporting documents
    for (const document of documents) {
      const relatedGoal = document.dataGatheringGoals.find(dg => 
        dg.category === goal.category || this.goalsAreSimilar(dg, goal)
      );
      
      if (relatedGoal) {
        return {
          ...goal,
          description: relatedGoal.description || goal.description,
          priority: this.getHigherPriority(goal.priority, relatedGoal.priority),
          estimatedTimeToComplete: relatedGoal.estimatedTimeToComplete || goal.estimatedTimeToComplete,
          validationRules: relatedGoal.validationRules || goal.validationRules,
          dependencies: relatedGoal.dependencies || goal.dependencies,
          relatedDocumentId: document.id
        };
      }
    }
    
    return goal; // Return unchanged if no enhancements found
  }

  private goalsAreSimilar(goal1: Goal, goal2: Goal): boolean {
    // Simple similarity check - could be enhanced with NLP
    return goal1.category === goal2.category && 
           goal1.description.toLowerCase().includes(goal2.description.toLowerCase().split(' ')[0]);
  }

  private getHigherPriority(p1: Goal['priority'], p2: Goal['priority']): Goal['priority'] {
    const priorityOrder = { critical: 4, required: 3, important: 2, optional: 1 };
    return priorityOrder[p1] >= priorityOrder[p2] ? p1 : p2;
  }

  private isDuplicateGoal(newGoal: Goal, existingGoals: Goal[]): boolean {
    return existingGoals.some(existing => 
      existing.category === newGoal.category &&
      existing.description.toLowerCase().includes(newGoal.description.toLowerCase().substring(0, 20))
    );
  }

  private adjustPriorityBasedOnCriteria(
    currentPriority: Goal['priority'], 
    criteria: any
  ): Goal['priority'] {
    if (criteria.urgency === 'high' && currentPriority === 'important') {
      return 'required';
    }
    if (criteria.timeConstraints && currentPriority === 'optional') {
      return 'important';
    }
    return currentPriority;
  }

  private calculateSearchConfidence(documents: SupportingDocument[], strategy: SearchStrategy): number {
    if (documents.length === 0) return 0.1;
    
    const avgScore = documents.reduce((sum, doc) => sum + (doc.relevanceScore || 0), 0) / documents.length;
    const strategyBonus = strategy.queries.length > 1 ? 0.1 : 0;
    
    return Math.min(avgScore + strategyBonus, 1.0);
  }

  private calculateEnhancementConfidence(
    currentGoals: Goal[], 
    documents: SupportingDocument[], 
    enhancedGoals: Goal[]
  ): number {
    const documentQuality = documents.length > 0 ? 
      documents.reduce((sum, doc) => sum + (doc.relevanceScore || 0), 0) / documents.length : 0;
    
    const enhancementRatio = enhancedGoals.length / Math.max(currentGoals.length, 1);
    
    return Math.min(documentQuality * 0.7 + Math.min(enhancementRatio, 1) * 0.3, 1.0);
  }

  private generateSearchReasoning(
    strategy: SearchStrategy, 
    documents: SupportingDocument[], 
    goals: Goal[]
  ): string {
    const docCount = documents.length;
    const goalCount = goals.length;
    
    if (docCount === 0) {
      return `No supporting documents found for this case type. Used ${strategy.type} search with ${strategy.queries.length} queries.`;
    }
    
    return `Found ${docCount} relevant supporting documents using ${strategy.type} search strategy. ` +
           `Extracted ${goalCount} additional goals and requirements. ` +
           `Search focused on: ${strategy.queries.slice(0, 2).join(', ')}.`;
  }

  private generateEnhancementReasoning(
    originalCount: number,
    newCount: number,
    modifiedCount: number,
    priorityChanges: number,
    documentCount: number
  ): string {
    let reasoning = `Enhanced goal set based on ${documentCount} supporting documents. `;
    
    if (newCount > 0) {
      reasoning += `Added ${newCount} new goals. `;
    }
    
    if (modifiedCount > 0) {
      reasoning += `Modified ${modifiedCount} existing goals. `;
    }
    
    if (priorityChanges > 0) {
      reasoning += `Adjusted priorities for ${priorityChanges} goals. `;
    }
    
    reasoning += `Total goals increased from ${originalCount} to ${originalCount + newCount}.`;
    
    return reasoning;
  }

  private generateRequirementsReasoning(
    required: number,
    optional: number,
    conditional: number,
    documents: number
  ): string {
    return `Document requirements compiled from ${documents} supporting documents: ` +
           `${required} required, ${optional} optional, and ${conditional} conditional documents identified.`;
  }

  // Mock Data Methods (for demonstration - would be removed in production)
  private getMockSearchResults(query: string, firmId: string, topK: number): VectorizeSearchResult[] {
    // Mock implementation - in production this would query actual Vectorize
    const mockDocuments: SupportingDocumentEntry[] = [
      {
        id: "doc_personal_injury_1",
        firmId: firmId,
        title: "Personal Injury Case Requirements",
        practiceArea: "Personal Injury",
        legalAreas: ["personal injury", "auto accidents", "slip and fall"],
        caseTypes: ["motor vehicle accident", "premises liability"],
        jurisdiction: "California",
        content: "Personal injury cases require comprehensive documentation...",
        keywords: ["injury", "accident", "damages", "medical records"],
        dataGatheringGoals: [
          {
            id: "medical_records_goal",
            description: "Obtain all medical records related to the injury",
            priority: "critical" as const,
            category: "evidence" as const,
            completed: false,
            addedAt: new Date(),
            source: "supporting_documents" as const,
            estimatedTimeToComplete: 15
          }
        ],
        documentRequirements: [
          {
            id: "medical_records_req",
            name: "Medical Records",
            description: "All medical records from treating physicians",
            required: true,
            category: "medical" as const,
            formats: ["pdf", "doc"]
          }
        ],
        guidelines: [
          {
            id: "injury_severity_guideline",
            type: "conversation_guidance" as const,
            title: "Assess Injury Severity",
            description: "Always assess the severity of injuries early in conversation",
            applicablePhases: ["data_gathering"],
            priority: "important" as const
          }
        ],
        isActive: true,
        priority: "high" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    return mockDocuments
      .filter(doc => doc.legalAreas.some(area => 
        area.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase().includes(area.toLowerCase())
      ))
      .map(doc => ({
        id: doc.id,
        score: 0.85 + Math.random() * 0.14, // Mock relevance score
        metadata: doc
      }))
      .slice(0, topK);
  }

  private deduplicateSearchResults(results: VectorizeSearchResult[]): VectorizeSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.id)) {
        return false;
      }
      seen.add(result.id);
      return true;
    });
  }

  private buildRequirementsSearchQuery(legalArea: string, caseType?: string, jurisdiction?: string): string {
    let query = `${legalArea} requirements documents`;
    if (caseType) query += ` ${caseType}`;
    if (jurisdiction) query += ` ${jurisdiction}`;
    return query;
  }

  private generateConditionalRequirements(requirements: DocumentRequirement[], context: any, legalArea: string): any[] {
    // Mock implementation - would have real logic in production
    return [];
  }

  private generateUploadGuidelines(requirements: DocumentRequirement[], legalArea: string): any[] {
    // Mock implementation - would have real logic in production
    return [{
      category: "general",
      guidelines: ["Ensure all documents are clearly legible", "Remove any social security numbers"],
      maxTotalSizeMB: 50,
      acceptedFormats: ["pdf", "doc", "docx", "jpg", "png"]
    }];
  }

  private generateSecurityRequirements(legalArea: string, context: any): any[] {
    // Mock implementation - would have real logic in production
    return [{
      type: "encryption" as const,
      requirement: "All documents must be encrypted during transmission",
      reason: "Legal document confidentiality requirements",
      applies_to: ["all"]
    }];
  }

  // Resource Data Methods
  private getSearchStrategies() {
    return {
      hybrid: {
        description: "Combines semantic and keyword search for optimal results",
        useCases: ["Complex legal matters", "Multi-faceted cases"],
        queryWeights: { primary: 1.0, secondary: 0.8, contextual: 0.6 }
      },
      semantic: {
        description: "Uses meaning and context for document matching",
        useCases: ["Broad topic exploration", "Related concept discovery"],
        threshold: 0.7
      },
      keyword: {
        description: "Exact term matching for specific requirements",
        useCases: ["Specific document types", "Jurisdiction-specific rules"],
        exactMatch: true
      }
    };
  }

  private getGoalEnhancementRules() {
    return {
      priorityEscalation: {
        urgentCases: "Escalate 'important' to 'required' for urgent cases",
        timeConstraints: "Escalate 'optional' to 'important' with time constraints",
        highValue: "Escalate priorities for high-value cases"
      },
      goalMerging: {
        similarCategories: "Merge goals in same category with similar descriptions",
        dependencies: "Group goals with shared dependencies"
      },
      validationRules: {
        completeness: "Ensure all critical information is gathered",
        consistency: "Check for conflicting goals or requirements"
      }
    };
  }

  private getDocumentTemplates() {
    return {
      personalInjury: {
        required: ["Medical records", "Police reports", "Insurance correspondence"],
        optional: ["Witness statements", "Photographs of scene"],
        conditional: ["Expert reports (if damages >$50k)", "Employment records (if loss of income)"]
      },
      familyLaw: {
        required: ["Marriage certificate", "Financial statements", "Custody agreements"],
        optional: ["Communication logs", "School records"],
        conditional: ["Forensic accounting (if complex assets)", "Child evaluations (if custody disputed)"]
      },
      criminal: {
        required: ["Police reports", "Charging documents", "Court notices"],
        optional: ["Character references", "Employment verification"],
        conditional: ["Expert witnesses (if technical case)", "Private investigation (if complex)"]
      }
    };
  }

  private getPriorityMatrix() {
    return {
      critical: {
        description: "Must be completed before proceeding",
        examples: ["Client identification", "Conflict check", "Statute of limitations"]
      },
      required: {
        description: "Necessary for case evaluation",
        examples: ["Basic incident details", "Injury assessment", "Insurance information"]
      },
      important: {
        description: "Significant for case strength",
        examples: ["Witness information", "Additional evidence", "Prior medical history"]
      },
      optional: {
        description: "Helpful but not essential",
        examples: ["Background information", "Additional contacts", "Preference details"]
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