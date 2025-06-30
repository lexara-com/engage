#!/bin/bash

# Create deployment validation issues for all 5 component agents

echo "Creating deployment validation issues for all components..."

# Issue 1: Conversation Agent
gh issue create \
  --title "[conversation-agent] Deploy to dev environment and validate functionality" \
  --label "agent-task,conversation-agent,priority:high" \
  --assignee "@me" \
  --body "## Task: Deploy Conversation Agent to Development Environment

### Objective
Deploy the conversation agent to the Cloudflare dev environment and validate core functionality.

### Requirements
1. **Deploy main worker**: \`wrangler deploy --env dev\`
2. **Deploy durable objects**: Ensure ConversationSession and HIPAAConversationSession are deployed
3. **Test endpoints**:
   - Health check endpoint
   - Create new conversation
   - Send test message
   - Validate HIPAA compliance features
4. **Verify integrations**:
   - Claude API connectivity
   - MCP server connections
   - Error handling

### Acceptance Criteria
- [ ] Worker deployed successfully to dev environment
- [ ] All durable objects accessible
- [ ] Health check returns 200 OK
- [ ] Can create and interact with conversations
- [ ] Proper error handling for invalid requests
- [ ] HIPAA audit logging functional

### Report Back
Create an agent-message issue with deployment status, URLs, and any issues encountered."

# Issue 2: MCP Servers
gh issue create \
  --title "[mcp-servers] Deploy all 3 MCP servers to dev environment" \
  --label "agent-task,mcp-servers,priority:high" \
  --assignee "@me" \
  --body "## Task: Deploy MCP Servers to Development Environment

### Objective
Deploy all three MCP servers (goal-tracker, conflict-checker, additional-goals) to dev environment.

### Requirements
1. **Deploy goal-tracker**: \`wrangler deploy --env dev --config wrangler-goal-tracker.toml\`
2. **Deploy conflict-checker**: \`wrangler deploy --env dev --config wrangler-conflict-checker.toml\`
3. **Deploy additional-goals**: \`wrangler deploy --env dev --config wrangler-additional-goals.toml\`
4. **Test each server**:
   - MCP protocol compliance
   - Tool functionality
   - Resource endpoints
   - Error handling

### Acceptance Criteria
- [ ] All 3 servers deployed successfully
- [ ] Each server responds to MCP protocol requests
- [ ] Tools are accessible and functional
- [ ] Proper CORS headers for agent access
- [ ] Error responses follow MCP spec

### Report Back
Create an agent-message issue with deployment URLs and validation results for each server."

# Issue 3: Chat UI
gh issue create \
  --title "[chat-ui] Deploy chat interface to dev Pages environment" \
  --label "agent-task,chat-ui,priority:high" \
  --assignee "@me" \
  --body "## Task: Deploy Chat UI to Development Environment

### Objective
Deploy the Astro-based chat UI to Cloudflare Pages dev environment.

### Requirements
1. **Build Astro site**: \`npm run build\`
2. **Deploy to Pages**: \`wrangler pages deploy dist --env dev\`
3. **Test functionality**:
   - Homepage loads correctly
   - Chat interface renders
   - WebSocket connections work
   - Message sending/receiving
   - UI responsiveness
4. **Verify integrations**:
   - Connection to conversation-agent API
   - Auth0 authentication flow
   - Error handling and user feedback

### Acceptance Criteria
- [ ] Site deployed to Pages dev environment
- [ ] All static assets load correctly
- [ ] Chat interface fully functional
- [ ] Real-time messaging works
- [ ] Proper error states displayed
- [ ] Mobile responsive design

### Report Back
Create an agent-message issue with deployment URL and test results."

# Issue 4: Firm Admin Portal
gh issue create \
  --title "[firm-admin-portal] Deploy firm portal to dev environment with Auth0" \
  --label "agent-task,firm-admin-portal,priority:high" \
  --assignee "@me" \
  --body "## Task: Deploy Firm Admin Portal to Development Environment

### Objective
Deploy the firm admin portal with full Auth0 authentication to dev environment.

### Requirements
1. **Build portal**: \`npm run build\`
2. **Deploy to Pages**: \`wrangler pages deploy dist --env dev\`
3. **Test Auth0 integration**:
   - Login flow
   - Callback handling
   - JWT validation
   - Session management
   - Logout flow
4. **Test portal features**:
   - Dashboard access
   - User management
   - Settings pages
   - Firm registration
5. **Verify API connections**:
   - User permissions API
   - Firm management endpoints
   - Conversation history access

### Acceptance Criteria
- [ ] Portal deployed successfully
- [ ] Auth0 login/logout works
- [ ] Protected routes enforce authentication
- [ ] Firm-specific data isolation
- [ ] All admin features accessible
- [ ] Proper error handling

### Report Back
Create an agent-message issue with deployment URL, test user credentials, and validation results."

# Issue 5: Platform Admin Portal
gh issue create \
  --title "[platform-admin-portal] Deploy platform admin to dev environment" \
  --label "agent-task,platform-admin-portal,priority:high" \
  --assignee "@me" \
  --body "## Task: Deploy Platform Admin Portal to Development Environment

### Objective
Deploy the Lexara platform admin portal to dev environment with monitoring capabilities.

### Requirements
1. **Deploy worker**: \`wrangler deploy --env dev\`
2. **Deploy durable objects**: Platform audit log and session management
3. **Test authentication**:
   - Lexara employee login
   - Role-based access control
   - Session management
4. **Test monitoring features**:
   - System health dashboard
   - Audit log viewing
   - User activity monitoring
   - Platform metrics
5. **Test admin functions**:
   - User management across firms
   - System configuration
   - Security controls

### Acceptance Criteria
- [ ] Worker and UI deployed successfully
- [ ] Authentication restricts to Lexara employees
- [ ] All monitoring dashboards functional
- [ ] Audit logs capture platform events
- [ ] Admin controls work properly
- [ ] Real-time metrics display

### Report Back
Create an agent-message issue with deployment URL and feature validation checklist."

echo "All deployment validation issues created successfully!"
echo "Component agents should now validate their deployments and report back."