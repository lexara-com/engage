# Engage System - API Reference

## Overview

The Engage system exposes multiple API layers:
1. **Main Agent API** - Core conversation management
2. **Frontend Proxy APIs** - UI-backend bridge with format conversion
3. **MCP Server APIs** - Tool-specific functionality (internal)

## Main Agent API

**Base URL**: `https://engage-legal-ai-production.cloudswift.workers.dev`

### Authentication
- No authentication required for current version
- Future versions will use Auth0 OAuth2

### Error Handling
All endpoints return errors in this format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}
```

### Endpoints

#### Create Conversation Session
```http
POST /api/v1/conversations
```

**Request Body**:
```json
{
  "firmId": "string (required)",
  "userId": "string (optional)",
  "metadata": {
    "clientIp": "string (optional)",
    "userAgent": "string (optional)",
    "referrer": "string (optional)"
  }
}
```

**Response** (200):
```json
{
  "sessionId": "00MBMJQKLR3T637334K5X4Z1Y3",
  "userId": "00MBMJQKUO3K701Y4P1D3V1332", 
  "resumeUrl": "http://durable-object/api/v1/conversations/resume/...",
  "phase": "pre_login",
  "isAuthenticated": false,
  "preLoginGoals": {
    "userIdentification": false,
    "conflictCheck": false,
    "legalNeedsAssessment": false
  }
}
```

**Example**:
```bash
curl -X POST "https://engage-legal-ai-production.cloudswift.workers.dev/api/v1/conversations" \
  -H "Content-Type: application/json" \
  -d '{"firmId": "firm_test_123"}'
```

#### Send Message
```http
POST /api/v1/conversations/message
```

**Request Body**:
```json
{
  "sessionId": "string (required)",
  "message": "string (required)",
  "metadata": {
    "timestamp": "ISO 8601 string (optional)",
    "clientIp": "string (optional)"
  }
}
```

**Response** (200):
```json
{
  "message": "AI response text",
  "suggestLogin": false,
  "conversationComplete": false,
  "resumeUrl": "http://durable-object/api/v1/conversations/resume/...",
  "goals": {
    "userIdentification": true,
    "conflictCheck": false,
    "legalNeedsAssessment": true
  }
}
```

**Example**:
```bash
curl -X POST "https://engage-legal-ai-production.cloudswift.workers.dev/api/v1/conversations/message" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "SESSION_ID", "message": "Hello, I need legal help with a contract dispute"}'
```

#### Get Conversation State
```http
GET /api/v1/conversations/{sessionId}
```

**Parameters**:
- `sessionId` (path): The conversation session ID

**Response** (200):
```json
{
  "sessionId": "00MBMJQKLR3T637334K5X4Z1Y3",
  "userId": "00MBMJQKUO3K701Y4P1D3V1332",
  "phase": "pre_login",
  "isAuthenticated": false,
  "goals": {
    "userIdentification": true,
    "conflictCheck": false,
    "legalNeedsAssessment": true
  },
  "messages": [
    {
      "id": "msg_1701234567890_abc123",
      "role": "user",
      "content": "Hello, I need legal help",
      "timestamp": "2025-06-07T18:00:00.000Z"
    },
    {
      "id": "msg_1701234567891_def456", 
      "role": "assistant",
      "content": "I'm happy to help you...",
      "timestamp": "2025-06-07T18:00:05.000Z"
    }
  ],
  "createdAt": "2025-06-07T18:00:00.000Z",
  "updatedAt": "2025-06-07T18:00:05.000Z"
}
```

**Error Responses**:
- `404`: Session not found
- `500`: Internal server error

## Frontend Proxy APIs

**Base URL**: `https://d7fdb312.engage-ui.pages.dev` (current deployment)

These APIs provide compatibility between the frontend and backend, handling format conversion and streaming.

### Create Session (Proxy)
```http
POST /api/chat/session
```

**Request Body**:
```json
{
  "firmId": "string (required)"
}
```

**Response** (200):
```json
{
  "success": true,
  "sessionId": "00MBMJQKLR3T637334K5X4Z1Y3",
  "data": {
    "sessionId": "00MBMJQKLR3T637334K5X4Z1Y3",
    "userId": "00MBMJQKUO3K701Y4P1D3V1332",
    "resumeUrl": "http://durable-object/api/v1/conversations/resume/...",
    "phase": "pre_login",
    "isAuthenticated": false,
    "preLoginGoals": {
      "userIdentification": false,
      "conflictCheck": false,
      "legalNeedsAssessment": false
    }
  }
}
```

