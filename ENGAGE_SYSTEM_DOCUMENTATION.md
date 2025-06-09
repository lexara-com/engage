# Engage Legal AI System - Complete Documentation

## System Overview

Engage is a multi-agent AI system for law firms to interact with potential clients through a web-based interface. The system gathers information about legal needs with the goal of converting potential clients into actual clients.

### Core Architecture

The system is built entirely on Cloudflare infrastructure:

1. **Cloudflare Workers** - Host the main AI agent and MCP servers
2. **Cloudflare Durable Objects** - Store conversation state with SQLite
3. **Cloudflare Vectorize** - Vector storage for conflict checking and document search
4. **Cloudflare Pages** - Host the Astro-based frontend
5. **Cloudflare Workers AI** - Provide Claude integration for AI conversations

## Production Deployment URLs

### Current Live System (as of June 7, 2025)
- **Frontend UI**: https://d7fdb312.engage-ui.pages.dev
- **Backend API**: https://engage-legal-ai-production.cloudswift.workers.dev
- **MCP Servers**:
  - GoalTracker: https://goal-tracker-mcp-production.cloudswift.workers.dev
  - ConflictChecker: https://conflict-checker-mcp-production.cloudswift.workers.dev
  - AdditionalGoals: https://additional-goals-mcp-production.cloudswift.workers.dev

### Deployment Commands
```bash
# Deploy main agent
npm run deploy:production

# Deploy UI
npm run build:ui && npx wrangler pages deploy dist --project-name engage-ui

# Deploy individual MCP servers
cd workers/goal-tracker-mcp && wrangler deploy --env production
cd workers/conflict-checker-mcp && wrangler deploy --env production
cd workers/additional-goals-mcp && wrangler deploy --env production
```

## System Workflow

### 1. Client Interaction Flow
1. **Authentication**: Potential clients login via Auth0 OAuth2 (Facebook/Google)
2. **Identity Check**: System identifies client from Auth0 data and email
3. **Conflict Check**: Vector search against existing clients/conflicts database
4. **Legal Needs Assessment**: AI gathers information based on practice area
5. **Data Collection**: Continues until all gathering goals are met
6. **Handoff**: Attorney contacts client within 24 hours

### 2. Technical Flow
1. **Session Creation**: Frontend calls `/api/chat/session` → Backend creates Durable Object
2. **Message Processing**: User message → Claude AI → MCP server calls → Response
3. **State Persistence**: All conversation data stored in Durable Objects with SQLite
4. **Vector Operations**: Conflict checking and document search via Vectorize

## Component Architecture

### Main Agent Worker (`/src/agent/`)

**Location**: `/src/agent/claude-agent.ts`
**Deployment**: `engage-legal-ai-production.cloudswift.workers.dev`

**Key Features**:
- Claude 3.5 Sonnet integration via Anthropic API
- MCP client that connects to all three MCP servers
- Conversation state management via Durable Objects
- SQLite migrations for conversation storage

**Critical Configuration**:
```typescript
// Environment Variables Required
ANTHROPIC_API_KEY=sk-ant-... // Must be set as Cloudflare secret
VECTORIZE_INDEX_ID=engage-conflicts // For conflict checking
ADDITIONAL_GOALS_INDEX_ID=engage-goals // For document search

// MCP Server URLs (in wrangler.toml)
GOAL_TRACKER_URL=https://goal-tracker-mcp-production.cloudswift.workers.dev
CONFLICT_CHECKER_URL=https://conflict-checker-mcp-production.cloudswift.workers.dev
ADDITIONAL_GOALS_URL=https://additional-goals-mcp-production.cloudswift.workers.dev
```

**API Endpoints**:
- `POST /api/v1/conversations` - Create new conversation session
- `POST /api/v1/conversations/message` - Send message to AI agent
- `GET /api/v1/conversations/{sessionId}` - Retrieve conversation state

### MCP Servers

#### 1. GoalTracker MCP (`/workers/goal-tracker-mcp/`)

**Purpose**: Tracks data gathering goals for legal consultations
**Location**: `/workers/goal-tracker-mcp/src/index.ts`
**Deployment**: `goal-tracker-mcp-production.cloudswift.workers.dev`

