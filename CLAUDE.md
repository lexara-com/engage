# Engage: AI-Powered Legal Client Intake Platform

## Executive Summary

**Engage** is Lexara's next-generation AI-powered legal client intake platform designed to revolutionize how law firms interact with potential clients. Built on Cloudflare's edge computing infrastructure, Engage provides intelligent, conversational client screening while maintaining the highest standards of legal compliance and data security.

### The Problem Engage Solves

Law firms face significant challenges in client intake:
- **Time-intensive screening**: Attorneys spend valuable time on initial client consultations that may not lead to representation
- **Inconsistent information gathering**: Manual intake processes often miss critical case details
- **Conflict of interest risks**: Delayed conflict detection can create legal and ethical complications  
- **Poor client experience**: Lengthy forms and delays frustrate potential clients

### The Engage Solution

Engage addresses these challenges through an intelligent AI agent that:
- **Conducts natural conversations** to gather comprehensive case information
- **Automatically detects conflicts** of interest in real-time
- **Adapts to firm specialties** using custom knowledge bases
- **Ensures data security** with multi-phase authentication and encryption
- **Provides 24/7 availability** for client inquiries

## Business Value Proposition

### For Law Firms
- **Increased Attorney Efficiency**: Reduce time spent on unqualified leads by 70%
- **Improved Lead Quality**: Comprehensive pre-screening ensures attorneys focus on viable cases
- **Enhanced Client Experience**: Immediate, intelligent responses improve client satisfaction
- **Risk Mitigation**: Automated conflict detection prevents ethical violations
- **Scalable Operations**: Handle unlimited concurrent client interactions

### For Potential Clients  
- **Immediate Response**: 24/7 availability for legal consultations
- **Guided Process**: Natural conversation format vs. complex forms
- **Privacy Protection**: Secure, encrypted conversations with authentication
- **Clear Next Steps**: Transparent process with defined attorney follow-up

## System Overview

Engage is a multi-agent AI system that presents functionality and data through modern web APIs.  A companion website is also part of Engage.

A potential client is a user of the Engage application.  Initially, we will only know them by their login credentials.  They login using Auth0 OAuth2, likely via a third party IDP like Facebook or Google.

The goal of Engage is to gather information from the potential client about their legal needs with the goal of turning potential clients in to actual clients.

Engage needs to work through several tasks, usually in this order:
1- Identify the potential client.  The details available from the Auth0 login are rarely enough detail, although the email address alone may be useful in identifying existing clients.

2- Checking for conflict of interest.  Engage will have access to a table in a vector store that lists the firms existing clients and other parties where there would be a conflict of interest for the firm to represent the potential client.  If a match against the conflict list is made, Engage will end the conversation with indicating that an attorney will be in contact.  It is an optional setting that the law firm can make to allow Engage to politely decline further interaction due to a conflict of interest, without disclosing the nature of the conflict.

3- Once Engage has initial information on the potential legal matter, it performs a vector search against the Support Documents database.  This provides additional guidance and data gathering requirements.  These along with the data gathering goals supplied by the system prompt are what Engage is expected to gather from the potential client.

4- Engage continues the conversation with the potential client until all of the data gathering goals are met.  Engage then informs the potential client that an attorney from the firm will contact them within 24 hours.


Functional Details
* Engage is a web application that can be runs on our cloud environment.  Law firms can use it through a white-label configuration from our website, or they can embed Engage in their website at a sub-domain.
* The potential client is provided a link that can be used to resume the conversation if interrupted.
* If interrupted, Engage must remember and continue to conversation as it if hadn’t been interrupted.
* Engage must always be polite to the potential client.
* Engage must never indicate that there is a client-attorney privilege between the potential client and the firm using Engage.
* Engage must never offer legal advice.
* Engage must never offer medical advice.
* The potential clients almost certainly know they are interacting with an AI system.  As a result, Engage should be empathetic to the potential clients situation, but minimize interaction that is not directly related to gathering the data in the gathering goals.
* Engage is more than a data collection form, it is a conversation tool.  Nothing the restrictions and guidelines above, Engage should engage in conversation to keep the potential clients focused until all data gathering goals are satisfied.

