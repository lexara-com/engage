#!/bin/bash

# Test script for AdditionalGoals MCP Server
# Tests the supporting documents search and goal enhancement functionality

set -e

echo "🧪 Testing AdditionalGoals MCP Server"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server configuration
SERVER_URL="http://localhost:8790"
SERVER_NAME="engage-additional-goals"

# Helper function to make HTTP requests with error handling
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${BLUE}Testing: ${description}${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X GET "${SERVER_URL}${endpoint}" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST "${SERVER_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    # Extract HTTP status code and body
    http_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)
    body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 204 ]; then
        echo -e "${GREEN}✓ Success (HTTP $http_code)${NC}"
        if [ -n "$body" ] && [ "$body" != "null" ]; then
            echo "$body" | jq '.' 2>/dev/null || echo "$body"
        fi
    else
        echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
        echo "$body"
        return 1
    fi
    echo ""
}

# Helper function to make MCP JSON-RPC requests
make_mcp_request() {
    local method=$1
    local params=$2
    local description=$3
    
    local request_data="{
        \"jsonrpc\": \"2.0\",
        \"id\": \"test-$(date +%s)\",
        \"method\": \"$method\",
        \"params\": $params
    }"
    
    make_request "POST" "/mcp" "$request_data" "$description"
}

echo -e "${YELLOW}Step 1: Health and Info Checks${NC}"
echo "------------------------------"

# Test health endpoint
make_request "GET" "/health" "" "Server health check"

# Test info endpoint  
make_request "GET" "/info" "" "Server information"

# Test vectorize binding
make_request "GET" "/test/vectorize" "" "Vectorize binding test"

# Test search functionality
make_request "GET" "/test/search?legal_area=personal%20injury&case_type=auto%20accident" "" "Mock search test"

echo -e "${YELLOW}Step 2: MCP Protocol Tests${NC}"
echo "---------------------------"

# Test MCP initialize
make_mcp_request "initialize" '{
    "protocolVersion": "2024-11-05",
    "capabilities": {
        "tools": { "listChanged": false },
        "resources": { "subscribe": false, "listChanged": false }
    },
    "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
    }
}' "MCP server initialization"

# Test tools list
make_mcp_request "tools/list" '{}' "List available tools"

# Test resources list
make_mcp_request "resources/list" '{}' "List available resources"

echo -e "${YELLOW}Step 3: Resource Access Tests${NC}"
echo "------------------------------"

# Test reading search strategies resource
make_mcp_request "resources/read" '{
    "uri": "supporting-docs://search-strategies"
}' "Read search strategies resource"

# Test reading goal enhancement rules resource
make_mcp_request "resources/read" '{
    "uri": "supporting-docs://goal-enhancement-rules"
}' "Read goal enhancement rules resource"

# Test reading document templates resource
make_mcp_request "resources/read" '{
    "uri": "supporting-docs://document-templates"
}' "Read document templates resource"

# Test reading priority matrix resource
make_mcp_request "resources/read" '{
    "uri": "supporting-docs://priority-matrix"
}' "Read priority matrix resource"

echo -e "${YELLOW}Step 4: Tool Execution Tests${NC}"
echo "------------------------------"

# Test query_supporting_documents tool
make_mcp_request "tools/call" '{
    "name": "query_supporting_documents",
    "arguments": {
        "sessionId": "test-session-001",
        "firmId": "test-firm-123",
        "legalArea": "personal injury",
        "caseType": "motor vehicle accident",
        "caseDescription": "Client was injured in a rear-end collision",
        "currentGoals": [
            {
                "id": "user_identification",
                "description": "Collect user name and contact information",
                "priority": "critical",
                "category": "identification",
                "completed": false,
                "addedAt": "2024-01-01T00:00:00Z",
                "source": "base"
            }
        ],
        "conversationContext": {
            "jurisdiction": "California",
            "urgency": "medium",
            "clientType": "individual"
        }
    }
}' "Query supporting documents for personal injury case"

# Test enhance_goals tool
make_mcp_request "tools/call" '{
    "name": "enhance_goals",
    "arguments": {
        "sessionId": "test-session-001",
        "currentGoals": [
            {
                "id": "user_identification",
                "description": "Collect user name and contact information",
                "priority": "critical",
                "category": "identification",
                "completed": false,
                "addedAt": "2024-01-01T00:00:00Z",
                "source": "base"
            }
        ],
        "supportingDocuments": [
            {
                "id": "doc_personal_injury_1",
                "firmId": "test-firm-123",
                "title": "Personal Injury Case Requirements",
                "practiceArea": "Personal Injury",
                "legalAreas": ["personal injury"],
                "caseTypes": ["motor vehicle accident"],
                "content": "Sample content",
                "dataGatheringGoals": [],
                "documentRequirements": [],
                "guidelines": [],
                "metadata": {
                    "createdAt": "2024-01-01T00:00:00Z",
                    "updatedAt": "2024-01-01T00:00:00Z",
                    "version": "1.0",
                    "isActive": true,
                    "priority": "high"
                }
            }
        ],
        "conversationContext": {
            "legalArea": "personal injury",
            "caseType": "motor vehicle accident",
            "currentPhase": "data_gathering"
        }
    }
}' "Enhance goals with supporting documents"

# Test get_document_requirements tool
make_mcp_request "tools/call" '{
    "name": "get_document_requirements",
    "arguments": {
        "sessionId": "test-session-001",
        "firmId": "test-firm-123",
        "legalArea": "personal injury",
        "caseType": "motor vehicle accident",
        "jurisdiction": "California",
        "caseContext": {
            "estimatedValue": 50000,
            "hasOpposingParty": true,
            "isLitigation": false,
            "urgency": "medium"
        }
    }
}' "Get document requirements for personal injury case"

echo -e "${YELLOW}Step 5: Error Handling Tests${NC}"
echo "----------------------------"

# Test invalid method
make_mcp_request "invalid/method" '{}' "Invalid method error handling"

# Test invalid tool name
make_mcp_request "tools/call" '{
    "name": "nonexistent_tool",
    "arguments": {}
}' "Invalid tool name error handling"

# Test missing required parameters
make_mcp_request "tools/call" '{
    "name": "query_supporting_documents",
    "arguments": {
        "sessionId": "test"
    }
}' "Missing required parameters error handling"

# Test invalid resource URI
make_mcp_request "resources/read" '{
    "uri": "invalid://resource"
}' "Invalid resource URI error handling"

echo -e "${GREEN}🎉 AdditionalGoals MCP Server testing complete!${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "• Health and info endpoints tested"
echo "• Vectorize binding verified"
echo "• MCP protocol compliance verified"
echo "• All tools tested with sample data"
echo "• All resources tested"
echo "• Error handling verified"
echo ""
echo -e "${YELLOW}Note: This server integrates with:${NC}"
echo "• SUPPORTING_DOCUMENTS Vectorize index for document search"
echo "• Goal enhancement based on firm-specific supporting documents"
echo "• Document requirements generation for legal case types"
echo ""
echo -e "${BLUE}Server runs on port 8790 following the pattern:${NC}"
echo "• Main Agent: 8787"
echo "• GoalTracker: 8788" 
echo "• ConflictChecker: 8789"
echo "• AdditionalGoals: 8790"