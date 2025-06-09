# Engage System - Technical Reference

## Quick Reference Commands

### Deployment Commands
```bash
# Full system deployment (run in order)
cd workers/goal-tracker-mcp && wrangler deploy --env production
cd ../conflict-checker-mcp && wrangler deploy --env production  
cd ../additional-goals-mcp && wrangler deploy --env production
cd ../.. && npm run deploy:production
npm run build:ui && npx wrangler pages deploy dist --project-name engage-ui

# Individual component deployment
wrangler deploy --env production                    # Main agent
npx wrangler pages deploy dist --project-name engage-ui  # Frontend

# Check deployment status
wrangler deployments list --env production
```

### Development Setup
```bash
# Terminal 1: Main agent
npm run dev

# Terminal 2: Frontend  
npm run dev:ui

# Terminal 3: MCP servers (run each in separate terminals)
cd workers/goal-tracker-mcp && wrangler dev
cd workers/conflict-checker-mcp && wrangler dev
cd workers/additional-goals-mcp && wrangler dev
```

### Secrets Management
```bash
# Set API key (CRITICAL - must be done for production)
echo "sk-ant-api-03-..." | wrangler secret put ANTHROPIC_API_KEY --env production

# List all secrets
wrangler secret list --env production

# Delete and recreate if issues
wrangler secret delete ANTHROPIC_API_KEY --env production
echo "sk-ant-..." | wrangler secret put ANTHROPIC_API_KEY --env production
```

## File Structure Reference

```
/Users/shawnswaner/code/lexara/cf_version/
├── CLAUDE.md                          # Project requirements
├── ENGAGE_SYSTEM_DOCUMENTATION.md     # Complete system docs
├── TECHNICAL_REFERENCE.md             # This file
├── wrangler.toml                      # Main deployment config
├── package.json                       # Dependencies and scripts
├── astro.config.mjs                   # Frontend build config
├── src/
│   ├── index.ts                       # Main worker entry point
│   ├── agent/
│   │   ├── claude-agent.ts            # AI agent core logic
│   │   ├── conversation-session.ts    # Durable Object session management
│   │   └── mcp-client.ts              # MCP communication client
│   ├── pages/
│   │   ├── index.astro                # Main chat page
│   │   └── api/
│   │       ├── chat.ts                # Message proxy with streaming
│   │       └── chat/
│   │           ├── session.ts         # Session creation proxy
│   │           └── session/[id].ts    # Session retrieval proxy
│   ├── components/
│   │   ├── ChatWindow.astro           # Main chat interface
│   │   ├── InputArea.astro            # Message input component
│   │   ├── MessageBubble.astro        # Message display component
│   │   └── DisclaimerModal.astro      # Legal disclaimer
│   ├── utils/
│   │   └── chat.ts                    # Client utilities and API client
│   ├── types/
│   │   └── chat.ts                    # TypeScript interfaces
│   └── styles/
│       └── global.css                 # Tailwind and custom styles
└── workers/
    ├── goal-tracker-mcp/
    │   ├── wrangler.toml               # GoalTracker deployment config
    │   └── src/index.ts               # GoalTracker MCP server
    ├── conflict-checker-mcp/
    │   ├── wrangler.toml               # ConflictChecker deployment config
    │   └── src/index.ts               # ConflictChecker MCP server
    └── additional-goals-mcp/
        ├── wrangler.toml               # AdditionalGoals deployment config
        └── src/index.ts               # AdditionalGoals MCP server
```

## Critical Code Patterns

### 1. Session Creation Flow

**Frontend (ChatWindow.astro)**:
```typescript
private async initializeChat(sessionId?: string) {
  if (sessionId) {
    const response = await this.apiClient.getSession(sessionId);
    if (response.success && response.data) {
      this.session = response.data;
      return;
    }
  }
  
  // CRITICAL: Create backend session
  const createResponse = await this.apiClient.createSession();
  if (createResponse.success && createResponse.sessionId) {
    this.session = { ...this.session, id: createResponse.sessionId };
  }
  
  // Update URL with session ID
  const url = new URL(window.location.href);
  url.searchParams.set('session', this.session.id);
  window.history.replaceState({}, '', url.toString());
}
```

**API Proxy (src/pages/api/chat/session.ts)**:
```typescript
const data = await response.json();
// CRITICAL: Wrap response in expected format
return new Response(JSON.stringify({
  success: true,
  sessionId: data.sessionId,
  data: data
}), {
  headers: { 'Content-Type': 'application/json' }
});
```

