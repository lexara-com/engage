# Engage System - Deployment Checklist

## Pre-Deployment Checklist

### Environment Setup
- [ ] Cloudflare account configured with Workers, Pages, and Vectorize enabled
- [ ] Anthropic API key obtained and ready
- [ ] Node.js and npm installed locally
- [ ] Wrangler CLI installed and authenticated
- [ ] Git repository cloned and up to date

### Dependencies & Configuration
- [ ] `npm install` completed successfully
- [ ] `wrangler.toml` files reviewed and updated with correct names/environments
- [ ] Environment variables set in wrangler.toml
- [ ] Vectorize indexes created: `engage-conflicts` and `engage-goals`
- [ ] TypeScript compilation passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`

### Secrets Management
- [ ] ANTHROPIC_API_KEY secret created: `echo "sk-ant-..." | wrangler secret put ANTHROPIC_API_KEY --env production`
- [ ] Secrets verified: `wrangler secret list --env production`
- [ ] No API keys committed to git (check with `git log --oneline -p | grep -i "sk-ant"`)

## Deployment Sequence

### Step 1: Deploy MCP Servers (REQUIRED FIRST)
```bash
# Terminal commands to run in sequence:
cd workers/goal-tracker-mcp
wrangler deploy --env production
# Wait for deployment to complete, note the URL

cd ../conflict-checker-mcp  
wrangler deploy --env production
# Wait for deployment to complete, note the URL

cd ../additional-goals-mcp
wrangler deploy --env production  
# Wait for deployment to complete, note the URL
cd ../..
```

**Verification**:
- [ ] GoalTracker MCP deployed successfully
- [ ] ConflictChecker MCP deployed successfully  
- [ ] AdditionalGoals MCP deployed successfully
- [ ] All MCP URLs noted and added to main wrangler.toml

### Step 2: Update Main Agent Configuration
```bash
# Update wrangler.toml with correct MCP URLs
[env.production.vars]
GOAL_TRACKER_URL = "https://goal-tracker-mcp-production.cloudswift.workers.dev"
CONFLICT_CHECKER_URL = "https://conflict-checker-mcp-production.cloudswift.workers.dev"  
ADDITIONAL_GOALS_URL = "https://additional-goals-mcp-production.cloudswift.workers.dev"
```

**Checklist**:
- [ ] URLs updated in wrangler.toml
- [ ] File saved and committed to git

### Step 3: Deploy Main Agent
```bash
npm run deploy:production
```

**Verification**:
- [ ] Main agent deployed successfully
- [ ] Deployment URL noted (e.g., `https://engage-legal-ai-production.cloudswift.workers.dev`)
- [ ] No deployment errors in console output

### Step 4: Deploy Frontend UI
```bash
npm run build:ui
npx wrangler pages deploy dist --project-name engage-ui
```

**Verification**:
- [ ] Build completed without errors
- [ ] Pages deployment successful  
- [ ] Frontend URL noted (e.g., `https://abc123.engage-ui.pages.dev`)
- [ ] No build warnings that affect functionality

## Post-Deployment Verification

### Backend API Tests
```bash
# Test 1: Session Creation
curl -X POST "https://engage-legal-ai-production.cloudswift.workers.dev/api/v1/conversations" \
  -H "Content-Type: application/json" \
  -d '{"firmId": "firm_test_123"}'

# Expected: JSON response with sessionId, userId, etc.
```

- [ ] Session creation returns valid JSON with sessionId
- [ ] Response time under 5 seconds
- [ ] No error status codes

```bash
# Test 2: Message Processing (use sessionId from Test 1)
curl -X POST "https://engage-legal-ai-production.cloudswift.workers.dev/api/v1/conversations/message" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "SESSION_ID_HERE", "message": "Hello, I need legal help"}'

# Expected: JSON response with AI-generated message
```

