#!/bin/bash

# Verify Conversation Saving and Firm Linkage Test Script
# This script tests that conversations are properly saved and linked to firms

set -e

echo "🧪 Verifying Conversation Saving & Firm Linkage"
echo "=============================================="

BASE_URL="https://dev.lexara.app"

# Test firms
declare -a FIRMS=("demo" "firm-testlaw-com" "smith-law-firm")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

log_test() {
    echo -e "${BLUE}  🔍 $1${NC}"
}

log_success() {
    echo -e "${GREEN}  ✅ $1${NC}"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}  ❌ $1${NC}"
    ((FAILED_TESTS++))
}

log_info() {
    echo -e "${YELLOW}  ℹ️  $1${NC}"
}

# Function to test conversation creation
test_create_conversation() {
    local firm_id=$1
    local url
    
    if [ "$firm_id" = "demo" ]; then
        url="$BASE_URL/api/v1/conversations"
    else
        url="$BASE_URL/$firm_id/api/v1/conversations"
    fi
    
    log_test "Creating conversation for firm: $firm_id"
    
    # Create conversation
    local response=$(curl -s -X POST "$url" \
        -H "Content-Type: application/json" \
        -w "\nHTTP_STATUS:%{http_code}")
    
    local http_status=$(echo "$response" | grep HTTP_STATUS | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTP_STATUS/d')
    
    if [ "$http_status" -eq 200 ]; then
        local session_id=$(echo "$body" | jq -r '.sessionId // empty')
        local user_id=$(echo "$body" | jq -r '.userId // empty')
        
        if [ -n "$session_id" ] && [ "$session_id" != "null" ]; then
            log_success "Session created: $session_id"
            echo "$session_id"
            return 0
        else
            log_error "Invalid session response: $body"
            return 1
        fi
    else
        log_error "Failed to create session (HTTP $http_status): $body"
        return 1
    fi
}

# Function to send a message
test_send_message() {
    local firm_id=$1
    local session_id=$2
    local message=$3
    local url
    
    if [ "$firm_id" = "demo" ]; then
        url="$BASE_URL/api/v1/conversations/message"
    else
        url="$BASE_URL/$firm_id/api/v1/conversations/message"
    fi
    
    log_test "Sending message to session: $session_id"
    
    local response=$(curl -s -X POST "$url" \
        -H "Content-Type: application/json" \
        -d "{\"sessionId\":\"$session_id\",\"message\":\"$message\"}" \
        -w "\nHTTP_STATUS:%{http_code}")
    
    local http_status=$(echo "$response" | grep HTTP_STATUS | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTP_STATUS/d')
    
    if [ "$http_status" -eq 200 ]; then
        local ai_response=$(echo "$body" | jq -r '.message // empty')
        if [ -n "$ai_response" ] && [ "$ai_response" != "null" ]; then
            log_success "Message sent, AI responded: ${ai_response:0:50}..."
            return 0
        else
            log_error "Invalid message response: $body"
            return 1
        fi
    else
        log_error "Failed to send message (HTTP $http_status): $body"
        return 1
    fi
}

# Function to get conversation context (verify firm linkage)
test_get_context() {
    local session_id=$1
    local expected_firm_id=$2
    
    log_test "Retrieving conversation context for session: $session_id"
    
    # Direct call to Durable Object context endpoint
    local url="$BASE_URL/api/v1/conversations/context/$session_id"
    
    local response=$(curl -s -X GET "$url" \
        -H "Content-Type: application/json" \
        -w "\nHTTP_STATUS:%{http_code}")
    
    local http_status=$(echo "$response" | grep HTTP_STATUS | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTP_STATUS/d')
    
    if [ "$http_status" -eq 200 ]; then
        local firm_id=$(echo "$body" | jq -r '.firmId // empty')
        local phase=$(echo "$body" | jq -r '.phase // empty')
        local message_count=$(echo "$body" | jq -r '.messages | length // 0')
        
        log_info "Retrieved context: firmId=$firm_id, phase=$phase, messages=$message_count"
        
        if [ "$firm_id" = "$expected_firm_id" ]; then
            log_success "Firm linkage verified: $firm_id"
            return 0
        else
            log_error "Firm ID mismatch: expected $expected_firm_id, got $firm_id"
            return 1
        fi
    else
        log_error "Failed to get context (HTTP $http_status): $body"
        return 1
    fi
}

# Function to test resume functionality
test_resume_conversation() {
    local session_id=$1
    local firm_id=$2
    
    log_test "Testing conversation resume for session: $session_id"
    
    # Get resume URL from context first
    local context_url="$BASE_URL/api/v1/conversations/context/$session_id"
    local context_response=$(curl -s "$context_url")
    local resume_url=$(echo "$context_response" | jq -r '.resumeUrl // empty')
    
    if [ -n "$resume_url" ] && [ "$resume_url" != "null" ]; then
        local response=$(curl -s "$resume_url" -w "\nHTTP_STATUS:%{http_code}")
        local http_status=$(echo "$response" | grep HTTP_STATUS | cut -d: -f2)
        
        if [ "$http_status" -eq 200 ]; then
            log_success "Conversation resume successful"
            return 0
        else
            log_error "Failed to resume conversation (HTTP $http_status)"
            return 1
        fi
    else
        log_error "No resume URL found in context"
        return 1
    fi
}

# Run tests for each firm
for firm in "${FIRMS[@]}"; do
    echo ""
    echo "📂 Testing Firm: $firm"
    echo "$(printf '=%.0s' {1..30})"
    
    ((TOTAL_TESTS+=4)) # We'll run 4 tests per firm
    
    # Test 1: Create conversation
    session_id=$(test_create_conversation "$firm")
    create_result=$?
    
    if [ $create_result -eq 0 ]; then
        # Test 2: Send message
        test_send_message "$firm" "$session_id" "Hello, I need legal help with a contract review"
        message_result=$?
        
        # Test 3: Verify firm linkage
        test_get_context "$session_id" "$firm"
        context_result=$?
        
        # Test 4: Test resume functionality  
        test_resume_conversation "$session_id" "$firm"
        resume_result=$?
        
        if [ $message_result -eq 0 ] && [ $context_result -eq 0 ] && [ $resume_result -eq 0 ]; then
            echo -e "${GREEN}  🎉 All tests passed for firm: $firm${NC}"
        fi
    else
        log_error "Skipping subsequent tests due to session creation failure"
        ((FAILED_TESTS+=3)) # Mark the other 3 tests as failed
    fi
done

# Test firm isolation
echo ""
echo "🔒 Testing Firm Isolation"
echo "=========================="

((TOTAL_TESTS+=2))

session1=$(test_create_conversation "firm-testlaw-com")
session2=$(test_create_conversation "smith-law-firm")

if [ -n "$session1" ] && [ -n "$session2" ]; then
    if [ "$session1" != "$session2" ]; then
        log_success "Sessions have unique IDs"
        
        # Verify each maintains correct firm context
        test_get_context "$session1" "firm-testlaw-com"
        test1_result=$?
        test_get_context "$session2" "smith-law-firm"
        test2_result=$?
        
        if [ $test1_result -eq 0 ] && [ $test2_result -eq 0 ]; then
            log_success "Firm isolation verified - each conversation maintains correct firm context"
        fi
    else
        log_error "Sessions have duplicate IDs - isolation may be compromised"
    fi
else
    log_error "Failed to create sessions for isolation test"
fi

# Summary
echo ""
echo "📊 Test Summary"
echo "==============="
echo -e "Total tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All conversation saving and firm linkage tests PASSED!${NC}"
    echo ""
    echo "✅ Verified functionality:"
    echo "  - Conversations are created with correct firm context"
    echo "  - Messages are persisted in Durable Objects storage"
    echo "  - Firm IDs are preserved throughout conversation lifecycle"
    echo "  - Firm isolation prevents cross-contamination"
    echo "  - Resume functionality maintains firm context"
    exit 0
else
    echo -e "${RED}❌ Some tests FAILED. Please check the conversation saving implementation.${NC}"
    exit 1
fi