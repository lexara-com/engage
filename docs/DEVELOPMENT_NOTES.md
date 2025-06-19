# Engage Development Notes

## Implementation History & Technical Decisions

### Phase 1A: Core Agent Framework (COMPLETED)

#### Key Technical Decisions

1. **ULID vs UUID for Session IDs**
   - **Decision**: Custom ULID implementation using Web Crypto API
   - **Rationale**: Cloudflare Workers doesn't support Node.js crypto module
   - **Implementation**: `src/utils/ulid.ts` with timestamp + random components
   - **Benefit**: Sortable IDs with embedded timestamp for debugging

2. **Durable Object Naming Strategy**
   - **Decision**: Use `sessionId` directly as DO name instead of `firmId:userId:sessionId`
   - **Rationale**: Simpler routing, deterministic access, no complex parsing
   - **Implementation**: `env.CONVERSATION_SESSION.idFromName(sessionId)`
   - **Benefit**: Consistent agent-to-storage communication

3. **Claude AI Integration Approach**
   - **Decision**: Direct Anthropic API calls instead of Workers AI
   - **Rationale**: Full control over model selection, better error handling
   - **Implementation**: Direct fetch to `https://api.anthropic.com/v1/messages`
   - **Configuration**: API key via `.dev.vars` (local) and Cloudflare secrets (production)

4. **Error Handling Strategy**
   - **Decision**: Custom EngageError classes with specific error codes
   - **Implementation**: `src/utils/errors.ts` with typed error handling
   - **Benefit**: Consistent error responses and debugging

#### Lessons Learned

1. **Cloudflare Workers Compatibility**
   - Node.js modules don't work - need Web API equivalents
   - Workers AI model availability varies by environment
   - Local development needs `.dev.vars` for secrets

2. **Durable Object Session Management**
   - Must use consistent ID generation strategy for DO access
   - State initialization must handle both new and existing sessions
   - Resume tokens need deterministic mapping to session IDs

3. **Claude AI Integration**
   - Direct API calls provide better control than Workers AI
   - Response quality is excellent for legal use cases
   - Error handling is critical for production reliability

#### Current Architecture Strengths

1. **Scalable Session Management**
   - ULID-based session IDs provide unique, sortable identifiers
   - Durable Objects handle state persistence automatically
   - Resume tokens enable conversation continuation

2. **Professional AI Responses**
   - Claude provides empathetic, legally compliant responses
   - Proper disclaimers about no legal advice
   - Structured information gathering approach

3. **Robust Error Handling**
   - Graceful degradation when services unavailable
   - Comprehensive logging for debugging
   - Typed error responses with appropriate HTTP status codes

## Next Phase Requirements & Planning

### Phase 1B: Core Infrastructure Completion

#### 1. UserIdentity Durable Object (HIGH PRIORITY)
**Purpose**: Cross-session user tracking and Auth0 integration

**Implementation Requirements**:
- Naming: `firmId:userId` for unique user identification per firm
- Auth0 mapping: Link Engage `userId` to Auth0 `sub` field
- Identity aggregation: Collect emails, phones, names across sessions
- Conflict status caching: Permanent conflict results at user level

**Technical Considerations**:
- How to handle users with multiple Auth0 identities?
- What's the conflict resolution strategy for identity merging?
- Should we auto-merge identities or require manual confirmation?

#### 2. GoalTracker MCP Server (HIGH PRIORITY)
**Purpose**: Centralized goal management and completion tracking

**Core Functionality**:
- Base goals: User identification, conflict check, legal needs assessment
- Goal completion tracking with confidence scoring
- Login readiness assessment based on completed goals
- Agent recommendation engine for next conversation steps

**MCP Protocol**:
- Tools: `assess_goals`, `mark_goal_complete`, `get_recommendations`
- Resources: Goal definitions, completion criteria, assessment logic
- Prompts: Goal-specific conversation guidance for agent

#### 3. ConflictChecker MCP Server (HIGH PRIORITY)
**Purpose**: Conflict detection with Vectorize integration

**Core Functionality**:
- Semantic search against firm's conflict database
- Fuzzy name matching with confidence scoring
- Additional goal generation for potential conflicts
- Permanent conflict status caching

**Vectorize Integration**:
- Index structure: Name variants, addresses, phone numbers, case details
- Search strategy: Embedding-based similarity search
- Confidence thresholds: When to flag potential conflicts vs. clear results

#### 4. Auth0 Integration (MEDIUM PRIORITY)
**Purpose**: Secure authentication and conversation protection

**Implementation Requirements**:
- Auth0 tenant configuration for legal industry
- JWT validation in Cloudflare Workers
- Deep linking back to conversations post-authentication
- Session security phase transitions

### Technical Architecture Decisions Needed

#### 1. MCP Server Communication
**Question**: How should the main agent communicate with MCP servers?
- **Option A**: Direct HTTP calls between Workers
- **Option B**: Cloudflare Service Bindings
- **Option C**: Message queue (KV or Durable Objects)

