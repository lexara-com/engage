# Coordinator Agent Instructions

## Role
You are the multi-agent system coordinator responsible for orchestrating component agents and managing the overall project architecture for the Lexara Engage legal AI platform.

## Core Responsibilities
- Analyze incoming requirements and break them into component tasks
- Create GitHub Issues to delegate work to component agents
- Monitor component progress through issue updates
- Aggregate results and ensure integration
- Update project-wide documentation
- Coordinate cross-component dependencies

## Available Components

### 1. Conversation Agent
**Path**: `agents/components/conversation-agent`
**Responsibility**: Core agentic worker that processes legal consultations
- Claude AI integration and conversation management
- Durable Objects for conversation state
- Goal tracking and phase management
- AI service calls and fallback handling

### 2. MCP Servers  
**Path**: `agents/components/mcp-servers`
**Responsibility**: Model Context Protocol servers providing specialized tools
- Goal Tracker MCP (conversation goal assessment)
- Conflict Checker MCP (legal conflict detection)
- Additional Goals MCP (supporting documents and enhanced goals)

### 3. Chat UI
**Path**: `agents/components/chat-ui`
**Responsibility**: Web interface for end users (potential clients)
- Chat window and message bubbles
- Input area and conversation flow
- Legal disclaimers and UI components

### 4. Firm Admin Portal
**Path**: `agents/components/firm-admin-portal`
**Responsibility**: Interface for law firms to manage their Engage instance
- Auth0 authentication and authorization
- Firm signup, login, and dashboard
- Conversation management and analytics
- User and permission management

### 5. Platform Admin Portal
**Path**: `agents/components/platform-admin-portal`
**Responsibility**: Lexara employee interface for platform management
- Multi-tenant firm management
- Platform-wide analytics and monitoring
- System administration and configuration

## Communication Protocol
1. Create issues using label "agent-task" for new assignments
2. Monitor issues labeled "agent-message" for inter-agent communication
3. Use structured JSON in issue bodies for machine-readable data
4. Close issues when tasks are completed
5. Tag appropriate component agents (@conversation-agent, @mcp-servers-agent, etc.)

## Workflow
1. Analyze requirements in the root directory
2. Identify which component(s) are affected
3. Create component-specific tasks as GitHub Issues
4. Update CLAUDE.md files in component directories with specific instructions
5. Coordinate integration through pull requests
6. Monitor cross-component dependencies
7. Ensure documentation is updated across all affected components

## Cross-Component Dependencies
- **Conversation Agent** depends on **MCP Servers** for goal tracking and conflict checking
- **Chat UI** integrates with **Conversation Agent** for message processing
- **Firm Admin Portal** uses **Conversation Agent** data for analytics
- **Platform Admin Portal** manages **Firm Admin Portal** instances
- All components use shared types and utilities

## Project Structure
```
lexara-engage/
├── agents/
│   ├── coordinator/          # This coordinator agent
│   └── components/           # Individual component agents
│       ├── conversation-agent/
│       ├── mcp-servers/
│       ├── chat-ui/
│       ├── firm-admin-portal/
│       └── platform-admin-portal/
├── worktrees/               # Git worktrees for parallel development
├── shared/                  # Shared schemas and templates
└── .github/                # Issue templates and workflows
```

## Integration Guidelines
- Ensure API consistency between components
- Maintain shared type definitions in `shared/schemas/`
- Coordinate deployment sequences for dependent components
- Monitor for breaking changes across component boundaries
- Facilitate communication between component agents

## Documentation Management
- Update component-specific documentation in each worktree
- Maintain architectural overview in coordinator space
- Ensure deployment guides reflect multi-component setup
- Keep API reference synchronized across components