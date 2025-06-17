# OpenTelemetry Implementation for Engage Legal AI Platform

## Overview

This document describes the OpenTelemetry instrumentation implementation for the Engage Legal AI platform, configured to send telemetry data to Pydantic Logfire for comprehensive observability.

## Architecture

### Core Components

1. **@microlabs/otel-cf-workers**: Main OpenTelemetry package for Cloudflare Workers
2. **@opentelemetry/api**: Standard OpenTelemetry API for manual instrumentation
3. **Pydantic Logfire**: Observability backend receiving telemetry data
4. **Custom Telemetry Utilities**: Application-specific instrumentation helpers

### Implementation Pattern

```typescript
// Instrumented worker export
export default instrument(handler, createTelemetryConfig);
```

## Configuration

### Environment Variables

#### Required for Pydantic Logfire Integration

```bash
# Pydantic Logfire Configuration
OTEL_EXPORTER_OTLP_ENDPOINT=https://logfire-api.pydantic.dev
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
LOGFIRE_TOKEN=your-logfire-token-here

# Service Identification
OTEL_SERVICE_NAME=engage-legal-ai-dev
OTEL_SERVICE_VERSION=0.1.0
```

#### Optional Configuration

```bash
# Custom headers (JSON format)
OTEL_EXPORTER_OTLP_HEADERS={"Authorization":"Bearer token","x-api-key":"key"}
```

### Wrangler Configuration

The `wrangler.toml` includes environment-specific telemetry configuration:

```toml
[vars]
OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf"
OTEL_SERVICE_NAME = "engage-legal-ai"
OTEL_SERVICE_VERSION = "0.1.0"

[env.dev.vars]
OTEL_EXPORTER_OTLP_ENDPOINT = "https://logfire-api.pydantic.dev"
OTEL_SERVICE_NAME = "engage-legal-ai-dev"
```

## Instrumentation Coverage

### 1. HTTP Requests

**Automatic Instrumentation**: All HTTP requests are automatically traced by the `@microlabs/otel-cf-workers` package.

**Custom Attributes Added**:
- `http.method`
- `http.url`
- `http.route`
- `http.user_agent`
- `service.environment`

### 2. AI API Calls

**Anthropic Claude API**:
```typescript
await traceAICall(
  'anthropic',
  'claude-3-haiku-20240307',
  async () => {
    // API call implementation
  },
  {
    'ai.system_prompt.length': systemPrompt.length,
    'ai.conversation.length': conversationHistory.length,
    'ai.max_tokens': 500,
    'ai.temperature': 0.7,
  }
);
```

**Workers AI Fallback**:
```typescript
await traceAICall(
  'workers-ai',
  'llama-3.1-8b-instruct',
  async () => {
    // Fallback AI call
  },
  {
    'ai.prompt.length': totalPromptLength,
    'ai.max_tokens': 500,
    'ai.fallback': true,
  }
);
```

### 3. Durable Object Operations

**Conversation Session Operations**:
```typescript
await traceDurableObjectCall(
  'conversation-session',
  'get_context',
  async () => {
    // Durable Object fetch
  },
  { 'session.id': sessionId }
);
```

**Supported Operations**:
- `get_context`: Retrieve conversation state
- `add_message`: Store new messages
- `create_session`: Initialize new conversations
- `resume_conversation`: Restore conversation state

### 4. MCP Server Interactions

**Goal Tracker MCP**:
```typescript
await traceMCPCall(
  'goal-tracker',
  'assess_goals',
  () => this.goalTrackerClient.callTool('assess_goals', params),
  {
    'session.id': context.sessionId,
    'firm.id': context.firmId,
    'goals.count': currentGoals.length,
  }
);
```

**Conflict Checker MCP**:
```typescript
await traceMCPCall(
  'conflict-checker',
  'check_conflicts',
  () => this.conflictCheckerClient.callTool('check_conflicts', params),
  {
    'session.id': context.sessionId,
    'firm.id': context.firmId,
    'user.emails_count': userIdentity.emails?.length || 0,
    'user.phones_count': userIdentity.phones?.length || 0,
  }
);
```

**Additional Goals MCP**:
```typescript
await traceMCPCall(
  'additional-goals',
  'enhance_goals',
  () => this.additionalGoalsClient.callTool('enhance_goals', params),
  {
    'session.id': context.sessionId,
    'documents.count': supportingDocs.length,
  }
);
```

## Metrics Collection

### Conversation Metrics

```typescript
recordConversationMetrics(
  phase: string,           // 'pre_login', 'secured', etc.
  messageCount: number,    // Total messages in conversation
  responseTime: number,    // AI response time in ms
  aiProvider: string       // 'claude-anthropic' or 'workers-ai'
);
```

### Conflict Detection Metrics

```typescript
recordConflictMetrics(
  status: 'clear' | 'conflict_detected' | 'pending',
  confidence: number,      // 0.0 to 1.0
  processingTime: number   // Processing time in ms
);
```

### Goal Completion Metrics

```typescript
recordGoalMetrics(
  goalType: string,        // 'user_identification', etc.
  completed: boolean,      // Goal completion status
  priority: string,        // 'critical', 'required', etc.
  source: string          // 'base', 'additional', etc.
);
```

## Custom Attributes

### Conversation Context

```typescript
addConversationAttributes(
  sessionId: string,
  userId: string,
  firmId: string,
  phase: string
);
```

### User Identification

