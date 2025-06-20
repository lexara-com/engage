// Simple, reliable telemetry for Cloudflare Workers
// Uses native Cloudflare Analytics + structured logging

interface TelemetryEvent {
  timestamp: string;
  service: string;
  operation: string;
  sessionId?: string;
  userId?: string;
  firmId?: string;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// Simple metrics tracking
export class SimpleTelemetry {
  private service: string;
  private environment: string;

  constructor(service: string = 'engage-legal-ai', environment: string = 'development') {
    this.service = service;
    this.environment = environment;
  }

  // Track AI service calls
  async trackAICall(
    operation: string,
    aiService: 'claude-anthropic' | 'workers-ai' | 'fallback',
    duration: number,
    success: boolean,
    error?: string,
    metadata?: Record<string, any>
  ) {
    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      service: this.service,
      operation: `ai.${operation}`,
      duration,
      success,
      error,
      metadata: {
        ai_service: aiService,
        environment: this.environment,
        ...metadata
      }
    };

    // Log to Cloudflare console (appears in wrangler tail and dashboard)
    console.log('AI_CALL_METRIC', JSON.stringify(event));
    
    // Send to external service if needed (much simpler than OTel)
    if (success) {
      console.log(`✅ ${aiService} ${operation} completed in ${duration}ms`);
    } else {
      console.error(`❌ ${aiService} ${operation} failed: ${error}`);
    }
  }

  // Track conversation events
  async trackConversation(
    operation: string,
    sessionId: string,
    userId?: string,
    firmId?: string,
    success: boolean = true,
    metadata?: Record<string, any>
  ) {
    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      service: this.service,
      operation: `conversation.${operation}`,
      sessionId,
      userId,
      firmId,
      success,
      metadata: {
        environment: this.environment,
        ...metadata
      }
    };

    console.log('CONVERSATION_METRIC', JSON.stringify(event));
  }

  // Track API performance
  async trackAPICall(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>
  ) {
    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      service: this.service,
      operation: 'api.request',
      duration,
      success: statusCode < 400,
      metadata: {
        endpoint,
        method,
        status_code: statusCode,
        environment: this.environment,
        ...metadata
      }
    };

    console.log('API_METRIC', JSON.stringify(event));
  }

  // Track errors
  async trackError(
    operation: string,
    error: Error,
    context?: Record<string, any>
  ) {
    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      service: this.service,
      operation: `error.${operation}`,
      success: false,
      error: error.message,
      metadata: {
        error_name: error.name,
        error_stack: error.stack,
        environment: this.environment,
        ...context
      }
    };

    console.error('ERROR_METRIC', JSON.stringify(event));
  }

  // Simple health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy', checks: Record<string, any> }> {
    const checks = {
      timestamp: new Date().toISOString(),
      service: this.service,
      environment: this.environment,
      memory_usage: 'available', // Workers don't expose this directly
      uptime: 'active'
    };

    console.log('HEALTH_CHECK', JSON.stringify(checks));
    
    return {
      status: 'healthy',
      checks
    };
  }
}

// Create global instance
export const telemetry = new SimpleTelemetry();

// Helper functions for easy integration
export async function trackAIServiceCall<T>(
  operation: string,
  aiService: 'claude-anthropic' | 'workers-ai' | 'fallback',
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    await telemetry.trackAICall(operation, aiService, Date.now() - startTime, true, undefined, metadata);
    return result;
  } catch (error) {
    await telemetry.trackAICall(operation, aiService, Date.now() - startTime, false, (error as Error).message, metadata);
    throw error;
  }
}

export async function trackConversationFlow<T>(
  operation: string,
  sessionId: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  try {
    const result = await fn();
    await telemetry.trackConversation(operation, sessionId, undefined, undefined, true, metadata);
    return result;
  } catch (error) {
    await telemetry.trackConversation(operation, sessionId, undefined, undefined, false, { 
      error: (error as Error).message,
      ...metadata 
    });
    throw error;
  }
}

// Simple test function for telemetry
export async function sendTestTelemetryData(env: any, testData: any): Promise<any> {
  console.log('Testing simple telemetry system with data:', testData);
  
  try {
    await telemetry.trackAICall('test_ai_call', 'claude-anthropic', 100, true, undefined, testData);
    await telemetry.trackConversation('test_conversation', 'test-session', 'test-user', 'test-firm', true, testData);
    
    const healthCheck = await telemetry.healthCheck();
    
    return {
      success: true,
      testData,
      healthCheck,
      message: 'Simple telemetry test completed successfully'
    };
  } catch (error) {
    console.error('Telemetry test failed:', error);
    throw error;
  }
}