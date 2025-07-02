#!/bin/bash

echo "🧪 Testing Admin API..."
echo "========================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Set up test environment
export NODE_ENV=test
export AUTH0_DOMAIN=test.auth0.com
export AUTH0_AUDIENCE=https://api.engage.lexara.com

# Function to make API calls
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    local expected_status=$5
    
    echo -e "\n${YELLOW}Testing: ${method} ${endpoint}${NC}"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X ${method} \
            -H "Authorization: Bearer ${token}" \
            -H "Content-Type: application/json" \
            "http://localhost:8787/v1/admin${endpoint}")
    else
        response=$(curl -s -w "\n%{http_code}" -X ${method} \
            -H "Authorization: Bearer ${token}" \
            -H "Content-Type: application/json" \
            -d "${data}" \
            "http://localhost:8787/v1/admin${endpoint}")
    fi
    
    # Extract status code and body
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ Status: ${status_code} (expected: ${expected_status})${NC}"
        echo "Response: ${body}" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ Status: ${status_code} (expected: ${expected_status})${NC}"
        echo "Response: ${body}" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

# Generate a mock JWT token (in real tests, use proper JWT library)
MOCK_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QHRlc3RmaXJtLmNvbSIsImh0dHBzOi8vZW5nYWdlLmxleGFyYS5jb20vZmlybV9pZCI6IjAxSEs4WjFYMlkzVjRXNUE2QjdDOEQ5RTBGIiwiaHR0cHM6Ly9lbmdhZ2UubGV4YXJhLmNvbS9yb2xlIjoiYWRtaW4iLCJwZXJtaXNzaW9ucyI6WyJjb252ZXJzYXRpb25zOnJlYWQiLCJjb252ZXJzYXRpb25zOndyaXRlIiwiY29udmVyc2F0aW9uczpkZWxldGUiXSwiaWF0IjoxNzA0MDY3MjAwLCJleHAiOjE3MzU2ODk2MDB9.test-signature"

FIRM_ID="01HK8Z1X2Y3V4W5A6B7C8D9E0F"
CONVERSATION_ID="01HK8Z2X3Y4V5W6A7B8C9D0E1F"

echo -e "\n${YELLOW}Starting Admin API tests...${NC}"

# Test 1: Health check (no auth required)
test_endpoint "GET" "/health" "" "" "200"

# Test 2: Unauthorized request
echo -e "\n${YELLOW}Testing authentication...${NC}"
response=$(curl -s -w "\n%{http_code}" http://localhost:8787/v1/admin/firms)
status_code=$(echo "$response" | tail -n1)
if [ "$status_code" = "401" ]; then
    echo -e "${GREEN}✓ Unauthorized request correctly rejected${NC}"
else
    echo -e "${RED}✗ Unauthorized request not rejected (status: ${status_code})${NC}"
fi

# Test 3: List conversations
test_endpoint "GET" "/firms/${FIRM_ID}/conversations" "" "$MOCK_TOKEN" "200"

# Test 4: List conversations with filters
test_endpoint "GET" "/firms/${FIRM_ID}/conversations?status=active&limit=5" "" "$MOCK_TOKEN" "200"

# Test 5: Get conversation details
test_endpoint "GET" "/firms/${FIRM_ID}/conversations/${CONVERSATION_ID}" "" "$MOCK_TOKEN" "200"

# Test 6: Update conversation metadata
UPDATE_DATA='{
  "priority": "high",
  "assignedTo": "attorney-999",
  "tags": ["urgent", "vip-client"]
}'
test_endpoint "PUT" "/firms/${FIRM_ID}/conversations/${CONVERSATION_ID}" "$UPDATE_DATA" "$MOCK_TOKEN" "200"

# Test 7: Add internal note
NOTE_DATA='{
  "note": "Test note from API testing",
  "type": "assessment"
}'
test_endpoint "POST" "/firms/${FIRM_ID}/conversations/${CONVERSATION_ID}/notes" "$NOTE_DATA" "$MOCK_TOKEN" "201"

# Test 8: Perform action
ACTION_DATA='{
  "action": "mark_urgent",
  "note": "Client needs immediate attention"
}'
test_endpoint "POST" "/firms/${FIRM_ID}/conversations/${CONVERSATION_ID}/actions" "$ACTION_DATA" "$MOCK_TOKEN" "200"

# Test 9: Test pagination
test_endpoint "GET" "/firms/${FIRM_ID}/conversations?page=2&limit=1" "" "$MOCK_TOKEN" "200"

# Test 10: Search conversations
test_endpoint "GET" "/firms/${FIRM_ID}/conversations?search=john" "" "$MOCK_TOKEN" "200"

# Test 11: CORS preflight
echo -e "\n${YELLOW}Testing CORS...${NC}"
response=$(curl -s -w "\n%{http_code}" -X OPTIONS \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Authorization" \
    "http://localhost:8787/v1/admin/firms")
status_code=$(echo "$response" | tail -n1)
if [ "$status_code" = "204" ]; then
    echo -e "${GREEN}✓ CORS preflight handled correctly${NC}"
else
    echo -e "${RED}✗ CORS preflight failed (status: ${status_code})${NC}"
fi

# Test 12: Non-existent endpoint
test_endpoint "GET" "/unknown-endpoint" "" "$MOCK_TOKEN" "404"

echo -e "\n${GREEN}✅ Admin API tests completed!${NC}"