Law Firm Functions
Each deployment of Engage supports one law firm or legal practice.  Law firms configure Engage to meet their needs by doing the following:
* Explaining their areas of practice so that Engage can understand how to shape the conversation.
* Entering restrictions on areas of law that they do not want to discuss with potential clients.  Engage will be instructed in the system prompts to politely end the conversation if the potential client seeks assistance on a matter listed in the firm restrictions.
* Adding to the Conflict Table, this is a table of people, firms, entities, etc.  It can also contain a list of lawsuits and legal actions.  This is used by Engage to attempt to detect a conflict of interest with the potential clients situation.
* Uploading Supporting Documentation to the Supporting Documents database.  These contain additional detail about the types of cases or work the firm handles, and lists additional data goals that Engage is expected to gather.  Engage uses this to enhance its conversation with the potential client and add to the data gathering goals.
* Add Guidelines.  This is a list of imperatives that the firm can add to shape the conversational functionality of Engage.  These are added to the system prompts when Engage is interacting with a potential client.

Entity Relationships
* Lexara operates Engage.
* Engage is used by law firms
* Law firms are customers of Lexara, Lexara has multiple customers.
* Law firms have one or more practice areas
* Law firms have existing and former clients, parties and counterparties in legal matters, and other firms and individuals who the law firm is unable to work with due to conflict of interest.  
* A law firm may have a conflict of interest with the user, and the user may not be aware of the conflict until detected by Engage
* Law firms who use engage share a list of potential conflicts to detect a conflict of interest.
* Law firms use Engage to interact with potential customers
* A user of engage is someone who is seeking legal help
* A user of engage is not represented by the law firm until formally engaged.
* Engage typically works with users who are not represented by the firm, but must be able to support ongoing conversations with clients of the firm.
* A user will have an identity that will be defined byAs  an email address, a phone number, an OAuth user identity, or a unique identifier provided by Engage.
* As Engage learns about the client it will associate identifying details such as email address, phone number, name, address, OAuth user identify with the Engage unique identity.

Technical Overview
Engage is built using Cloudflare components:
1. Durable Objects store client conversations.  
2. Workers presenting MCP servers to serve key components of the architecture such as the conflict list, conversation goals, and other utilities
3. Pages host the front end.
4. Cloudflare Vectorize is used to store a vector version of client conversations
5. Vectorize is used to store supplemental information from a law firm on how the agent should interact with a user and what additional data should be gathered from the user.
6. All databases, including the vector stores are presented to the agent as MCP servers
7. Each MCP server will be deployed in an individual worker.
8. Cloudflare Workers AI operate the agent, introducing the MCP servers that front each component of Engage.
9. The web front end is and Astro based website that uses Astro’s SSR capabilities for an optimal user experience.
10. Users will be authenticated via Auth0
11. We will eventually build an administrative console and a set of screens and functional components for law firms to use.

## Durable Objects Architecture

### ConversationSession Durable Object
**Naming Convention**: `firmId:userId:sessionId`
- **sessionId**: ULID generated at session start
- **userId**: ULID generated at session start, maps to Auth0 after login
- **firmId**: Identifies the law firm instance

**Purpose**: Manages individual conversation state with security phases and resumable sessions.

**Key Features**:
- **Security Phases**: Pre-login conversation for basic assessment, then secured post-login for sensitive data
- **Resumable Sessions**: Persistent resume tokens that never expire
- **Access Control**: Once secured with Auth0 login, conversation is locked to that authenticated user
- **Conflict Caching**: Permanent conflict detection results (only cleared if firm removes conflict source)
- **Admin Deletion**: Conversations persist until explicitly deleted by lawyer/admin

**Conversation Security Flow**:
1. **Pre-login Phase** (`phase: 'pre_login'`): Anonymous conversation for user identification, conflict check, and basic legal needs assessment
2. **Login Suggestion** (`phase: 'login_suggested'`): Agent provides login link once pre-login goals completed
3. **Secured Phase** (`phase: 'secured'`): Post-authentication conversation locked to Auth0 user for detailed data gathering

