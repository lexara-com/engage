#!/bin/bash

# Test script for Engage Agent and ConversationSession

echo "🤖 Testing Engage AI Agent"
echo "=========================="

# Test 1: Create new conversation
echo "1. Creating new conversation session..."
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8787/api/v1/conversations \
  -H "Content-Type: application/json" \
  -d '{"firmId": "firm_test_123"}')

echo "Create Response: $CREATE_RESPONSE"

# Extract sessionId and resumeUrl from response
SESSION_ID=$(echo $CREATE_RESPONSE | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
RESUME_URL=$(echo $CREATE_RESPONSE | grep -o '"resumeUrl":"[^"]*"' | cut -d'"' -f4)

echo "Session ID: $SESSION_ID"
echo "Resume URL: $RESUME_URL"
echo ""

# Test 2: Send message to agent
echo "2. Testing agent conversation..."
if [ ! -z "$SESSION_ID" ]; then
  AGENT_RESPONSE=$(curl -s -X POST http://localhost:8787/api/v1/conversations/message \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"Hello, I need help with a legal matter.\", \"sessionId\": \"$SESSION_ID\"}")
  
  echo "Agent Response: $AGENT_RESPONSE"
  echo ""
else
  echo "❌ No session ID available for agent testing"
  echo ""
fi

# Test 3: Another message to test conversation flow
echo "3. Testing follow-up conversation..."
if [ ! -z "$SESSION_ID" ]; then
  FOLLOWUP_RESPONSE=$(curl -s -X POST http://localhost:8787/api/v1/conversations/message \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"My name is John Doe and I was in a car accident last week.\", \"sessionId\": \"$SESSION_ID\"}")
  
  echo "Follow-up Response: $FOLLOWUP_RESPONSE"
  echo ""
else
  echo "❌ No session ID available for follow-up testing"
  echo ""
fi

# Test 4: Health check
echo "4. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:8787/health)
echo "Health Response: $HEALTH_RESPONSE"
echo ""

# Test 5: Version endpoint
echo "5. Testing version endpoint..."
VERSION_RESPONSE=$(curl -s http://localhost:8787/api/v1/version)
echo "Version Response: $VERSION_RESPONSE"
echo ""

echo "✅ Agent tests completed!"
echo "🔍 Check responses above to see Claude AI interactions"