**Error Response** (500):
```json
{
  "success": false,
  "error": "Failed to create session"
}
```

### Send Message (Proxy with Streaming)
```http
POST /api/chat
```

**Request Body**:
```json
{
  "sessionId": "string (required)",
  "message": "string (required)",
  "stream": true
}
```

**Response** (200, Server-Sent Events):
```
Content-Type: text/event-stream

data: {"type":"chunk","content":"Hello, I'm happy to assist you..."}

data: {"type":"complete"}
```

**Stream Event Types**:
- `chunk`: Partial message content
- `complete`: Message finished
- `error`: Error occurred during processing

**Example**:
```bash
curl -X POST "https://d7fdb312.engage-ui.pages.dev/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "SESSION_ID", "message": "Hello", "stream": true}'
```

### Get Session (Proxy)
```http
GET /api/chat/session/{sessionId}
```

**Parameters**:
- `sessionId` (path): The session ID to retrieve

**Response** (200):
```json
{
  "success": true,
  "data": {
    "sessionId": "00MBMJQKLR3T637334K5X4Z1Y3",
    "messages": [...],
    "goals": {...},
    "createdAt": "2025-06-07T18:00:00.000Z",
    "updatedAt": "2025-06-07T18:00:05.000Z"
  }
}
```

**Error Response** (404):
```json
{
  "success": false,
  "error": "Session not found"
}
```

## MCP Server APIs (Internal)

These APIs are used internally by the main agent to communicate with MCP servers. They follow the JSON-RPC 2.0 specification.

### Common MCP Request Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {
      "arg1": "value1",
      "arg2": "value2"
    }
  }
}
```

### Common MCP Response Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool execution result"
      }
    ]
  }
}
```

### GoalTracker MCP API

**Base URL**: `https://goal-tracker-mcp-production.cloudswift.workers.dev`

#### Tools Available

##### initialize_goals
Initialize data gathering goals for a session.

**Arguments**:
```json
{
  "sessionId": "string (required)",
  "practiceArea": "string (required)"
}
```

**Practice Areas**: `contract_law`, `personal_injury`, `family_law`, `criminal_law`, `business_law`, `real_estate`, `employment_law`

**Example**:
```bash
curl -X POST "https://goal-tracker-mcp-production.cloudswift.workers.dev/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "initialize_goals",
      "arguments": {
        "sessionId": "test_session_123",
        "practiceArea": "contract_law"
      }
    }
  }'
```

##### update_goal_progress
Update progress on a specific goal.

**Arguments**:
```json
{
  "sessionId": "string (required)",
  "goalId": "string (required)", 
  "status": "pending | in_progress | completed (required)",
  "evidence": "string (optional)"
}
```

##### get_goals_status
Get current status of all goals for a session.

**Arguments**:
```json
{
  "sessionId": "string (required)"
}
```

##### are_goals_complete
Check if all goals for a session are completed.

**Arguments**:
```json
{
  "sessionId": "string (required)"
}
```

### ConflictChecker MCP API

**Base URL**: `https://conflict-checker-mcp-production.cloudswift.workers.dev`

#### Tools Available

##### add_conflict_entry
Add a new conflict entry to the vector database.

**Arguments**:
```json
{
  "name": "string (required)",
  "relationship": "string (required)",
  "details": "string (required)",
  "metadata": "object (optional)"
}
```

**Relationship Types**: `client`, `opposing_party`, `witness`, `co_counsel`, `adverse_counsel`, `judge`, `expert_witness`

##### search_conflicts
Search for potential conflicts using semantic similarity.

**Arguments**:
```json
{
  "query": "string (required)",
  "threshold": "number (optional, default: 0.75)"
}
```

**Response Example**:
```json
{
  "content": [
    {
      "type": "text", 
      "text": "Found 2 potential conflicts:\n1. John Smith (client) - Contract dispute with ABC Corp\n2. ABC Corporation (opposing_party) - Employment lawsuit"
    }
  ]
}
```

##### list_conflicts
List all conflicts in the database (for administration).

**Arguments**:
```json
{
  "limit": "number (optional, default: 50)",
  "offset": "number (optional, default: 0)"
}
```

### AdditionalGoals MCP API

**Base URL**: `https://additional-goals-mcp-production.cloudswift.workers.dev`

#### Tools Available