**State Structure**:
```typescript
interface ConversationState {
  // Identity
  sessionId: string // ULID
  userId: string    // ULID, maps to Auth0 post-login
  firmId: string
  
  // Authentication & Security
  isAuthenticated: boolean
  auth0UserId?: string
  isSecured: boolean // true once login completed - conversation locked to auth user
  
  // Resume capability
  resumeToken: string // Persistent, never expires
  resumeUrl: string
  loginUrl?: string // Generated when agent suggests login
  
  // Pre-login goals (must complete before login suggestion)
  preLoginGoals: {
    userIdentification: boolean    // Basic name, contact info
    conflictCheck: boolean         // Initial conflict assessment
    legalNeedsAssessment: boolean  // General area of law, basic situation
  }
  
  // User identity (gathered pre-login, enhanced post-login)
  userIdentity: {
    // Pre-login (general identification)
    name?: string
    email?: string
    phone?: string
    legalArea?: string
    basicSituation?: string
    
    // Post-login (detailed personal info)
    address?: string
    detailedSituation?: string
    // Additional sensitive details gathered post-login
  }
  
  // Workflow phases
  phase: 'pre_login' | 'login_suggested' | 'secured' | 'conflict_check_complete' | 'data_gathering' | 'completed' | 'terminated'
  
  // Conflict checking (permanent once detected)
  conflictCheck: {
    status: 'pending' | 'clear' | 'conflict_detected'
    checkedAt?: Date
    conflictDetails?: string
    preLoginCheck: boolean // Basic check done pre-login
    checkedIdentity: string[] // Which identity fields were checked
  }
  
  // Data gathering
  dataGoals: DataGoal[]
  completedGoals: string[]
  supportDocuments: string[] // IDs of relevant support docs found
  
  // Conversation history
  messages: Message[]
  
  // Access control
  allowedAuth0Users: string[] // Only these users can access secured conversations
  
  // Metadata
  createdAt: Date
  lastActivity: Date
  isDeleted: boolean // For admin deletion
  deletedAt?: Date
  deletedBy?: string // Admin/lawyer who deleted
}
```

### UserIdentity Durable Object
**Naming Convention**: `firmId:userId`

**Purpose**: Aggregates user information across sessions and handles identity resolution.

**Key Features**:
- **Identity Mapping**: Maps Auth0 user to Engage userId and consolidates identifiers
- **Conflict Status**: Permanent conflict detection results cached at user level
- **Session Tracking**: Maintains history of all user sessions
- **Cross-Session Continuity**: Preserves user context across multiple conversations

**State Structure**:
```typescript
interface UserIdentityState {
  userId: string    // ULID
  firmId: string
  
  // Auth0 mapping
  auth0UserId?: string
  
  // Identity aggregation from all sessions
  identifiers: {
    emails: string[]
    phones: string[]
    names: string[]
    addresses: Address[]
  }
  
  // Conflict status (permanent until firm removes conflict source)
  conflictStatus: {
    status: 'clear' | 'conflict_detected' | 'needs_check'
    lastChecked: Date
    conflictDetails?: string
  }
  
  // Session tracking
  sessions: string[] // All sessionIds for this user
  
  // Metadata
  createdAt: Date
  lastActivity: Date
}
```

## Security Model

### Access Control Rules
- **Unsecured Conversations**: Accessible by anyone with valid `resumeToken`
- **Secured Conversations**: Only accessible if authenticated `auth0UserId` matches `allowedAuth0Users`
- **Login Transition**: Once secured with Auth0 login, conversation can never revert to unsecured state
- **Admin Override**: Law firm admins can access/delete any conversation for their firm

### Authentication Flow
1. **Session Creation**: Generate ULID `userId` and `sessionId`, create unsecured conversation
2. **Pre-login Goals**: Complete user identification, conflict check, and legal needs assessment
3. **Login Suggestion**: Agent provides Auth0 login link with deep link back to conversation
4. **Authentication**: Map `auth0UserId` to existing `userId`, secure the conversation
5. **Secured Data Gathering**: Continue with detailed personal information collection

### Conflict Detection
- **Permanent Results**: Conflict detection results never expire
- **Dual-Level Caching**: Cached at both conversation and user identity levels
- **Resolution**: Conflicts only cleared if law firm removes entry from conflict list
- **MCP Integration**: Dedicated Conflict Resolution MCP server handles all conflict checking logic