- [ ] Message processing returns AI response
- [ ] Response contains appropriate legal AI content
- [ ] Response time under 10 seconds

### Frontend API Tests
```bash
# Test 3: UI Session Creation
curl -X POST "https://NEW_UI_URL.engage-ui.pages.dev/api/chat/session" \
  -H "Content-Type: application/json" \
  -d '{"firmId": "firm_test_123"}'

# Expected: {"success": true, "sessionId": "...", "data": {...}}
```

- [ ] UI session creation returns success format
- [ ] sessionId field present and non-empty
- [ ] success field equals true

```bash  
# Test 4: UI Message Sending (use sessionId from Test 3)
curl -X POST "https://NEW_UI_URL.engage-ui.pages.dev/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "SESSION_ID_HERE", "message": "Hello"}'

# Expected: Server-Sent Events stream with data: lines
```

- [ ] Chat API returns SSE format (data: lines)
- [ ] Content includes AI response
- [ ] Stream ends with completion signal

### MCP Server Tests
```bash
# Test 5: GoalTracker MCP
curl -X POST "https://goal-tracker-mcp-production.cloudswift.workers.dev/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'

# Test 6: ConflictChecker MCP  
curl -X POST "https://conflict-checker-mcp-production.cloudswift.workers.dev/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'

# Test 7: AdditionalGoals MCP
curl -X POST "https://additional-goals-mcp-production.cloudswift.workers.dev/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

- [ ] All MCP servers respond with tools list
- [ ] JSON-RPC format responses
- [ ] No error messages in responses

### End-to-End UI Test
1. [ ] Open frontend URL in browser
2. [ ] Legal disclaimer modal appears and functions
3. [ ] Chat interface loads without errors
4. [ ] Can type in message input field
5. [ ] Sending message triggers AI response
6. [ ] AI response appears in chat bubbles
7. [ ] No console errors in browser developer tools
8. [ ] Session persists on page refresh

## Common Deployment Issues & Solutions

### Issue 1: "Failed to create backend session: undefined"
**Symptoms**: Frontend console shows session creation undefined
**Solution**:
```bash
# Check if session API returns correct format
curl -X POST "https://UI_URL/api/chat/session" -H "Content-Type: application/json" -d '{"firmId": "test"}'
# Should return: {"success": true, "sessionId": "...", "data": {...}}
```
- [ ] Fix applied if needed
- [ ] Redeployed frontend
- [ ] Verified fix working

### Issue 2: "401 Unauthorized" from Anthropic
**Symptoms**: Backend logs show 401 errors
**Solution**:
```bash
# Recreate the API key secret
wrangler secret delete ANTHROPIC_API_KEY --env production
echo "sk-ant-YOUR-KEY-HERE" | wrangler secret put ANTHROPIC_API_KEY --env production
```
- [ ] Secret recreated
- [ ] Backend redeployed (if needed)
- [ ] API calls working

### Issue 3: MCP Servers Not Responding
**Symptoms**: Agent fails to call MCP tools, logs show connection errors
**Solution**:
```bash
# Check MCP server status
curl -X POST "https://EACH_MCP_URL/mcp" -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'

# Verify URLs in main wrangler.toml match deployed MCP URLs
```
- [ ] All MCP servers responding
- [ ] URLs correct in main agent config
- [ ] Main agent redeployed if URLs changed

### Issue 4: Custom Domain Route Errors
**Symptoms**: Deployment fails with route assignment errors
**Solution**:
```toml
# In wrangler.toml, ensure:
workers_dev = true
# Remove any custom route configurations
```
- [ ] workers_dev = true set
- [ ] Custom routes removed
- [ ] Redeployed successfully

## Performance Verification

### Response Time Benchmarks
- [ ] Session creation: < 3 seconds
- [ ] First AI message: < 10 seconds  
- [ ] Subsequent messages: < 5 seconds
- [ ] Page load time: < 2 seconds
- [ ] MCP tool calls: < 2 seconds each

### Load Testing (Optional)
```bash
# Simple load test with curl
for i in {1..10}; do
  time curl -X POST "https://API_URL/api/v1/conversations" \
    -H "Content-Type: application/json" \
    -d '{"firmId": "test"}' &
