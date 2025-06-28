// OpenTelemetry configuration for Cloudflare Workers with Pydantic Logfire
import { trace, metrics, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { OTLPExporter, type ConfigurationOption } from '@microlabs/otel-cf-workers';

// Telemetry configuration interface
interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  logfireToken?: string;
  logfireEndpoint: string;
}

// Global telemetry state
let isInitialized = false;

// Manual telemetry sender for debugging
export async function sendTestTelemetryData(env: any, testData: any): Promise<any> {
  if (!env.LOGFIRE_TOKEN) {
    console.log('❌ No LOGFIRE_TOKEN available');
    return { error: 'No Logfire token' };
  }

  try {
    console.log('🚀 Sending test telemetry to Logfire...');
    
    // Create a simple OTLP trace manually
    const traceData = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: `engage-legal-ai-${env.ENVIRONMENT}` } },
            { key: 'service.version', value: { stringValue: '0.1.0' } },
            { key: 'test.manual', value: { stringValue: 'true' } }
          ]
        },
        scopeSpans: [{
          scope: { name: 'engage-legal-ai', version: '0.1.0' },
          spans: [{
            traceId: generateTraceId(),
            spanId: generateSpanId(),
            name: 'manual-test-span',
            kind: 1, // SPAN_KIND_INTERNAL
            startTimeUnixNano: String(Date.now() * 1000000),
            endTimeUnixNano: String((Date.now() + 100) * 1000000),
            attributes: [
              { key: 'test.type', value: { stringValue: 'manual-telemetry' } },
              { key: 'test.data', value: { stringValue: JSON.stringify(testData) } }
            ]
          }]
        }]
      }]
    };

    // Try JSON first to debug, then we'll switch to protobuf
    const response = await fetch('https://logfire-api.pydantic.dev/v1/traces', {
      method: 'POST', 
      headers: {
        'Authorization': `Bearer ${env.LOGFIRE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(traceData)
    });

    console.log(`📊 Logfire response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Logfire error: ${errorText}`);
      return { error: `HTTP ${response.status}: ${errorText}` };
    }

    return { success: true, status: response.status };
  } catch (error) {
    console.log(`❌ Telemetry send failed: ${(error as Error).message}`);
    return { error: (error as Error).message };
  }
}

function generateTraceId(): string {
  return Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function generateSpanId(): string {
  return Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Create OpenTelemetry configuration for Pydantic Logfire
export function createTelemetryConfig(env: any): ConfigurationOption {
  const config: TelemetryConfig = {
    serviceName: `engage-legal-ai-${env.ENVIRONMENT || 'development'}`,
    serviceVersion: '0.1.0',
    environment: env.ENVIRONMENT || 'development',
    logfireToken: env.LOGFIRE_TOKEN,
    logfireEndpoint: 'https://logfire-api.pydantic.dev/v1/traces'
  };

  console.log(`🔍 Telemetry Config Debug:`, {
    serviceName: config.serviceName,
    endpoint: config.logfireEndpoint,
    hasToken: !!config.logfireToken,
    tokenPrefix: config.logfireToken ? config.logfireToken.substring(0, 15) : 'missing'
  });

  return {
    service: {
      name: config.serviceName,
      version: config.serviceVersion,
      namespace: 'lexara'
    },
    tracing: {
      exporter: {
        url: config.logfireEndpoint,
        headers: config.logfireToken ? {
          'Authorization': `Bearer ${config.logfireToken}`
        } : {
          'X-Debug': 'No-Logfire-Token'
        }
      },
      fetch: {
        includeTraceContext: true,
        requestHook: (span, request) => {
          console.log(`📊 Trace Started: ${request.method} ${request.url}`);
          span.setAttributes({
            'http.url': request.url,
            'http.method': request.method,
            'user_agent.original': request.headers.get('User-Agent') || 'unknown',
            'debug.test': 'logfire-integration'
          });
        },
        responseHook: (span, response) => {
          console.log(`📊 Trace Ending: ${response.status} ${response.statusText}`);
          span.setAttributes({
            'http.status_code': response.status,
            'http.status_text': response.statusText
          });
          
          if (response.status >= 400) {
            span.setStatus({ code: SpanStatusCode.ERROR });
          }
        }
      }
    }
  };
}

// Initialize telemetry (lightweight - just set a flag)
export function initializeTelemetry(env: any): void {
  if (!isInitialized) {
    isInitialized = true;
    console.log(`✅ Telemetry ready for ${env.OTEL_SERVICE_NAME || 'engage-legal-ai'}`);
  }
}

// Get tracer instance
export function getTracer(name: string = 'engage-legal-ai') {
  return trace.getTracer(name, '0.1.0');
}

// Get meter instance
export function getMeter(name: string = 'engage-legal-ai') {
  return metrics.getMeter(name, '0.1.0');
}

// Trace AI service calls with detailed attributes
export async function traceAICall<T>(
  operation: string,
  aiService: 'claude-anthropic' | 'workers-ai' | 'fallback',
  fn: () => Promise<T>,
  attributes: Record<string, any> = {}
): Promise<T> {
  const tracer = getTracer();
  
  return tracer.startActiveSpan(`ai.${operation}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'ai.service': aiService,
      'ai.operation': operation,
      ...attributes
    }
  }, async (span) => {
    try {
      const result = await fn();
      
      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttributes({
        'ai.success': true,
        'ai.response.received': true
      });
      
      return result;
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: (error as Error).message 
      });
      span.setAttributes({
        'ai.success': false,
        'ai.error.type': (error as Error).name,
        'ai.error.message': (error as Error).message
      });
      
      throw error;
    } finally {
      span.end();
    }
  });
}