**Core Functions**:
```typescript
// Initialize goals for a session
initialize_goals(sessionId: string, practiceArea: string)

// Update goal progress
update_goal_progress(sessionId: string, goalId: string, status: "pending" | "in_progress" | "completed", evidence?: string)

// Get current goals status
get_goals_status(sessionId: string)

// Check if all goals are completed
are_goals_complete(sessionId: string)
```

**Storage**: Uses Durable Objects with SQLite for persistent goal tracking

#### 2. ConflictChecker MCP (`/workers/conflict-checker-mcp/`)

**Purpose**: Semantic search for conflicts of interest
**Location**: `/workers/conflict-checker-mcp/src/index.ts`  
**Deployment**: `conflict-checker-mcp-production.cloudswift.workers.dev`

**Core Functions**:
```typescript
// Add conflict entry to vector database
add_conflict_entry(name: string, relationship: string, details: string, metadata?: object)

// Search for potential conflicts
search_conflicts(query: string, threshold?: number)

// List all conflicts (for admin)
list_conflicts(limit?: number, offset?: number)
```

**Storage**: Uses Cloudflare Vectorize for semantic similarity search
**Vector Index**: `engage-conflicts`

#### 3. AdditionalGoals MCP (`/workers/additional-goals-mcp/`)

**Purpose**: Search supporting documents for additional data gathering requirements
**Location**: `/workers/additional-goals-mcp/src/index.ts`
**Deployment**: `additional-goals-mcp-production.cloudswift.workers.dev`

**Core Functions**:
```typescript
// Add supporting document
add_document(title: string, content: string, practiceArea: string, metadata?: object)

// Search documents by legal matter
search_documents(query: string, practiceArea?: string, limit?: number)

// List all documents
list_documents(practiceArea?: string, limit?: number, offset?: number)
```

**Storage**: Uses Cloudflare Vectorize for document similarity search
**Vector Index**: `engage-goals`

### Frontend UI (`/src/`)

**Framework**: Astro with SSR on Cloudflare Pages
**Location**: `/src/pages/`, `/src/components/`
**Deployment**: `d7fdb312.engage-ui.pages.dev`

**Key Components**:
- `ChatWindow.astro` - Main chat interface with session management
- `InputArea.astro` - Message input with send functionality  
- `MessageBubble.astro` - Individual message display
- `DisclaimerModal.astro` - Legal disclaimer before chat starts

**API Bridge Endpoints** (`/src/pages/api/`):
- `/api/chat/session` - Session creation proxy to backend
- `/api/chat` - Message sending with streaming response conversion
- `/api/chat/session/[id]` - Session retrieval proxy

**Critical Frontend Logic**:
```typescript
// Session initialization - creates real backend session
const createResponse = await this.apiClient.createSession();
if (createResponse.success && createResponse.sessionId) {
  this.session = { ...this.session, id: createResponse.sessionId };
}

// Streaming message processing - converts JSON to SSE
const readable = new ReadableStream({
  start(controller) {
    const chunk = JSON.stringify({ type: 'chunk', content: data.message });
    controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
    const complete = JSON.stringify({ type: 'complete' });
    controller.enqueue(encoder.encode(`data: ${complete}\n\n`));
    controller.close();
  }
});
```

## Database Schemas

### Conversation Storage (Durable Objects + SQLite)

```sql
-- Main agent conversation table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  firm_id TEXT NOT NULL,
  phase TEXT DEFAULT 'pre_login',
  is_authenticated BOOLEAN DEFAULT false,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- GoalTracker MCP table
CREATE TABLE IF NOT EXISTS goal_sessions (
  session_id TEXT PRIMARY KEY,
  practice_area TEXT,
  goals TEXT, -- JSON array of goals
  created_at INTEGER,
  updated_at INTEGER
);

-- ConflictChecker uses Vectorize (no SQL schema)
-- AdditionalGoals uses Vectorize (no SQL schema)
```

### Vector Database Schemas

#### Conflict Entries (Vectorize Index: `engage-conflicts`)
```typescript
interface ConflictEntry {
  id: string;
  values: number[]; // 1536-dimensional embeddings
  metadata: {
    name: string;
    relationship: string; // "client", "opposing_party", "witness", etc.
    details: string;
    firm_id?: string;
    case_number?: string;
    date_added: string;
  };
}
```