done
wait
```
- [ ] All requests complete successfully
- [ ] No timeouts under moderate load
- [ ] Response times remain consistent

## Security Verification

### Security Checklist
- [ ] No API keys visible in browser network tab
- [ ] HTTPS enforced on all endpoints
- [ ] CORS headers properly configured
- [ ] Legal disclaimers present and functional
- [ ] No sensitive data logged in console
- [ ] Input sanitization working (test with special characters)

### Security Test Commands
```bash
# Test CORS
curl -H "Origin: https://malicious.com" -X POST "https://API_URL/api/v1/conversations"
# Should reject or limit access

# Test input sanitization  
curl -X POST "https://API_URL/api/v1/conversations/message" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test", "message": "<script>alert(1)</script>"}'
# Should sanitize script tags
```
- [ ] CORS working correctly
- [ ] Input sanitization effective
- [ ] No script injection possible

## Final Deployment Sign-off

### Documentation Updated
- [ ] README.md reflects current deployment URLs
- [ ] CLAUDE.md updated with any new requirements
- [ ] ENGAGE_SYSTEM_DOCUMENTATION.md current
- [ ] TECHNICAL_REFERENCE.md current
- [ ] This checklist completed

### Monitoring Setup
- [ ] Cloudflare dashboard bookmarked
- [ ] Wrangler CLI working for log monitoring
- [ ] Key metrics baseline established
- [ ] Alert thresholds configured (if available)

### Handoff Information
**Current Deployment URLs (Update with actual URLs)**:
- Frontend: https://[DEPLOYMENT_ID].engage-ui.pages.dev
- Backend API: https://engage-legal-ai-production.cloudswift.workers.dev
- GoalTracker MCP: https://goal-tracker-mcp-production.cloudswift.workers.dev
- ConflictChecker MCP: https://conflict-checker-mcp-production.cloudswift.workers.dev
- AdditionalGoals MCP: https://additional-goals-mcp-production.cloudswift.workers.dev

**Critical Commands for Maintenance**:
```bash
# Monitor logs
wrangler tail --env production

# Redeploy if needed
npm run deploy:production

# Update frontend
npm run build:ui && npx wrangler pages deploy dist --project-name engage-ui

# Recreate API key
echo "sk-ant-..." | wrangler secret put ANTHROPIC_API_KEY --env production
```

### Final Verification
- [ ] All system components deployed and functional
- [ ] End-to-end user flow tested and working
- [ ] Performance within acceptable limits
- [ ] Security measures verified
- [ ] Documentation complete and current
- [ ] Team notified of successful deployment

**Deployment completed by**: ________________  
**Date**: ________________  
**Deployment version/commit**: ________________

## Emergency Rollback Procedures

If critical issues are discovered post-deployment:

### Immediate Actions
1. [ ] Note the specific issue and affected components
2. [ ] Check if issue is in frontend, backend, or MCP servers
3. [ ] Verify if rollback is needed or if quick fix is possible

### Rollback Commands
```bash
# Rollback main agent (replace VERSION with previous working version)
wrangler rollback --env production --version VERSION

# Rollback frontend (redeploy previous working commit)
git checkout PREVIOUS_WORKING_COMMIT
npm run build:ui && npx wrangler pages deploy dist --project-name engage-ui

# Rollback MCP servers if needed
cd workers/PROBLEMATIC_MCP
wrangler rollback --env production --version VERSION
```

### Post-Rollback
- [ ] Verify system functionality restored
- [ ] Document issue for future prevention
- [ ] Plan fix for next deployment cycle

This checklist ensures systematic, reliable deployments of the Engage system.