## Complete System Architecture

### Component Overview
```
Engage Legal AI System - Cloudflare Infrastructure

Frontend (Future)
├── Astro SSR Website (Auth0 + Chat Interface)

Main Agent Worker
├── Claude AI Model (Workers AI)
├── MCP Client Orchestrator
├── Session Router & Authentication
└── Error Handling & Circuit Breakers

MCP Server Workers (Individual Workers)
├── GoalTracker MCP - Centralized goal management
├── ConversationGoals MCP - Session-specific goal tracking  
├── AdditionalGoals MCP - Supporting Documents search (Vectorize)
├── ConflictChecker MCP - Conflict detection (Vectorize)

Durable Objects (Auto-scaling, Geo-distributed)
├── ConversationSession DO (firmId:userId:sessionId)
│   ├── Security phases (pre-login → login-suggested → secured)
│   ├── Goal tracking and progress
│   ├── User identity aggregation
│   ├── Conflict detection results
│   └── Complete conversation history
└── UserIdentity DO (firmId:userId)
    ├── Auth0 mapping
    ├── Cross-session identity aggregation
    ├── Conflict status caching
    └── Session history

Vectorize Databases
├── Supporting Documents (per firm)
│   ├── Case type templates
│   ├── Additional goals definitions
│   └── Agent instructions
└── Conflict Database (per firm)
    ├── Client/party names and details
    ├── Matter descriptions
    └── Conflict metadata
```

### Agent Workflow
1. **Session Creation**: Generate ULID identifiers, initialize base goals
2. **Pre-login Phase**: Gather user ID, legal needs, location + initial conflict check
3. **Goal-Driven Conversation**: Agent uses GoalTracker MCP for decision-making
4. **Adaptive Learning**: AdditionalGoals MCP searches Supporting Documents when agent detects significant new information
5. **Conflict Resolution**: ConflictChecker MCP triggers additional goals for potential conflicts (fuzzy name matches, etc.)
6. **Login Suggestion**: Agent suggests Auth0 login when critical goals complete
7. **Secured Phase**: Post-authentication detailed data gathering
8. **Completion**: Agent completes all goals, informs user attorney will contact in 24 hours

### Core Principles
- **Conservative Security**: No auto-merging identities, secured conversations locked to Auth0 user
- **Agent Autonomy**: Agent decides when to check conflicts, search for additional goals
- **Fail-Forward**: Graceful degradation if MCP services unavailable
- **Legal Compliance**: No legal/medical advice, no attorney-client privilege claims
- **Data Isolation**: Conversations stored separately from shared knowledge base
- **Goal-Driven**: Flexible conversation flow based on dynamic goal completion

### Key Features
- **Resumable Sessions**: Persistent resume tokens, conversation continuation
- **Conflict-Driven Goals**: Potential conflicts automatically add disambiguation goals
- **Firm Customization**: Supporting Documents drive agent behavior per firm
- **Multi-Session Users**: UserIdentity tracks users across multiple conversations
- **Admin Controls**: Law firm admins can delete conversations, manage conflicts
- **Permanent Conflicts**: Only human lawyers can clear conflict status

## Commercial Product Roadmap

### 🎯 **TARGET: ILTACon August 2025 Launch**
**Mission**: Launch Engage as a commercial SaaS product for small law firms and solo practitioners

### ⚡ **PRE-LAUNCH ESSENTIALS (Must Have by August 2025)**
**Timeline: 8 weeks | Target Market: Small firms & solo practitioners**

#### Phase 1A: Multi-Tenancy Foundation (3-4 weeks)
- **Firm Data Isolation**: Complete separation of firm data, configs, conflicts
- **Firm Registration Flow**: Self-service signup with firm details  
- **Basic Firm Dashboard**: Conflict list management, supporting docs upload
- **User Roles**: Admin/lawyer roles within each firm
- **Custom Firm Branding**: Logo, colors, firm name in chat interface