#### Supporting Documents (Vectorize Index: `engage-goals`)
```typescript
interface SupportingDocument {
  id: string;
  values: number[]; // 1536-dimensional embeddings
  metadata: {
    title: string;
    content: string;
    practice_area: string;
    document_type: string;
    firm_id?: string;
    date_added: string;
  };
}
```

## Configuration Files

### Main wrangler.toml
```toml
name = "engage-legal-ai"
main = "src/index.ts"
compatibility_date = "2024-05-01"

workers_dev = true

[env.production]
name = "engage-legal-ai-production"
vars = { ENVIRONMENT = "production" }

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

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "wrangler dev",
    "dev:ui": "astro dev",
    "build:ui": "astro build", 
    "deploy": "wrangler deploy",
    "deploy:production": "wrangler deploy --env production",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/**/*.ts"
  }
}
```

## Environment Variables & Secrets

### Required Cloudflare Secrets
```bash
# Set via: echo "value" | wrangler secret put SECRET_NAME --env production

# Main agent
ANTHROPIC_API_KEY=sk-ant-api-03-... # Claude API key

# Optional for enhanced functionality
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
```

### Environment Variables (in wrangler.toml)
```toml
[env.production.vars]
ENVIRONMENT = "production"
GOAL_TRACKER_URL = "https://goal-tracker-mcp-production.cloudswift.workers.dev"
CONFLICT_CHECKER_URL = "https://conflict-checker-mcp-production.cloudswift.workers.dev"
ADDITIONAL_GOALS_URL = "https://additional-goals-mcp-production.cloudswift.workers.dev"
```

## Critical Code Patterns

### MCP Client Integration
```typescript
// Main agent MCP client setup
const mcpClient = new McpClient({
  goalTrackerUrl: env.GOAL_TRACKER_URL,
  conflictCheckerUrl: env.CONFLICT_CHECKER_URL,
  additionalGoalsUrl: env.ADDITIONAL_GOALS_URL
});

// Standard MCP call pattern
const response = await mcpClient.call('tool_name', {
  sessionId: session.id,
  param1: 'value1',
  param2: 'value2'
});
```

### Durable Object Session Management
```typescript
// Session creation pattern
export class ConversationSession {
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    this.sql = state.storage.sql;
  }

  async createConversation(sessionId: string, firmId: string) {
    await this.sql.exec(`
      INSERT INTO conversations (id, session_id, firm_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, sessionId, sessionId, firmId, Date.now(), Date.now());
  }
}
```

### Frontend Session Initialization
```typescript
// Critical: Always create backend session before using
private async initializeChat(sessionId?: string) {
  // Try existing session first
  if (sessionId) {
    const response = await this.apiClient.getSession(sessionId);
    if (response.success && response.data) {
      this.session = response.data;
      return;
    }
  }
  
  // Create new backend session - REQUIRED
  const createResponse = await this.apiClient.createSession();
  if (createResponse.success && createResponse.sessionId) {
    this.session = { ...this.session, id: createResponse.sessionId };
  }
}
```

## Testing & Debugging

### Backend API Testing
```bash
# Test session creation
curl -X POST "https://engage-legal-ai-production.cloudswift.workers.dev/api/v1/conversations" \
  -H "Content-Type: application/json" \
  -d '{"firmId": "firm_test_123"}'

# Test message sending  
curl -X POST "https://engage-legal-ai-production.cloudswift.workers.dev/api/v1/conversations/message" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "SESSION_ID", "message": "Hello, I need legal help"}'
```

### Frontend API Testing
```bash
# Test UI session creation
curl -X POST "https://d7fdb312.engage-ui.pages.dev/api/chat/session" \
  -H "Content-Type: application/json" \
  -d '{"firmId": "firm_test_123"}'

# Test UI message sending
curl -X POST "https://d7fdb312.engage-ui.pages.dev/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "SESSION_ID", "message": "Hello"}'
```

### MCP Server Testing
```bash
# Test GoalTracker directly
curl -X POST "https://goal-tracker-mcp-production.cloudswift.workers.dev/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "initialize_goals", "arguments": {"sessionId": "test", "practiceArea": "contract_law"}}}'
```

### Common Debugging Commands
```bash
# View Worker logs
wrangler tail --env production

# Check deployment status
wrangler deployments list --env production

# Test Vectorize index
wrangler vectorize list

