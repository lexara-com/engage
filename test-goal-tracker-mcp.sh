#!/bin/bash

# Test script for GoalTracker MCP Server

echo "🎯 Testing GoalTracker MCP Server"
echo "================================="

MCP_URL="http://localhost:8788/mcp"

# Test 1: Initialize MCP Server
echo "1. Initializing MCP server..."
INIT_RESPONSE=$(curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {
        "tools": {},
        "resources": {}
      },
      "clientInfo": {
        "name": "engage-agent",
        "version": "1.0.0"
      }
    }
  }')

echo "Initialize Response: $INIT_RESPONSE"
echo ""

# Test 2: Send initialized notification
echo "2. Sending initialized notification..."
curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialized"
  }' > /dev/null

echo "Initialized notification sent"
echo ""

# Test 3: List tools
echo "3. Listing available tools..."
TOOLS_RESPONSE=$(curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }')

echo "Tools Response: $TOOLS_RESPONSE"
echo ""

# Test 4: List resources
echo "4. Listing available resources..."
RESOURCES_RESPONSE=$(curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "resources/list"
  }')

echo "Resources Response: $RESOURCES_RESPONSE"
echo ""

# Test 5: Read base goals resource
echo "5. Reading base goals resource..."
BASE_GOALS_RESPONSE=$(curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "resources/read",
    "params": {
      "uri": "goal://base-goals"
    }
  }')

echo "Base Goals Response: $BASE_GOALS_RESPONSE"
echo ""

# Test 6: Call assess_goals tool
echo "6. Testing assess_goals tool..."
ASSESS_RESPONSE=$(curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "assess_goals",
      "arguments": {
        "sessionId": "test-session-123",
        "firmId": "firm_test_123", 
        "conversationHistory": [
          {"role": "user", "content": "Hello, I need help with a legal matter."},
          {"role": "agent", "content": "I can help you. Could you please share your name?"},
          {"role": "user", "content": "My name is John Doe and my email is john.doe@example.com"},
          {"role": "agent", "content": "Thank you, John. What type of legal matter do you need help with?"},
          {"role": "user", "content": "I was in a car accident last week and need help with the insurance claim"}
        ],
        "currentGoals": [
          {
            "id": "user_identification",
            "priority": "critical",
            "category": "identification",
            "completed": false
          },
          {
            "id": "legal_needs_assessment", 
            "priority": "critical",
            "category": "legal_context",
            "completed": false
          }
        ],
        "userIdentity": {
          "name": "John Doe",
          "email": "john.doe@example.com"
        }
      }
    }
  }')

echo "Assess Goals Response: $ASSESS_RESPONSE"
echo ""

# Test 7: Get agent recommendations
echo "7. Testing get_agent_recommendations tool..."
RECOMMENDATIONS_RESPONSE=$(curl -s -X POST $MCP_URL \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "tools/call",
    "params": {
      "name": "get_agent_recommendations",
      "arguments": {
        "sessionId": "test-session-123",
        "currentPhase": "pre_login",
        "goalStatus": {
          "completedGoals": ["user_identification"],
          "incompleteGoals": [
            {
              "id": "legal_needs_assessment",
              "priority": "critical"
            }
          ],
          "readyForNextPhase": false,
          "confidence": 0.6
        },
        "conflictStatus": "pending"
      }
    }
  }')

echo "Agent Recommendations Response: $RECOMMENDATIONS_RESPONSE"
echo ""

echo "✅ GoalTracker MCP Server tests completed!"
echo "🔍 Check responses above to verify MCP protocol compliance"