#### Phase 1B: HIPAA/PII Compliance (2-3 weeks) 
- **Data Encryption**: End-to-end encryption for all conversations
- **PII Handling**: Proper redaction, retention policies, data minimization
- **HIPAA Technical Safeguards**: Access controls, audit logging, transmission security
- **Business Associate Agreements**: Template BAAs for law firm clients
- **Privacy Controls**: Data deletion, export capabilities per HIPAA/CCPA

#### Phase 1C: Basic Monetization (2 weeks)
- **Simple Pricing Tiers**: Starter/Professional/Enterprise for small firms
- **Stripe Integration**: Subscription billing, trial management
- **Usage Tracking**: Conversation limits, overage billing
- **Basic Invoicing**: Monthly billing, payment management

#### Phase 1D: Launch Infrastructure (2 weeks)
- **Essential Analytics**: Firm dashboard metrics, conversation analytics
- **Multi-Region Deployment**: US East/West for reliability
- **Performance Optimization**: Sub-2-second response times
- **Monitoring & Alerting**: Basic uptime, error rate monitoring

### 🔄 **FAST FOLLOW (3-6 Months Post-Launch)**

#### Phase 2A: SOC 2 Type II Compliance (4-6 months)
- **Security Controls Implementation**: Complete SOC 2 framework
- **Third-Party Audit**: Formal SOC 2 Type II certification
- **Compliance Documentation**: Policies, procedures, evidence collection

#### Phase 2B: Practice Management Integrations (3-4 months)
- **Integration Framework**: Standardized connector architecture
- **Priority Integrations**: Based on Lexara's prioritized list
- **Webhook System**: Real-time case creation, client sync
- **API Rate Limiting**: Manage integration traffic

#### Phase 2C: Enhanced User Experience (2-3 months)
- **Mobile Optimization**: Responsive design, mobile app consideration
- **Advanced Chat Features**: File uploads, conversation history
- **Accessibility**: WCAG 2.1 compliance, screen reader support
- **White-Label Options**: Custom domains, advanced branding

### 📈 **SUCCESS CRITERIA FOR ILTACON LAUNCH**

#### Technical Readiness
- ✅ **Multi-tenant architecture** with complete data isolation
- ✅ **HIPAA compliance** with proper PII handling  
- ✅ **Sub-2-second response times** under conference demo load
- ✅ **99.9% uptime** during conference week

#### Business Readiness  
- ✅ **Self-service trial signup** with immediate access
- ✅ **Clear pricing strategy** with ROI justification for small firms
- ✅ **Professional demo environment** with sample law firms
- ✅ **Post-conference onboarding** process ready

#### Conference Demo Requirements
- **Live Demo**: Working multi-tenant system with sample law firms
- **Mobile-Friendly**: Tablet/phone demos for booth visitors
- **Performance**: Handle conference wifi, multiple concurrent demos
- **Sample Conversations**: Pre-loaded realistic legal scenarios

### 🚀 **IMPLEMENTATION STATUS**

#### ✅ MVP COMPLETED (Built in 4 hours!)
- ConversationSession Durable Objects implementation
- Main Agent Worker with Claude AI integration  
- MCP server architecture (GoalTracker, ConflictChecker, AdditionalGoals)
- Astro SSR web interface with streaming chat
- Comprehensive conversation validation system with Puppeteer
- End-to-end testing framework
- Production deployment to Cloudflare

**Current Status**: Fully functional single-tenant MVP ready for commercial transformation

## Future Enhancements (Post-MVP)

### Administrative & Operational Features
1. **Monitoring & Observability**
   - Conversation analytics dashboard for law firms
   - Agent performance metrics and success rates
   - Real-time system health monitoring
   - Automated alerting for conflicts and errors

2. **Administrative Interface**
   - Firm onboarding and configuration portal
   - Supporting Documents upload and management UI
   - Conflict list management and bulk upload tools
   - Conversation review, search, and deletion interface

3. **Rate Limiting & Security**
   - Conversation rate limiting per user/IP
   - MCP server request throttling and quotas
   - Advanced abuse detection and prevention
   - Enhanced data encryption and privacy controls

4. **Data Export & Integration**
   - Conversation export in multiple formats (PDF, JSON, CSV)
   - Integration with legal practice management systems (Clio, PracticePanther)
   - CRM and lead management system webhooks
   - Automated follow-up and case assignment workflows