##### add_document
Add a supporting document to enhance data gathering.

**Arguments**:
```json
{
  "title": "string (required)",
  "content": "string (required)",
  "practiceArea": "string (required)",
  "metadata": "object (optional)"
}
```

##### search_documents
Search supporting documents for additional data requirements.

**Arguments**:
```json
{
  "query": "string (required)",
  "practiceArea": "string (optional)",
  "limit": "number (optional, default: 10)"
}
```

**Response Example**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 3 relevant documents:\n1. Contract Dispute Checklist - Requires: contract terms, breach details, damages\n2. Employment Law Guide - Additional info needed: employment dates, specific violations\n3. Personal Injury Intake - Must gather: accident details, medical records, insurance info"
    }
  ]
}
```

##### list_documents
List all supporting documents.

**Arguments**:
```json
{
  "practiceArea": "string (optional)",
  "limit": "number (optional, default: 50)",
  "offset": "number (optional, default: 0)"
}
```

## Rate Limits

Current system has no enforced rate limits, but recommended limits for production:

- **Session Creation**: 10 requests per minute per IP
- **Message Sending**: 30 requests per minute per session
- **MCP Tool Calls**: 100 requests per minute per tool

## Error Codes

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (invalid API key)
- `404`: Not Found (session/resource not found)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error
- `503`: Service Unavailable (temporary outage)

### Custom Error Codes
- `SESSION_NOT_FOUND`: Session ID does not exist
- `INVALID_FIRM_ID`: Firm ID is invalid or not configured
- `MCP_SERVER_ERROR`: Error communicating with MCP server
- `ANTHROPIC_API_ERROR`: Error from Claude API
- `GOAL_INITIALIZATION_FAILED`: Failed to initialize conversation goals
- `CONFLICT_CHECK_FAILED`: Failed to check for conflicts
- `VECTORIZE_ERROR`: Error with vector database operations

## Client Libraries

### JavaScript/TypeScript
```typescript
// Frontend API Client (included in utils/chat.ts)
export class EngageApiClient {
  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl || window.location.origin;
  }
  
  async createSession(): Promise<ApiResponse<{ sessionId: string }>> {
    const response = await fetch(`${this.baseUrl}/api/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firmId: 'firm_test_123' })
    });
    return await response.json();
  }
  
  async sendMessage(sessionId: string, message: string): Promise<ReadableStream<Uint8Array> | null> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message, stream: true })
    });
    return response.body;
  }
}
```

### Backend Integration
```typescript
// MCP Client (included in agent/mcp-client.ts)
export class McpClient {
  async callTool(serverUrl: string, toolName: string, args: any) {
    const response = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'tools/call',
        params: { name: toolName, arguments: args }
      })
    });
    
    const result = await response.json();
    if (result.error) {
      throw new Error(`MCP error: ${result.error.message}`);
    }
    return result.result;
  }
}
```

## Testing Tools

### API Testing Script
```bash
#!/bin/bash
# test-apis.sh

BASE_URL="https://engage-legal-ai-production.cloudswift.workers.dev"
UI_URL="https://d7fdb312.engage-ui.pages.dev"

echo "Testing session creation..."
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/conversations" \
  -H "Content-Type: application/json" \
  -d '{"firmId": "firm_test_123"}')

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.sessionId')
echo "Created session: $SESSION_ID"

echo "Testing message sending..."
MESSAGE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/conversations/message" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"Hello, I need legal help\"}")

echo "AI Response: $(echo $MESSAGE_RESPONSE | jq -r '.message')"

echo "Testing UI session creation..."
UI_SESSION_RESPONSE=$(curl -s -X POST "$UI_URL/api/chat/session" \
  -H "Content-Type: application/json" \
  -d '{"firmId": "firm_test_123"}')

echo "UI Session Success: $(echo $UI_SESSION_RESPONSE | jq -r '.success')"
```

### Postman Collection
```json
{
  "info": {
    "name": "Engage Legal AI API",
    "description": "Complete API collection for testing Engage system"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "https://engage-legal-ai-production.cloudswift.workers.dev"
    },
    {
      "key": "uiUrl", 
      "value": "https://d7fdb312.engage-ui.pages.dev"
    }
  ],
  "item": [
    {
      "name": "Create Session",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/v1/conversations",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"firmId\": \"firm_test_123\"}"
        }
      }
    }
  ]
}
```

This API reference provides complete documentation for all endpoints and integration patterns used in the Engage system.