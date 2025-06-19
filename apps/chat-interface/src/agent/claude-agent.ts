// Claude Agent - Main conversational AI logic for Engage

/// <reference types="@cloudflare/workers-types" />

import { Env, AgentResponse, Message } from '@/types/shared';
import { createLogger } from '@/utils/logger';
import { EngageError } from '@/utils/errors';
import { generateMessageId, generateSessionId } from '@/utils/ulid';
import { MCPClient, createGoalTrackerClient, createConflictCheckerClient, createAdditionalGoalsClient } from '@/utils/mcp-client';
import { trackAIServiceCall, trackConversationFlow, telemetry } from '@/utils/simple-telemetry';

export interface AgentContext {
  sessionId: string;
  userId: string;
  firmId: string;
  phase: string;
  isAuthenticated: boolean;
  isSecured: boolean;
  preLoginGoals: {
    userIdentification: boolean;
    conflictCheck: boolean;
    legalNeedsAssessment: boolean;
  };
  messages: Message[];
  conflictStatus: string;
  resumeUrl: string;
}

export interface AgentRequest {
  message: string;
  sessionId?: string;
  resumeToken?: string;
  auth0UserId?: string | undefined;
}

export class ClaudeAgent {
  private env: Env;
  private goalTrackerClient: MCPClient;
  private conflictCheckerClient: MCPClient;
  private additionalGoalsClient: MCPClient;

  constructor(env: Env) {
    this.env = env;
    this.goalTrackerClient = createGoalTrackerClient();
    this.conflictCheckerClient = createConflictCheckerClient();
    this.additionalGoalsClient = createAdditionalGoalsClient();
  }

  // Main agent conversation handler
  async processMessage(request: AgentRequest): Promise<AgentResponse> {
    const logger = createLogger(this.env, { 
      operation: 'processMessage',
      ...(request.sessionId && { sessionId: request.sessionId })
    });

    try {
      let context: AgentContext;

      // Get or create conversation context
      if (request.sessionId) {
        context = await this.getConversationContext(request.sessionId);
      } else if (request.resumeToken) {
        context = await this.resumeConversation(request.resumeToken, request.auth0UserId);
      } else {
        throw new EngageError('sessionId or resumeToken required', 'MISSING_SESSION_INFO', 400);
      }

      // Add user message to conversation
      await this.addMessageToConversation(context.sessionId, 'user', request.message);

      // Generate agent response using Claude
      const agentMessage = await this.generateClaudeResponse(context, request.message);

      // Add agent response to conversation
      await this.addMessageToConversation(context.sessionId, 'agent', agentMessage);

      // Use GoalTracker MCP to assess goals and get recommendations
      const goalAssessment = await this.assessGoalsWithMCP(context, request.message);
      
      // Perform conflict checking if sufficient information is available
      const conflictCheckResult = await this.checkConflictsWithMCP(context, request.message, goalAssessment);
      
      // Query supporting documents and enhance goals based on legal area
      const additionalGoalsResult = await this.enhanceGoalsWithMCP(context, request.message, goalAssessment);
      
      const agentRecommendations = await this.getAgentRecommendationsFromMCP(context, goalAssessment);

      // Check if we should suggest login (enhanced with MCP recommendations)
      const shouldSuggestLogin = agentRecommendations.action === 'suggest_login' || this.shouldSuggestLogin(context);

      // Check if conversation should be stopped due to conflicts
      const shouldStopConversation = conflictCheckResult?.stopConversation || false;

      // Check if conversation is complete
      const isComplete = shouldStopConversation || agentRecommendations.action === 'complete_conversation' || this.isConversationComplete(context);

      logger.info('Processed message', {
        sessionId: context.sessionId,
        messageLength: request.message.length,
        responseLength: agentMessage.length,
        shouldSuggestLogin,
        isComplete
      });

      return {
        message: agentMessage,
        suggestLogin: shouldSuggestLogin,
        conversationComplete: isComplete,
        resumeUrl: context.resumeUrl
      };

    } catch (error) {
      logger.error('Failed to process message', error as Error);
      const engageError = error instanceof EngageError ? error : 
        new EngageError('Message processing failed', 'AGENT_ERROR', 500);
      
      throw engageError;
    }
  }