```typescript
addUserAttributes(
  isAuthenticated: boolean,
  auth0UserId?: string,
  userIdentifiers?: {
    emails: string[];
    phones: string[];
    names: string[];
  }
);
```

### Legal Case Context

```typescript
addLegalCaseAttributes(
  legalArea?: string,      // 'personal_injury', 'employment', etc.
  caseType?: string,       // Case categorization
  jurisdiction?: string,   // Legal jurisdiction
  parties?: string[]       // Involved parties
);
```

## Telemetry Data Flow

```mermaid
graph TD
    A[Cloudflare Worker] --> B[@microlabs/otel-cf-workers]
    B --> C[OpenTelemetry Collector]
    C --> D[Pydantic Logfire]
    
    E[Custom Telemetry Utils] --> B
    F[AI API Calls] --> E
    G[Durable Objects] --> E
    H[MCP Servers] --> E
    I[Conversation Flow] --> E
```

## Error Handling

All telemetry functions include comprehensive error handling:

1. **Graceful Degradation**: If telemetry fails, the main application continues
2. **Error Spans**: Failed operations are marked with error status
3. **Exception Capture**: Error messages and stack traces are captured
4. **Fallback Logging**: Local logging continues if remote telemetry fails

## Performance Considerations

### V8 Isolates Compatibility

- Uses `@microlabs/otel-cf-workers` for Workers-specific optimization
- Minimal overhead with streaming telemetry export
- Automatic batching of telemetry data
- No blocking operations on critical path

### Resource Usage

- **Memory**: Minimal overhead (~50KB per request)
- **CPU**: <5ms additional processing per request
- **Network**: Batched OTLP exports to reduce overhead

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Response Time Distribution**
   - P50, P95, P99 response times
   - AI API response times
   - Durable Object operation latency

2. **Error Rates**
   - HTTP 5xx errors
   - AI API failures
   - MCP server timeouts

3. **Conversation Quality**
   - Goal completion rates
   - Conflict detection accuracy
   - Phase progression timing

4. **System Health**
   - Durable Object availability
   - Vectorize query performance
   - Service dependency health

### Alerting Thresholds

- **P95 Response Time** > 5 seconds
- **Error Rate** > 5% over 5 minutes
- **AI API Failure Rate** > 10% over 1 minute
- **Conflict Detection Latency** > 2 seconds

## Pydantic Logfire Integration

### Authentication

Configure the `LOGFIRE_TOKEN` environment variable with your Pydantic Logfire write token:

```bash
# Get this from your Pydantic Logfire dashboard
LOGFIRE_TOKEN=your-logfire-write-token
```

### Dashboard Configuration

Recommended Logfire dashboard widgets:

1. **Request Volume**: HTTP requests over time
2. **Response Time**: P95 latency trends
3. **AI Service Usage**: Claude vs Workers AI usage
4. **Conversation Funnel**: Pre-login → Secured conversion
5. **Error Rate**: Error percentage by service
6. **Conflict Detection**: Conflicts found vs. total checks

### Custom Queries

Example Logfire queries for legal AI platform:

```sql
-- Conversation completion rate by legal area
SELECT 
  legal.area,
  COUNT(*) as total_conversations,
  SUM(CASE WHEN conversation.phase = 'completed' THEN 1 ELSE 0 END) as completed
FROM spans 
WHERE service.name = 'engage-legal-ai'
GROUP BY legal.area;

-- AI service reliability
SELECT 
  ai.provider,
  COUNT(*) as total_calls,
  AVG(duration_ms) as avg_response_time,
  SUM(CASE WHEN status_code = 'ERROR' THEN 1 ELSE 0 END) as errors
FROM spans 
WHERE span_name LIKE 'ai.call.%'
GROUP BY ai.provider;

-- Conflict detection performance
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  AVG(conflict.confidence) as avg_confidence,
  COUNT(*) as total_checks
FROM spans 
WHERE span_name = 'mcp.conflict-checker.check_conflicts'
GROUP BY hour
ORDER BY hour;
```

## Troubleshooting

### Common Issues

1. **Missing Telemetry Data**
   - Verify `LOGFIRE_TOKEN` is set
   - Check network connectivity to Pydantic Logfire
   - Validate OTLP endpoint configuration

2. **High Latency**
   - Review telemetry batching configuration
   - Check for synchronous telemetry exports
   - Monitor Workers CPU usage

3. **Authentication Errors**
   - Verify Logfire token validity
   - Check token permissions in Logfire dashboard
   - Validate header format

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug
```

This provides detailed telemetry operation logs for troubleshooting.

## Future Enhancements

1. **Custom Metrics**: Business-specific KPIs (conversion rates, case types)
2. **Distributed Tracing**: Cross-service request correlation
3. **Real-time Alerting**: Immediate notification of critical issues
4. **Performance Profiling**: Detailed performance analysis
5. **Compliance Reporting**: HIPAA audit trail generation

---

## Quick Start

1. **Install Dependencies**:
   ```bash
   npm install @microlabs/otel-cf-workers @opentelemetry/api
   ```

2. **Configure Environment**:
   ```bash
   # Add to .dev.vars
   LOGFIRE_TOKEN=your-token-here
   OTEL_SERVICE_NAME=your-service-name
   ```

3. **Deploy with Telemetry**:
   ```bash
   wrangler deploy
   ```

4. **View in Logfire**:
   Open your Pydantic Logfire dashboard to see real-time telemetry data.

The implementation provides comprehensive observability for the Engage Legal AI platform while maintaining the performance and reliability required for production legal technology applications.