// Trace conversation operations
export async function traceConversation<T>(
  operation: string,
  fn: () => Promise<T>,
  attributes: {
    sessionId?: string;
    userId?: string;
    firmId?: string;
    phase?: string;
    isAuthenticated?: boolean;
    messageCount?: number;
  } = {}
): Promise<T> {
  const tracer = getTracer();
  
  return tracer.startActiveSpan(`conversation.${operation}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'conversation.operation': operation,
      'conversation.session_id': attributes.sessionId,
      'conversation.user_id': attributes.userId,
      'conversation.firm_id': attributes.firmId,
      'conversation.phase': attributes.phase,
      'conversation.authenticated': attributes.isAuthenticated,
      'conversation.message_count': attributes.messageCount
    }
  }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: (error as Error).message 
      });
      span.setAttributes({
        'conversation.error.type': (error as Error).name,
        'conversation.error.message': (error as Error).message
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

// Trace Durable Object operations
export async function traceDurableObject<T>(
  operation: string,
  objectType: 'conversation-session' | 'firm-registry' | 'user-identity',
  fn: () => Promise<T>,
  attributes: Record<string, any> = {}
): Promise<T> {
  const tracer = getTracer();
  
  return tracer.startActiveSpan(`durable_object.${operation}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'durable_object.type': objectType,
      'durable_object.operation': operation,
      ...attributes
    }
  }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: (error as Error).message 
      });
      span.setAttributes({
        'durable_object.error.type': (error as Error).name,
        'durable_object.error.message': (error as Error).message
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

// Trace external API calls (Anthropic, Auth0, etc.)
export async function traceExternalAPI<T>(
  service: string,
  operation: string,
  url: string,
  fn: () => Promise<T>,
  attributes: Record<string, any> = {}
): Promise<T> {
  const tracer = getTracer();
  
  return tracer.startActiveSpan(`external_api.${service}.${operation}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'http.url': url,
      'external_api.service': service,
      'external_api.operation': operation,
      ...attributes
    }
  }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: (error as Error).message 
      });
      span.setAttributes({
        'external_api.error.type': (error as Error).name,
        'external_api.error.message': (error as Error).message
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

// Legal-specific telemetry utilities
export function addLegalContextAttributes(attributes: {
  areaOfLaw?: string;
  caseType?: string;
  jurisdiction?: string;
  conflictStatus?: 'clear' | 'conflict_detected' | 'needs_check';
  userContactInfo?: {
    hasEmail?: boolean;
    hasPhone?: boolean;
    hasAddress?: boolean;
  };
}) {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes({
      'legal.area_of_law': attributes.areaOfLaw,
      'legal.case_type': attributes.caseType,
      'legal.jurisdiction': attributes.jurisdiction,
      'legal.conflict_status': attributes.conflictStatus,
      'legal.user.has_email': attributes.userContactInfo?.hasEmail,
      'legal.user.has_phone': attributes.userContactInfo?.hasPhone,
      'legal.user.has_address': attributes.userContactInfo?.hasAddress
    });
  }
}

// Create custom metrics for legal AI platform
export function createEngageMetrics() {
  const meter = getMeter();
  
  return {
    conversationCounter: meter.createCounter('engage.conversations.total', {
      description: 'Total number of conversations started'
    }),
    
    messagesCounter: meter.createCounter('engage.messages.total', {
      description: 'Total number of messages processed'
    }),
    
    aiCallDuration: meter.createHistogram('engage.ai_calls.duration', {
      description: 'Duration of AI service calls in milliseconds',
      unit: 'ms'
    }),
    
    conflictCheckCounter: meter.createCounter('engage.conflict_checks.total', {
      description: 'Total number of conflict checks performed'
    }),
    
    goalCompletionCounter: meter.createCounter('engage.goals.completed', {
      description: 'Total number of conversation goals completed'
    }),
    
    errorCounter: meter.createCounter('engage.errors.total', {
      description: 'Total number of errors by type'
    })
  };
}

// Helper to safely add attributes without breaking if telemetry fails
export function safeAddAttributes(attributes: Record<string, any>) {
  try {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  } catch (error) {
    // Silently fail to prevent telemetry from breaking the application
    console.warn('Failed to add telemetry attributes:', error);
  }
}

// Telemetry is ready state
export function isTelemetryInitialized(): boolean {
  return isInitialized;
}