# Check Durable Object state
wrangler dev --local-persistence
```

## Known Issues & Solutions

### 1. Session Creation Returns `undefined`
**Problem**: Client receives `undefined` for session creation
**Cause**: API response format mismatch
**Solution**: Ensure `/api/chat/session` returns `{success: true, sessionId: "..."}`

### 2. 401 Unauthorized from Anthropic
**Problem**: Backend returns 401 errors
**Solution**: Recreate ANTHROPIC_API_KEY secret:
```bash
echo "sk-ant-..." | wrangler secret put ANTHROPIC_API_KEY --env production
```

### 3. Custom Domain Route Errors
**Problem**: Deployment fails with custom domain
**Solution**: Use `workers_dev = true` in wrangler.toml for auto-assigned URLs

### 4. MCP Connection Timeouts
**Problem**: MCP servers don't respond
**Solution**: Check MCP server deployment status and URLs in environment variables

## Development Workflow

### Local Development
```bash
# Start backend (main agent)
npm run dev

# Start frontend (separate terminal)
npm run dev:ui

# Start individual MCP servers
cd workers/goal-tracker-mcp && wrangler dev
cd workers/conflict-checker-mcp && wrangler dev  
cd workers/additional-goals-mcp && wrangler dev
```

### Production Deployment
```bash
# 1. Deploy all MCP servers first
cd workers/goal-tracker-mcp && wrangler deploy --env production
cd workers/conflict-checker-mcp && wrangler deploy --env production
cd workers/additional-goals-mcp && wrangler deploy --env production

# 2. Deploy main agent
npm run deploy:production

# 3. Deploy frontend
npm run build:ui && npx wrangler pages deploy dist --project-name engage-ui
```

### Code Quality
```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## Security Considerations

### 1. API Key Management
- All sensitive keys stored as Cloudflare secrets
- Never commit API keys to repository
- Rotate keys regularly

### 2. CORS Configuration
- Restrictive CORS headers on production APIs
- Frontend-backend communication secured

### 3. Data Privacy
- No attorney-client privilege before formal engagement
- Conversation data encrypted in Durable Objects
- Vector embeddings anonymized

### 4. Input Validation
- All user inputs sanitized before AI processing
- SQL injection prevention via parameterized queries
- Rate limiting on API endpoints

## Performance Optimization

### 1. Vector Search Optimization
- Use appropriate similarity thresholds (0.7-0.8)
- Limit search results (10-20 items max)
- Cache frequently accessed documents

### 2. Frontend Performance
- Implement streaming responses for better UX
- Use Astro's SSR for faster initial page loads
- Minimize JavaScript bundle size

### 3. Backend Optimization
- Connection pooling for MCP clients
- Efficient Durable Object state management
- Minimize Claude API calls via smart caching

## Monitoring & Analytics

### Key Metrics to Track
1. **Conversation Completion Rate**: % of sessions that reach goal completion
2. **Response Time**: Average time for AI responses
3. **Error Rate**: Failed API calls and error types
4. **User Engagement**: Message count per session
5. **Conflict Detection Rate**: % of sessions with conflicts found

### Logging Strategy
```typescript
// Structured logging for debugging
console.log(JSON.stringify({
  level: 'info',
  message: 'Session created',
  sessionId: session.id,
  firmId: session.firmId,
  timestamp: new Date().toISOString()
}));
```

## Future Enhancements

### Planned Features
1. **Authentication Integration**: Full Auth0 OAuth implementation
2. **Multi-tenant Support**: Firm-specific customization
3. **Advanced Conflict Detection**: Machine learning models
4. **Document Upload**: PDF processing and analysis
5. **Real-time Notifications**: Attorney alerts for urgent matters
6. **Analytics Dashboard**: Firm performance metrics
7. **Mobile App**: Native iOS/Android applications

### Technical Debt
1. Add comprehensive error handling
2. Implement retry logic for MCP calls
3. Add API rate limiting
4. Improve TypeScript coverage
5. Add integration tests
6. Implement proper session cleanup

## Conclusion

This documentation provides complete coverage of the Engage Legal AI system as of June 7, 2025. The system is fully functional with a working chat interface, AI agent processing, and all three MCP servers operational. The architecture is scalable and built entirely on Cloudflare's edge computing platform.

For any issues or enhancements, refer to this documentation first, then consult the codebase and deployment logs for specific debugging information.