#!/bin/bash

# Comprehensive Firm Registration Test Suite
echo "🧪 Comprehensive Firm Registration Test Suite"
echo "============================================"

API_URL="${API_URL:-https://dev-www.lexara.app}"
LOCAL_URL="http://localhost:3000"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running locally
if curl -s -o /dev/null -w "%{http_code}" "$LOCAL_URL/health" 2>/dev/null | grep -q "200"; then
    echo -e "${GREEN}✅ Using local server at $LOCAL_URL${NC}"
    BASE_URL=$LOCAL_URL
else
    echo -e "${YELLOW}📡 Using deployed server at $API_URL${NC}"
    BASE_URL=$API_URL
fi

echo ""
echo "Testing endpoint: $BASE_URL/api/v1/firm/register"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local request_body="$2"
    local expected_status="$3"
    local expected_response="$4"
    
    echo -n "Testing: $test_name... "
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/firm/register" \
        -H "Content-Type: application/json" \
        -d "$request_body")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "$expected_status" ]; then
        if echo "$BODY" | grep -q "$expected_response"; then
            echo -e "${GREEN}✅ PASSED${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}❌ FAILED - Wrong response${NC}"
            echo "Expected: $expected_response"
            echo "Got: $BODY"
            ((TESTS_FAILED++))
        fi
    else
        echo -e "${RED}❌ FAILED - Wrong status code${NC}"
        echo "Expected: $expected_status, Got: $HTTP_CODE"
        echo "Response: $BODY"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Test 1: Missing required fields
run_test "Missing required fields" \
    '{"firmName": "Test Firm"}' \
    "400" \
    "VALIDATION_ERROR"

# Test 2: Weak password
run_test "Weak password" \
    '{
        "plan": "starter",
        "firmName": "Test Law Firm",
        "firmSize": "1-5",
        "practiceAreas": ["personal_injury"],
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@test.com",
        "password": "weak",
        "agreedToTerms": true
    }' \
    "400" \
    "PASSWORD_TOO_WEAK"

# Test 3: Terms not accepted
run_test "Terms not accepted" \
    '{
        "plan": "starter",
        "firmName": "Test Law Firm",
        "firmSize": "1-5",
        "practiceAreas": ["personal_injury"],
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@test.com",
        "password": "SecurePass123!",
        "agreedToTerms": false
    }' \
    "400" \
    "TERMS_NOT_ACCEPTED"

# Test 4: Empty request body
run_test "Empty request body" \
    '{}' \
    "400" \
    "VALIDATION_ERROR"

# Test 5: Missing email
run_test "Missing email" \
    '{
        "plan": "starter",
        "firmName": "Test Law Firm",
        "firmSize": "1-5",
        "practiceAreas": ["personal_injury"],
        "firstName": "John",
        "lastName": "Doe",
        "password": "SecurePass123!",
        "agreedToTerms": true
    }' \
    "400" \
    "VALIDATION_ERROR"

# Test 6: Valid registration (will fail if Auth0/DB not configured)
TIMESTAMP=$(date +%s)
echo -e "${YELLOW}Running full registration test...${NC}"
run_test "Valid registration attempt" \
    "{
        \"plan\": \"starter\",
        \"firmName\": \"Test Law Firm $TIMESTAMP\",
        \"firmSize\": \"1-5\",
        \"practiceAreas\": [\"personal_injury\", \"family_law\"],
        \"firstName\": \"John\",
        \"lastName\": \"Doe\",
        \"email\": \"john+$TIMESTAMP@testfirm.com\",
        \"password\": \"SecurePass123!\",
        \"agreedToTerms\": true
    }" \
    "201" \
    "success.*true"

# Summary
echo ""
echo "=========================================="
echo "Test Summary:"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed!${NC}"
    
    # Check for common issues
    if curl -s "$BASE_URL/api/v1/firm/register" -X POST -H "Content-Type: application/json" -d '{}' | grep -q "Auth0 configuration missing"; then
        echo ""
        echo -e "${YELLOW}⚠️  Auth0 is not configured. Run:${NC}"
        echo "cd apps/homepage && ./scripts/configure-auth0.sh"
    fi
    
    if curl -s "$BASE_URL/api/v1/firm/register" -X POST -H "Content-Type: application/json" -d '{}' | grep -q "Database not configured"; then
        echo ""
        echo -e "${YELLOW}⚠️  D1 Database is not configured. Run:${NC}"
        echo "cd apps/homepage && ./scripts/setup-d1-database.sh"
    fi
    
    exit 1
fi