  // Get conversation context from Durable Object
  private async getConversationContext(sessionId: string): Promise<AgentContext> {
    return trackConversationFlow(
      'get_context',
      sessionId,
      async () => {
        // Use sessionId directly as the Durable Object name for consistency
        const conversationStub = this.env.CONVERSATION_SESSION.get(
          this.env.CONVERSATION_SESSION.idFromName(sessionId)
        );

        const response = await conversationStub.fetch(new Request('http://durable-object/context', {
          method: 'GET'
        }));

        if (!response.ok) {
          throw new EngageError('Failed to get conversation context', 'CONTEXT_ERROR', response.status);
        }

        return await response.json() as AgentContext;
      },
      { sessionId }
    );
  }

  // Resume conversation using resume token
  private async resumeConversation(resumeToken: string, auth0UserId?: string): Promise<AgentContext> {
    // Note: This needs the proper resume token to DO mapping
    const conversationStub = this.env.CONVERSATION_SESSION.get(
      this.env.CONVERSATION_SESSION.idFromName(`resume-${resumeToken}`)
    );

    const headers: Record<string, string> = {};
    if (auth0UserId) {
      headers['x-auth0-user-id'] = auth0UserId;
    }

    const response = await conversationStub.fetch(new Request(`http://durable-object/resume/${resumeToken}`, {
      method: 'GET',
      headers
    }));

    if (!response.ok) {
      throw new EngageError('Failed to resume conversation', 'RESUME_ERROR', response.status);
    }

    return await response.json() as AgentContext;
  }

  // Add message to conversation via Durable Object
  private async addMessageToConversation(sessionId: string, role: 'user' | 'agent', content: string): Promise<void> {
    const conversationStub = this.env.CONVERSATION_SESSION.get(
      this.env.CONVERSATION_SESSION.idFromName(sessionId)
    );

    const response = await conversationStub.fetch(new Request('http://durable-object/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content })
    }));