### 2. MCP Communication Pattern

**MCP Client (src/agent/mcp-client.ts)**:
```typescript
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
```

### 3. Streaming Response Conversion

**Chat API (src/pages/api/chat.ts)**:
```typescript
// Convert JSON response to SSE format
const encoder = new TextEncoder();
const readable = new ReadableStream({
  start(controller) {
    const chunk = JSON.stringify({
      type: 'chunk',
      content: data.message
    });
    controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
    
    const complete = JSON.stringify({ type: 'complete' });
    controller.enqueue(encoder.encode(`data: ${complete}\n\n`));
    
    controller.close();
  }
});

return new Response(readable, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  }
});
```

### 4. Durable Object SQL Operations

**Conversation Session (src/agent/conversation-session.ts)**:
```typescript
async createConversation(sessionId: string, firmId: string) {
  await this.sql.exec(`
    INSERT INTO conversations (id, session_id, firm_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `, sessionId, sessionId, firmId, Date.now(), Date.now());
}

async addMessage(conversationId: string, role: string, content: string) {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await this.sql.exec(`
    INSERT INTO messages (id, conversation_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `, messageId, conversationId, role, content, Date.now());
}
```

## Configuration Templates

### Main wrangler.toml
```toml
name = "engage-legal-ai"
main = "src/index.ts"
compatibility_date = "2024-05-01"
workers_dev = true

[env.production]
name = "engage-legal-ai-production"
vars = {
  ENVIRONMENT = "production",
  GOAL_TRACKER_URL = "https://goal-tracker-mcp-production.cloudswift.workers.dev",
  CONFLICT_CHECKER_URL = "https://conflict-checker-mcp-production.cloudswift.workers.dev",
  ADDITIONAL_GOALS_URL = "https://additional-goals-mcp-production.cloudswift.workers.dev"
}

[[env.production.migrations]]
tag = "v1"
new_sqlite_classes = ["ConversationSession"]

[[env.production.durable_objects.bindings]]
name = "CONVERSATION_SESSION"
class_name = "ConversationSession"

[[env.production.vectorize.bindings]]
binding = "VECTORIZE_INDEX"
index_name = "engage-conflicts"

[[env.production.vectorize.bindings]]
binding = "ADDITIONAL_GOALS_INDEX"
index_name = "engage-goals"
```

### MCP Server wrangler.toml Template
```toml
name = "goal-tracker-mcp"
main = "src/index.ts"
compatibility_date = "2024-05-01"
workers_dev = true

[env.production]
name = "goal-tracker-mcp-production"
vars = { ENVIRONMENT = "production" }

[[env.production.migrations]]
tag = "v1"
new_sqlite_classes = ["GoalTracker"]

[[env.production.durable_objects.bindings]]
name = "GOAL_TRACKER"
class_name = "GoalTracker"
```

### astro.config.mjs
```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  integrations: [tailwind()],
  output: 'server',
  adapter: cloudflare(),
  server: {
    port: 4321,
    host: true
  }
});
```

## Troubleshooting Guide

### Problem: "Failed to create backend session: undefined"
**Symptoms**: Console shows session creation returning undefined
**Cause**: API response format mismatch
**Solution**: 
1. Check `/api/chat/session` returns `{success: true, sessionId: "..."}`
2. Verify backend URL is correct in API files
3. Test direct backend session creation:
```bash
curl -X POST "https://engage-legal-ai-production.cloudswift.workers.dev/api/v1/conversations" \
  -H "Content-Type: application/json" -d '{"firmId": "firm_test_123"}'
```

### Problem: "500 Internal Server Error" from chat
**Symptoms**: Chat messages fail with 500 errors
**Cause**: Usually ANTHROPIC_API_KEY issues
**Solution**:
1. Recreate the secret:
```bash
wrangler secret delete ANTHROPIC_API_KEY --env production
echo "sk-ant-..." | wrangler secret put ANTHROPIC_API_KEY --env production
```
2. Check logs: `wrangler tail --env production`
3. Verify MCP servers are responding

### Problem: Custom domain route errors
**Symptoms**: Deployment fails with route assignment errors
**Cause**: Custom domain not configured in Cloudflare
**Solution**: Use `workers_dev = true` in wrangler.toml

### Problem: MCP servers not responding
**Symptoms**: Agent fails to call MCP tools
**Cause**: MCP server URLs incorrect or servers down
**Solution**:
1. Test MCP servers directly:
```bash
curl -X POST "https://goal-tracker-mcp-production.cloudswift.workers.dev/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```
2. Check environment variables in wrangler.toml
3. Redeploy MCP servers if needed

### Problem: Frontend not updating
**Symptoms**: Code changes not reflected in UI
**Cause**: Build/deploy issues
**Solution**:
1. Clear build cache: `rm -rf dist .astro`
2. Rebuild: `npm run build:ui`
3. Redeploy: `npx wrangler pages deploy dist --project-name engage-ui`

## Testing Procedures

### Backend API Tests
```bash
# 1. Test session creation
SESSION_RESPONSE=$(curl -s -X POST "https://engage-legal-ai-production.cloudswift.workers.dev/api/v1/conversations" \
  -H "Content-Type: application/json" -d '{"firmId": "firm_test_123"}')
echo $SESSION_RESPONSE

# 2. Extract session ID and test message
SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.sessionId')
curl -X POST "https://engage-legal-ai-production.cloudswift.workers.dev/api/v1/conversations/message" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"Hello, I need legal help\"}"
```

### Frontend API Tests
```bash
# 1. Test UI session creation
UI_SESSION_RESPONSE=$(curl -s -X POST "https://d7fdb312.engage-ui.pages.dev/api/chat/session" \
  -H "Content-Type: application/json" -d '{"firmId": "firm_test_123"}')
echo $UI_SESSION_RESPONSE

# 2. Verify success format
echo $UI_SESSION_RESPONSE | jq -r '.success'  # Should be true
echo $UI_SESSION_RESPONSE | jq -r '.sessionId'  # Should be session ID
```

### MCP Server Tests
```bash
# Test each MCP server
for server in goal-tracker conflict-checker additional-goals; do
  echo "Testing $server..."
  curl -X POST "https://${server}-mcp-production.cloudswift.workers.dev/mcp" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
done
```

## Performance Monitoring

### Key Metrics Commands
```bash
# Check Worker analytics
wrangler metrics --env production

# Monitor real-time logs
wrangler tail --env production

# Check Vectorize usage
wrangler vectorize list

# Monitor Durable Objects
wrangler durable-objects namespace list
```

### Performance Optimization Settings
```typescript
// Claude API settings for optimal performance
const claudeConfig = {
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1000,  // Limit for faster responses
  temperature: 0.3,  // Lower for more consistent responses
  stream: false      // Disabled for simplicity
};

// Vector search optimization
const vectorSearchConfig = {
  topK: 10,           // Limit results
  threshold: 0.75,    // Similarity threshold
  namespace: firmId   // Isolate by firm
};
```

## Security Checklist

### Pre-deployment Security
- [ ] All API keys stored as Cloudflare secrets (not in code)
- [ ] CORS headers properly configured
- [ ] Input validation on all user inputs
- [ ] SQL queries use parameterized statements
- [ ] Rate limiting implemented on API endpoints
- [ ] Legal disclaimers present and functioning

### Post-deployment Security
- [ ] Monitor logs for suspicious activity
- [ ] Regular API key rotation
- [ ] Review vector database for sensitive information
- [ ] Audit conversation data retention policies
- [ ] Verify HTTPS enforcement across all endpoints

## Backup & Recovery

### Critical Data Locations
1. **Conversation Data**: Stored in Durable Objects (auto-replicated)
2. **Vector Data**: Stored in Vectorize indexes (auto-replicated)
3. **Configuration**: wrangler.toml files (in git repository)
4. **Secrets**: Cloudflare secrets (backup API keys separately)

### Recovery Procedures
```bash
# 1. Restore from git
git clone https://github.com/your-org/engage-legal-ai
cd engage-legal-ai

# 2. Recreate secrets
echo "sk-ant-..." | wrangler secret put ANTHROPIC_API_KEY --env production

# 3. Redeploy all components
./deploy-all.sh  # Create this script with full deployment commands

# 4. Verify all endpoints responding
./test-all-endpoints.sh  # Create this script with test commands
```

### Data Export (if needed)
```bash
# Export Vectorize data (when feature becomes available)
wrangler vectorize export engage-conflicts --output conflicts-backup.json
wrangler vectorize export engage-goals --output goals-backup.json

# Durable Objects data cannot be directly exported
# Consider building admin endpoints for data export if needed
```

This technical reference provides all the specific commands, configurations, and procedures needed to maintain and enhance the Engage system.