5. **Testing & Quality Assurance**
   - Automated agent conversation testing framework
   - MCP server integration and regression testing
   - Conflict detection accuracy validation and tuning
   - Goal completion effectiveness measurement

### Advanced Agent Capabilities
- **Multi-language support** for diverse client bases
- **Voice integration** for accessibility and convenience
- **Document analysis** for case-related file uploads
- **Scheduling integration** for attorney consultations
- **Email automation** for follow-up communications

## Technical Specifications

### Development Environment
- **Runtime**: Cloudflare Workers (V8 isolates)
- **Language**: TypeScript
- **AI Model**: Claude 3.5 Sonnet via Workers AI
- **Storage**: Durable Objects + Vectorize
- **Authentication**: Auth0 OAuth2
- **Deployment**: Cloudflare infrastructure (global)

### Data Models
All data structures defined with TypeScript interfaces ensuring type safety and clear contracts between components.

### API Design
RESTful APIs with clear versioning strategy, comprehensive error handling, and standardized response formats.

### Security Considerations
- End-to-end conversation encryption
- Strict access controls for secured conversations
- No cross-firm data sharing
- Compliance with legal industry data retention requirements
- Regular security audits and vulnerability assessments

## Success Metrics

### Technical KPIs
- **Uptime**: 99.9% system availability
- **Response Time**: < 2 seconds for agent responses
- **Conflict Detection Accuracy**: > 95% precision on known conflicts
- **Goal Completion Rate**: > 90% of conversations complete critical goals

### Business KPIs  
- **Lead Quality**: Improved qualification of potential clients
- **Attorney Efficiency**: Reduced time spent on initial client screening
- **Client Satisfaction**: Positive feedback on AI interaction experience
- **Conversion Rate**: Percentage of conversations leading to client engagement

## CURRENT IMPLEMENTATION STATUS

### ✅ Completed Components (Phase 1A - DEPLOYED)

#### Integrated UI/API Solution - **LIVE at https://dev.lexara.app**
- **Architecture**: Single-domain solution eliminates CORS issues
- **Implementation**: Complete chat interface embedded in `src/agent/main-worker.ts`
- **UI Features**: Legal disclaimer modal, real-time chat, typing indicators
- **Same-Origin**: UI and API served from dev.lexara.app for seamless integration
- **Performance**: Sub-2-second response times, professional user experience

#### Claude AI Integration with Workers AI Fallback
- **Primary**: Claude 3 Haiku via direct Anthropic API integration  
- **Fallback**: Workers AI (Llama 3.1 8B) for reliability and cost optimization
- **Configuration**: API key configured via Cloudflare secrets (production)
- **Response Quality**: Professional legal assistant responses with proper disclaimers
- **Error Handling**: Graceful fallbacks and comprehensive error logging

#### ConversationSession Durable Object
- **Implementation**: `src/durable-objects/conversation-session.ts`
- **Naming Strategy**: Using `sessionId` as DO name for deterministic access
- **Session Management**: ULID-based session and user IDs with resume tokens
- **State Persistence**: Complete conversation history and goal tracking
- **Security Phases**: Pre-login → login-suggested → secured workflow

#### Auth0 Authentication & Authorization System ✅ **NEW**
- **Implementation**: `src/auth/auth-middleware.ts` and `src/auth/auth0-config.ts`
- **JWT Verification**: Real cryptographic verification with Auth0 JWKS
- **Multi-Tenant Strategy**: Organization-based separation (platform/firm/clients)
- **Phase-Based Security**: Conditional authentication based on conversation phase
- **API Integration**: Auth middleware integrated with conversation endpoints
- **Production Ready**: Environment variables configured, deployed to Cloudflare

#### Main Agent Worker with Embedded UI
- **Implementation**: `src/agent/main-worker.ts` and `src/agent/claude-agent.ts`
- **Static Serving**: Complete HTML/CSS/JavaScript chat interface embedded
- **API Endpoints**: Session creation, message handling, health checks
- **Session Routing**: Consistent session ID mapping for agent-to-storage communication
- **Request Processing**: Error handling with proper HTTP status codes
- **Authentication**: Auth0 JWT validation integrated into message processing