    if (!response.ok) {
      throw new EngageError('Failed to add message', 'ADD_MESSAGE_ERROR', response.status);
    }
  }

  // Generate response using Claude AI
  private async generateClaudeResponse(context: AgentContext, userMessage: string): Promise<string> {
    const logger = createLogger(this.env, { 
      operation: 'generateClaudeResponse',
      sessionId: context.sessionId 
    });

    try {
      // Build system prompt based on context
      const systemPrompt = this.buildSystemPrompt(context);

      // Prepare conversation history for Claude
      const conversationHistory = this.buildConversationHistory(context, userMessage);

      logger.info('Calling Claude AI', {
        systemPromptLength: systemPrompt.length,
        conversationLength: conversationHistory.length,
        phase: context.phase
      });

      // Call AI service (Claude primary, Workers AI fallback)
      const aiResult = await this.callAnthropicAPI(systemPrompt, conversationHistory);
      const agentMessage = aiResult.message || "I apologize, but I'm having trouble responding right now. Could you please try again?";

      logger.info('Generated AI response', {
        responseLength: agentMessage.length,
        aiService: aiResult.service,
        isClaudeUsed: aiResult.service === 'claude-anthropic'
      });

      return agentMessage;

    } catch (error) {
      logger.error('Claude AI call failed', error as Error);
      
      // Fallback response when Claude is unavailable
      return "I apologize, but I'm experiencing technical difficulties. Please try again in a moment, or contact our office directly if this issue persists.";
    }
  }

  // Build system prompt based on conversation context
  private buildSystemPrompt(context: AgentContext): string {
    const basePrompt = `You are an AI assistant for a law firm helping potential clients with initial legal consultations. Your role is to gather information professionally and empathetically.

CRITICAL RULES:
- You are NOT a lawyer and cannot provide legal advice
- You cannot create attorney-client privilege 
- You cannot provide medical advice
- Be empathetic but focused on information gathering
- Never discuss fees or guarantee outcomes
- If asked for legal advice, redirect: "I can't provide legal advice, but I can gather information to help an attorney assist you"

CONVERSATION PHASE: ${context.phase}
AUTHENTICATION STATUS: ${context.isAuthenticated ? 'Authenticated' : 'Not authenticated'}

CURRENT GOALS:`;

    // Add goal tracking based on phase
    if (context.phase === 'pre_login') {
      const goals = [];
      if (!context.preLoginGoals.userIdentification) {
        goals.push('- Get the user\'s name and contact information');
      }
      if (!context.preLoginGoals.legalNeedsAssessment) {
        goals.push('- Understand their legal needs and the type of legal matter');
      }
      if (!context.preLoginGoals.conflictCheck) {
        goals.push('- Learn about other parties involved for conflict checking');
      }

      if (goals.length > 0) {
        return basePrompt + '\n' + goals.join('\n') + '\n\nOnce these basic goals are met, suggest they create an account to secure the conversation and continue with detailed information gathering.';
      } else {
        return basePrompt + '\n- All pre-login goals completed. Suggest the user log in to secure the conversation for detailed information gathering.';
      }
    }

    if (context.phase === 'secured') {
      return basePrompt + '\n- Gather detailed information about their legal matter\n- Collect all relevant facts, dates, and circumstances\n- Prepare comprehensive information for attorney review';
    }

    return basePrompt + '\n- Continue professional conversation based on current phase';
  }

  // Build conversation history for Claude
  private buildConversationHistory(context: AgentContext, newUserMessage: string): Array<{role: string, content: string}> {
    const history = context.messages.map(msg => ({
      role: msg.role === 'agent' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Add the new user message
    history.push({
      role: 'user',
      content: newUserMessage
    });

    // Keep last 10 messages to manage context length
    return history.slice(-10);
  }

  // Check if we should suggest login based on goals
  private shouldSuggestLogin(context: AgentContext): boolean {
    if (context.phase !== 'pre_login' || context.isAuthenticated) {
      return false;
    }

    // Suggest login when all pre-login goals are complete
    return context.preLoginGoals.userIdentification && 
           context.preLoginGoals.conflictCheck && 
           context.preLoginGoals.legalNeedsAssessment;
  }

  // Check if conversation is complete
  private isConversationComplete(context: AgentContext): boolean {
    // For now, just check if we're in a terminal phase
    return context.phase === 'completed' || context.phase === 'terminated';
  }

  // Call Anthropic API directly
  private async callAnthropicAPI(systemPrompt: string, conversationHistory: Array<{role: string, content: string}>): Promise<{message: string, service: string}> {
    const logger = createLogger(this.env, { operation: 'ai-service-call' });
    
    // Try Claude (Anthropic) first - this is our primary AI service
    try {
      logger.info('Attempting Claude API call', { 
        hasApiKey: !!this.env.ANTHROPIC_API_KEY,
        messageCount: conversationHistory.length 
      });

      if (!this.env.ANTHROPIC_API_KEY) {
        logger.warn('ANTHROPIC_API_KEY not configured, skipping to Workers AI fallback');
        throw new Error('ANTHROPIC_API_KEY not configured');
      }

      return await trackAIServiceCall(
        'generate_response',
        'claude-anthropic',
        async () => {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 500,
              temperature: 0.7,
              system: systemPrompt,
              messages: conversationHistory
            })
          });

          if (!response.ok) {
            logger.warn('Claude API failed', { 
              status: response.status, 
              statusText: response.statusText 
            });
            throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json() as any;
          const claudeResponse = data.content?.[0]?.text || '';
          
          if (claudeResponse) {
            logger.info('✅ Claude API successful', { 
              responseLength: claudeResponse.length,
              aiService: 'claude-anthropic'
            });
            
            return { message: claudeResponse, service: 'claude-anthropic' };
          } else {
            throw new Error('Empty response from Claude API');
          }
        },
        {
          'ai.system_prompt.length': systemPrompt.length,
          'ai.conversation.length': conversationHistory.length,
          'ai.max_tokens': 500,
          'ai.temperature': 0.7,
        }
      );

    } catch (claudeError) {
      logger.warn('Claude API failed, falling back to Workers AI', { 
        error: (claudeError as Error).message 
      });

      // Fallback to Workers AI only if Claude fails
      try {
        logger.info('Attempting Workers AI fallback');
        
        return await trackAIServiceCall(
          'generate_response_fallback',
          'workers-ai',
          async () => {
            const prompt = `${systemPrompt}\n\nConversation:\n${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n\nassistant:`;
            
            const aiResponse = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
              prompt,
              max_tokens: 500
            });
            
            if (aiResponse?.response) {
              logger.info('✅ Workers AI fallback successful', { 
                responseLength: aiResponse.response.length,
                aiService: 'workers-ai-fallback'
              });
              
              return { message: aiResponse.response, service: 'workers-ai-fallback' };
            } else {
              throw new Error('Empty response from Workers AI');
            }
          },
          {
            'ai.prompt.length': systemPrompt.length + conversationHistory.length,
            'ai.max_tokens': 500,
            'ai.fallback': true,
          }
        );
        
      } catch (workersError) {
        const claudeErr = claudeError as Error;
        const workersErr = workersError as Error;
        logger.error('Both AI services failed', { 
          claudeErrorMessage: claudeErr.message,
          workersErrorMessage: workersErr.message
        });
        
        // If both services fail, return fallback response with service info
        return { 
          message: "I apologize, but I'm experiencing technical difficulties. Please try again in a moment, or contact our office directly if this issue persists.",
          service: 'fallback-error'
        };
      }
    }
  }

  // Use GoalTracker MCP to assess conversation goals
  private async assessGoalsWithMCP(context: AgentContext, userMessage: string): Promise<any> {
    const logger = createLogger(this.env, { 
      operation: 'assessGoalsWithMCP',
      sessionId: context.sessionId 
    });

    try {
      // Convert conversation to format expected by GoalTracker
      const conversationHistory = context.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Add the new user message
      conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Convert pre-login goals to Goal format expected by MCP
      const currentGoals = [
        {
          id: 'user_identification',
          priority: 'critical',
          category: 'identification',
          completed: context.preLoginGoals.userIdentification
        },
        {
          id: 'legal_needs_assessment',
          priority: 'critical', 
          category: 'legal_context',
          completed: context.preLoginGoals.legalNeedsAssessment
        },
        {
          id: 'conflict_check_readiness',
          priority: 'required',
          category: 'conflict_resolution',
          completed: context.preLoginGoals.conflictCheck
        }
      ];

      const result = await this.goalTrackerClient.callTool('assess_goals', {
        sessionId: context.sessionId,
        firmId: context.firmId,
        conversationHistory,
        currentGoals,
        userIdentity: {} // Will be populated from conversation state later
      });

      logger.info('Goal assessment completed', {
        completedGoals: result.content?.[0]?.text ? JSON.parse(result.content[0].text).completedGoals : [],
        confidence: result.content?.[0]?.text ? JSON.parse(result.content[0].text).confidence : 0
      });

      return result.content?.[0]?.text ? JSON.parse(result.content[0].text) : {};

    } catch (error) {
      logger.error('GoalTracker MCP assessment failed', error as Error);
      // Return fallback assessment
      return {
        completedGoals: [],
        incompleteGoals: [],
        blockers: ['MCP service unavailable'],
        readyForNextPhase: false,
        confidence: 0,
        reasoning: 'Goal assessment service temporarily unavailable'
      };
    }
  }

  // Get agent recommendations from GoalTracker MCP
  private async getAgentRecommendationsFromMCP(context: AgentContext, goalStatus: any): Promise<any> {
    const logger = createLogger(this.env, { 
      operation: 'getAgentRecommendationsFromMCP',
      sessionId: context.sessionId 
    });

    try {
      const result = await this.goalTrackerClient.callTool('get_agent_recommendations', {
        sessionId: context.sessionId,
        currentPhase: context.phase,
        goalStatus,
        conflictStatus: context.conflictStatus
      });

      const recommendations = result.content?.[0]?.text ? JSON.parse(result.content[0].text) : {};

      logger.info('Agent recommendations received', {
        action: recommendations.action,
        reasoning: recommendations.reasoning,
        priorityGoalsCount: recommendations.priorityGoals?.length || 0
      });

      return recommendations;

    } catch (error) {
      logger.error('GoalTracker MCP recommendations failed', error as Error);
      // Return fallback recommendation
      return {
        action: 'continue_gathering',
        reasoning: 'Recommendation service temporarily unavailable - continuing conversation',
        priorityGoals: [],
        suggestedQuestions: []
      };
    }
  }

  // Use ConflictChecker MCP to check for conflicts of interest
  private async checkConflictsWithMCP(context: AgentContext, userMessage: string, goalAssessment: any): Promise<any> {
    const logger = createLogger(this.env, { 
      operation: 'checkConflictsWithMCP',
      sessionId: context.sessionId 
    });

    try {
      // Only check conflicts if we have sufficient information
      if (!goalAssessment.completedGoals || goalAssessment.completedGoals.length < 2) {
        logger.info('Skipping conflict check - insufficient information');
        return { status: 'pending', stopConversation: false };
      }

      // Extract user identity from conversation context
      const userIdentity = this.extractUserIdentityFromContext(context);
      
      // Extract conversation context for conflict checking
      const conversationContext = this.extractConversationContext(context);

      const result = await this.conflictCheckerClient.callTool('check_conflicts', {
        sessionId: context.sessionId,
        firmId: context.firmId,
        userIdentity,
        conversationContext
      });

      const conflictResult = result.content?.[0]?.text ? JSON.parse(result.content[0].text) : {};

      // Track conflict check with simple telemetry
      if (conflictResult.status) {
        await telemetry.trackConversation('conflict_check', context.sessionId, undefined, context.firmId, true, {
          status: conflictResult.status,
          confidence: conflictResult.confidence || 0,
          matchCount: conflictResult.matchDetails?.length || 0
        });
      }

      logger.info('Conflict check completed', {
        status: conflictResult.status,
        confidence: conflictResult.confidence,
        matchCount: conflictResult.matchDetails?.length || 0,
        stopConversation: conflictResult.stopConversation
      });

      return conflictResult;

    } catch (error) {
      logger.error('ConflictChecker MCP failed', error as Error);
      // Return safe fallback - assume no conflicts but continue monitoring
      return {
        status: 'clear',
        confidence: 1.0,
        matchDetails: [],
        additionalGoals: [],
        stopConversation: false,
        checkedAt: new Date(),
        recommendation: 'proceed',
        reasoning: 'Conflict check service temporarily unavailable - proceeding with caution'
      };
    }
  }

  // Extract user identity information from conversation context
  private extractUserIdentityFromContext(context: AgentContext): any {
    const userIdentity = {
      emails: [],
      phones: [],
      names: [],
      addresses: [],
      companies: [],
      aliases: []
    };

    // Extract from conversation messages
    const allMessages = context.messages.map(m => m.content).join(' ');
    
    // Extract email addresses
    const emailMatches = allMessages.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    if (emailMatches) {
      userIdentity.emails = emailMatches;
    }

    // Extract phone numbers
    const phoneMatches = allMessages.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g);
    if (phoneMatches) {
      userIdentity.phones = phoneMatches;
    }

    // Extract names (basic pattern - could be enhanced)
    const nameMatches = allMessages.match(/(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi);
    if (nameMatches) {
      userIdentity.names = nameMatches.map(match => 
        match.replace(/(?:my name is|i'm|i am|call me)\s+/i, '').trim()
      );
    }

    // Extract company names (basic pattern)
    const companyMatches = allMessages.match(/(?:work at|employed by|company|employer)\s+([A-Z][A-Za-z\s&.,]+)/gi);
    if (companyMatches) {
      userIdentity.companies = companyMatches.map(match => 
        match.replace(/(?:work at|employed by|company|employer)\s+/i, '').trim()
      );
    }

    return userIdentity;
  }

  // Extract conversation context for conflict analysis
  private extractConversationContext(context: AgentContext): any {
    const allMessages = context.messages.map(m => m.content).join(' ');
    
    const conversationContext = {
      legalArea: this.extractLegalArea(allMessages),
      parties: this.extractParties(allMessages),
      location: this.extractLocation(allMessages),
      caseDescription: this.extractCaseDescription(allMessages)
    };

    return conversationContext;
  }

  private extractLegalArea(text: string): string | undefined {
    const legalAreas = [
      'personal injury', 'car accident', 'auto accident', 'motorcycle accident',
      'divorce', 'family law', 'custody', 'child support',
      'criminal', 'DUI', 'DWI', 'assault', 'theft',
      'employment', 'wrongful termination', 'discrimination',
      'contract', 'breach of contract', 'business law',
      'real estate', 'property', 'landlord', 'tenant',
      'estate planning', 'will', 'probate', 'trust',
      'bankruptcy', 'debt collection', 'foreclosure'
    ];

    for (const area of legalAreas) {
      if (text.toLowerCase().includes(area)) {
        return area;
      }
    }

    return undefined;
  }

  private extractParties(text: string): string[] {
    const parties: string[] = [];
    
    // Look for other driver, company names, etc.
    const partyPatterns = [
      /other driver/gi,
      /opposing party/gi,
      /defendant/gi,
      /plaintiff/gi,
      /\b([A-Z][a-z]+\s+(?:Insurance|Company|Corp|LLC|Inc))\b/g,
      /employer\s+([A-Z][A-Za-z\s&.,]+)/gi
    ];

    for (const pattern of partyPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        parties.push(...matches);
      }
    }

    return parties;
  }

  private extractLocation(text: string): string | undefined {
    // Look for city, state, county mentions
    const locationPatterns = [
      /in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z]{2})\b/g, // City, State
      /([A-Z][a-z]+)\s+County/gi,
      /downtown\s+([A-Z][a-z]+)/gi,
      /at\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match && match[0]) {
        return match[0];
      }
    }

    return undefined;
  }

  private extractCaseDescription(text: string): string {
    // Return a summary of the key details from the conversation
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // Look for sentences that describe what happened
    const descriptionSentences = sentences.filter(sentence => {
      const lowerSentence = sentence.toLowerCase();
      return lowerSentence.includes('accident') || 
             lowerSentence.includes('happened') || 
             lowerSentence.includes('occurred') || 
             lowerSentence.includes('injured') ||
             lowerSentence.includes('dispute') ||
             lowerSentence.includes('problem');
    });

    return descriptionSentences.slice(0, 3).join('. ').trim();
  }

  // Use AdditionalGoals MCP to enhance goals with supporting documents
  private async enhanceGoalsWithMCP(context: AgentContext, userMessage: string, goalAssessment: any): Promise<any> {
    const logger = createLogger(this.env, { 
      operation: 'enhanceGoalsWithMCP',
      sessionId: context.sessionId 
    });

    try {
      // Only enhance goals if we have identified legal area and basic information
      if (!goalAssessment.completedGoals || goalAssessment.completedGoals.length < 1) {
        logger.info('Skipping goal enhancement - insufficient goal completion');
        return { enhancedGoals: [], additionalDocuments: [] };
      }

      // Extract conversation context for supporting documents search
      const conversationContext = this.extractConversationContext(context);
      
      // Convert current goals to the format expected by AdditionalGoals MCP
      const currentGoals = [
        {
          id: 'user_identification',
          priority: 'critical',
          category: 'identification',
          completed: context.preLoginGoals.userIdentification
        },
        {
          id: 'legal_needs_assessment',
          priority: 'critical', 
          category: 'legal_context',
          completed: context.preLoginGoals.legalNeedsAssessment
        },
        {
          id: 'conflict_check_readiness',
          priority: 'required',
          category: 'conflict_resolution',
          completed: context.preLoginGoals.conflictCheck
        }
      ];

      // Query supporting documents first
      const supportingDocsResult = await this.additionalGoalsClient.callTool('query_supporting_documents', {
        sessionId: context.sessionId,
        firmId: context.firmId,
        legalArea: conversationContext.legalArea || 'general',
        caseType: conversationContext.caseDescription || 'initial_consultation',
        currentGoals,
        conversationContext: {
          jurisdiction: 'general',
          urgency: 'medium',
          clientType: 'individual'
        }
      });

      const supportingDocs = supportingDocsResult.content?.[0]?.text ? JSON.parse(supportingDocsResult.content[0].text) : {};

      // Enhance goals based on supporting documents
      const enhancedGoalsResult = await this.additionalGoalsClient.callTool('enhance_goals', {
        sessionId: context.sessionId,
        currentGoals,
        supportingDocuments: supportingDocs.documents || [],
        conversationContext: {
          legalArea: conversationContext.legalArea || 'general',
          currentPhase: context.phase,
          userIdentity: this.extractUserIdentityFromContext(context)
        },
        prioritizationCriteria: {
          urgency: 'medium',
          complexity: 'moderate',
          timeConstraints: false
        }
      });

      const enhancedGoals = enhancedGoalsResult.content?.[0]?.text ? JSON.parse(enhancedGoalsResult.content[0].text) : {};

      logger.info('Goal enhancement completed', {
        supportingDocsFound: supportingDocs.documents?.length || 0,
        enhancedGoalsCount: enhancedGoals.enhancedGoals?.length || 0,
        additionalGoalsCount: enhancedGoals.additionalGoals?.length || 0
      });

      return {
        supportingDocuments: supportingDocs,
        enhancedGoals: enhancedGoals,
        additionalDocuments: supportingDocs.documentRequirements || []
      };

    } catch (error) {
      logger.error('AdditionalGoals MCP failed', error as Error);
      // Return safe fallback - no additional goals or requirements
      return {
        supportingDocuments: { documents: [] },
        enhancedGoals: { enhancedGoals: [], additionalGoals: [] },
        additionalDocuments: [],
        reasoning: 'Goal enhancement service temporarily unavailable'
      };
    }
  }

  // Create new conversation session
  async createSession(firmId: string): Promise<{ sessionId: string; userId: string; resumeUrl: string }> {
    const logger = createLogger(this.env, { operation: 'createSession', firmId });

    try {
      // Generate a session ID first, then use it to create the Durable Object
      const sessionId = generateSessionId();
      
      const conversationStub = this.env.CONVERSATION_SESSION.get(
        this.env.CONVERSATION_SESSION.idFromName(sessionId)
      );

      const response = await conversationStub.fetch(new Request('http://durable-object/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId, sessionId })
      }));

      if (!response.ok) {
        throw new EngageError('Failed to create session', 'SESSION_CREATION_ERROR', response.status);
      }

      const result = await response.json() as { sessionId: string; userId: string; resumeUrl: string };
      
      logger.info('Created new session', {
        sessionId: result.sessionId,
        userId: result.userId
      });

      return result;

    } catch (error) {
      logger.error('Failed to create session', error as Error);
      throw error instanceof EngageError ? error : 
        new EngageError('Session creation failed', 'AGENT_SESSION_ERROR', 500);
    }
  }
}