**Recommendation**: Service Bindings for performance and reliability

#### 2. Conflict Detection Strategy
**Question**: How aggressive should conflict detection be?
- **Option A**: Conservative (only flag exact matches)
- **Option B**: Aggressive (flag all potential matches for human review)
- **Option C**: Tiered (auto-clear low confidence, flag medium, block high)

**Recommendation**: Tiered approach with firm-configurable thresholds

#### 3. Goal System Flexibility
**Question**: How should goals be defined and modified?
- **Option A**: Hard-coded base goals with vectorize-driven additional goals
- **Option B**: Fully dynamic goals from supporting documents
- **Option C**: Hybrid with configurable base goals per firm

**Recommendation**: Hybrid approach for maximum flexibility

### Development Environment Improvements

#### Testing Framework
- Automated conversation flow testing
- MCP server integration testing
- Conflict detection accuracy validation
- Goal completion effectiveness measurement

#### Monitoring & Observability
- Structured logging across all components
- Performance metrics collection
- Error rate tracking and alerting
- Conversation analytics for law firms

#### Security Enhancements
- Input validation and sanitization
- Rate limiting per user/IP
- Enhanced data encryption
- Security audit preparation

## Technical Debt & Future Refactoring

### Current Technical Debt

1. **Hard-coded System Prompts**
   - Location: `src/agent/claude-agent.ts:buildSystemPrompt()`
   - Issue: System prompts should be configurable per firm
   - Solution: Move to supporting documents or firm configuration

2. **Limited Error Recovery**
   - Location: Claude API calls and Durable Object operations
   - Issue: Need circuit breakers and retry logic
   - Solution: Implement exponential backoff and fallback strategies

3. **Manual Testing Only**
   - Issue: No automated testing framework
   - Solution: Implement Jest-based testing for all components

### Code Quality Improvements

1. **Type Safety**
   - Enhance TypeScript strict mode configuration
   - Add runtime type validation for API inputs
   - Implement schema validation for MCP communication

2. **Performance Optimization**
   - Implement caching for frequently accessed data
   - Optimize Vectorize query performance
   - Add request batching for MCP operations

3. **Documentation**
   - Add JSDoc comments to all public methods
   - Create API documentation with OpenAPI spec
   - Document MCP server protocols and contracts

## Risk Assessment & Mitigation

### High-Risk Areas

1. **Conflict Detection Accuracy**
   - Risk: False positives block legitimate clients
   - Mitigation: Tunable confidence thresholds, human review process

2. **Data Privacy & Security**
   - Risk: Conversation data exposure or breach
   - Mitigation: End-to-end encryption, access auditing, minimal data retention

3. **Claude API Dependency**
   - Risk: Service outages or rate limiting
   - Mitigation: Fallback models, graceful degradation, request queuing

### Medium-Risk Areas

1. **Durable Object Scaling**
   - Risk: Hot partitions or memory limits
   - Mitigation: Load distribution, state optimization, monitoring

2. **Auth0 Integration Complexity**
   - Risk: Authentication failures or security vulnerabilities
   - Mitigation: Thorough testing, security review, fallback authentication

3. **Vectorize Performance**
   - Risk: Slow search queries affecting user experience
   - Mitigation: Query optimization, caching, timeout handling

## Success Metrics & KPIs

### Technical Metrics (Measurable)
- API response times: < 2s for Claude, < 100ms for other operations
- System uptime: > 99.9% availability
- Error rates: < 0.1% for critical operations
- Conflict detection accuracy: > 95% precision, > 90% recall

### Business Metrics (To Be Defined)
- Conversation completion rate: % of sessions reaching attorney handoff
- Lead qualification improvement: Quality score vs. traditional intake
- Attorney time savings: Hours saved per qualified lead
- Client satisfaction: Survey scores for AI interaction experience

### Development Velocity Metrics
- Feature delivery: Sprint completion rate
- Code quality: Test coverage, bug density
- Technical debt: Story points allocated to refactoring
- Documentation completeness: API coverage, user guide completeness

## Next Sprint Planning

### Sprint 1: Core MCP Infrastructure (2 weeks)
1. UserIdentity Durable Object implementation
2. GoalTracker MCP server basic functionality
3. MCP communication protocol establishment
4. Integration testing framework setup

### Sprint 2: Conflict Detection (2 weeks)
1. ConflictChecker MCP server implementation
2. Vectorize integration and query optimization
3. Conflict detection testing with sample data
4. Agent integration with conflict checking

### Sprint 3: Auth0 & Security (2 weeks)
1. Auth0 tenant setup and configuration
2. JWT validation in Workers
3. Secured conversation phase implementation
4. Security testing and audit preparation

### Sprint 4: Polish & Production (1 week)
1. Error handling improvements
2. Performance optimization
3. Comprehensive testing
4. Production deployment preparation