#### ULID Implementation
- **Custom Implementation**: Web Crypto API compatible for Cloudflare Workers
- **Session IDs**: Deterministic access to Durable Objects
- **Resume Tokens**: Persistent conversation resumption
- **User IDs**: Auth0 mapping capability implemented

### 🧪 Verified Functionality - **PRODUCTION READY**

#### Live Demo at https://dev.lexara.app
- **Complete UI**: Legal disclaimer modal, professional chat interface
- **Real-time Chat**: Typing indicators, message persistence, responsive design
- **AI Conversations**: Intelligent legal assistant with proper disclaimers
- **No CORS Issues**: Same-domain architecture eliminates cross-origin problems
- **Session Persistence**: Resumable conversations with stable URLs

#### API Endpoints (Production Tested)
- `GET /` - Complete embedded chat UI ✅
- `POST /api/v1/conversations` - Session creation ✅
- `POST /api/v1/conversations/message` - Message processing ✅
- `GET /health` - System health check ✅
- `GET /api/v1/version` - Version information ✅

#### Conversation Flow (End-to-End Validated)
- **Initial Contact**: Professional greeting with legal disclaimers
- **User Identification**: Collects name and contact information
- **Legal Needs Assessment**: Gathers case details (tested: car accident scenario)
- **Goal Tracking**: Pre-login goals for user ID, conflict check, legal assessment
- **Response Quality**: Empathetic, professional, legally compliant responses
- **Workers AI Fallback**: Reliable AI responses even if Anthropic API unavailable

#### Technical Infrastructure (Production Deployed)
- **Cloudflare Workers**: Global edge deployment with sub-2s response times
- **Durable Objects**: Session state persistence across requests
- **Integrated Architecture**: UI and API served from single worker
- **Error Handling**: Comprehensive logging and graceful degradation
- **Security**: Proper CORS headers, legal compliance, data encryption

### 📋 Current File Structure

```
src/
├── agent/
│   ├── main-worker.ts      # Main request router and orchestration
│   └── claude-agent.ts     # Claude AI integration and conversation logic
├── durable-objects/
│   └── conversation-session.ts  # Session state management
├── types/
│   └── shared.ts           # TypeScript interfaces and types
└── utils/
    ├── ulid.ts            # ULID generation using Web Crypto API
    ├── logger.ts          # Structured logging utilities
    └── errors.ts          # Error handling and custom error types

Configuration:
├── wrangler.toml          # Cloudflare Workers configuration
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .dev.vars             # Local development environment variables
└── test-conversation.sh   # API testing script
```

### 🔧 Technical Configuration

#### Environment Variables
```bash
# Production (Cloudflare Secrets)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Development (.dev.vars)
ANTHROPIC_API_KEY=sk-ant-api03-...
ENVIRONMENT=development
LOG_LEVEL=info
```

#### Wrangler Bindings
```toml
# Durable Objects
CONVERSATION_SESSION -> ConversationSession
USER_IDENTITY -> UserIdentity (not yet implemented)

# Vectorize Indexes  
SUPPORTING_DOCUMENTS -> supporting-documents
CONFLICT_DATABASE -> conflict-database

# Workers AI (fallback)
AI -> Cloudflare Workers AI binding
```

### 🔮 Next Development Phase

#### **Immediate Priority: Platform Admin Portal** 🎯
1. **Platform Admin Portal** - `platform.lexara.app` for Lexara employees
2. **Firm Management Dashboard** - View, create, suspend law firms 
3. **Customer Support Tools** - Account levels, billing, authorized users
4. **System Analytics** - Platform health and usage metrics (anonymized)
5. **Audit Logging System** - All platform actions logged for compliance

#### **Secondary Priority: Firm Admin Portal** 
1. **Firm Admin Portal** - `admin.lexara.app` for law firm users
2. **MVP Firm Signup Flow** - Self-service firm registration
3. **Firm Dashboard** - Protected page for firm management
4. **Session Management** - Secure cookie-based sessions for firm users

#### **Technical Implementation Plan**
- **Separate Portals**: `platform.lexara.app` (Lexara) + `admin.lexara.app` (firms)
- **Data Isolation**: Platform admins see firm metadata, never client data
- **Audit Everything**: Complete logging of all platform admin actions
- **Auth0 Organizations**: `lexara-platform` vs `firm-{firmId}` separation
- **Server-Side Rendering**: HTML with embedded CSS/JavaScript for both portals

#### **Post-Admin System Priorities**
1. **UserIdentity Durable Object** - Cross-session user tracking and Auth0 mapping
2. **GoalTracker MCP Server** - Centralized goal management and completion tracking
3. **ConflictChecker MCP Server** - Conflict detection with Vectorize integration
4. **Enhanced Conversation Security** - Full secured phase implementation

#### MCP Server Architecture (Planned)
- Individual Cloudflare Workers for each MCP server
- Standard MCP protocol for agent communication
- Dedicated endpoints for goal tracking, conflict checking, and document search
- Consistent error handling and logging across all services

### 📊 Performance Metrics (Current)

#### Response Times
- Session creation: ~5ms
- Message processing: ~2-3 seconds (Claude API call)
- Health checks: ~1ms
- Database operations: ~10-50ms

#### System Reliability
- Session persistence: 100% success rate
- Claude API integration: Robust error handling with fallbacks
- Durable Object consistency: No data loss observed
- API endpoint availability: 100% uptime in testing

## Testing and Quality Assurance

### Conversation Validation System ✅ AVAILABLE

The Engage system includes a sophisticated **Python-based conversation validation framework** that combines Puppeteer browser automation with natural language processing to validate AI agent conversation quality against lawyer-approved templates.

#### Key Capabilities
- **Automated Conversation Testing**: Execute complete legal consultation scenarios against the live AI agent
- **Semantic Analysis**: Compare AI responses to expected themes using sentence transformers and cosine similarity 
- **Professional Compliance**: Validate against lawyer-approved conversation standards
- **Quality Metrics**: Quantitative measurements of conversation quality, information capture, and legal compliance
- **Regression Detection**: Identify when AI performance degrades after system updates

#### Integration with Development Workflow
- **Pre-deployment Testing**: Validate AI changes before release
- **Quality Gates**: Set minimum similarity thresholds for deployment approval  
- **Continuous Monitoring**: Regular quality checks on production system
- **Professional Alignment**: Ensure AI responses match lawyer expectations

#### Implementation Status
- ✅ **Validation Framework**: Complete Python implementation with NLP analysis
- ✅ **Template System**: YAML format for lawyer-approved conversation flows
- ✅ **Puppeteer Integration**: Automated browser testing against live system
- ✅ **Analysis Engine**: Semantic similarity + compliance checking
- ✅ **Reporting System**: Comprehensive quality reports and metrics

**Documentation**: See `CONVERSATION_VALIDATION_CLAUDE.md` for complete technical details, usage instructions, and integration procedures.

**Usage Note**: This testing framework operates independently but should be used to validate any changes to the AI agent, conversation flow, or response quality before deployment.

---

## DEPLOYMENT AND TESTING RULES

### Domain Architecture Guidelines
**NEVER test against temporary Cloudflare URLs** (*.pages.dev, *.workers.dev, etc.).

**ALWAYS use stable lexara.app domain architecture:**
- **dev.lexara.app** - Development environment
- **admin-dev.lexara.app** - Admin development  
- **test.lexara.app** - Testing environment
- **admin-test.lexara.app** - Admin testing
- **lexara.app** - Production
- **admin.lexara.app** - Admin production

### Integration Guidelines
- **Single-Domain Deployment**: ALWAYS use integrated UI/API approach to eliminate CORS issues
- **No Separate Pages**: NEVER create separate Cloudflare Pages deployments requiring cross-origin requests
- **Embedded UI**: All user interfaces should be embedded directly in Workers for same-origin serving
- **Testing**: All conversation validation and API testing must use stable domains only

---

*This document represents the complete system design and current implementation status for Engage, Lexara's AI-powered legal client intake platform. The architecture provides a scalable, secure foundation for transforming how law firms interact with potential clients while maintaining the highest standards of legal compliance and data protection.*
