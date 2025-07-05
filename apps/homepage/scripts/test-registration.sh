#!/bin/bash

# Test Firm Registration Flow
echo "🧪 Testing Firm Registration Flow..."

API_URL="${API_URL:-https://dev-www.lexara.app}"
LOCAL_URL="http://localhost:3000"

# Check if running locally
if curl -s -o /dev/null -w "%{http_code}" "$LOCAL_URL/health" | grep -q "200"; then
    echo "✅ Using local server at $LOCAL_URL"
    BASE_URL=$LOCAL_URL
else
    echo "📡 Using deployed server at $API_URL"
    BASE_URL=$API_URL
fi

echo ""
echo "Testing endpoint: $BASE_URL/api/v1/firm/register"
echo ""

# Test 1: Missing required fields
echo "Test 1: Missing required fields"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/firm/register" \
  -H "Content-Type: application/json" \
  -d '{
    "firmName": "Test Firm"
  }')
echo "Response: $RESPONSE"
echo ""

# Test 2: Weak password
echo "Test 2: Weak password"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/firm/register" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "starter",
    "firmName": "Test Law Firm",
    "firmSize": "1-5",
    "practiceAreas": ["personal_injury"],
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@test.com",
    "password": "weak",
    "agreedToTerms": true
  }')
echo "Response: $RESPONSE"
echo ""

# Test 3: Terms not accepted
echo "Test 3: Terms not accepted"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/firm/register" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "starter",
    "firmName": "Test Law Firm",
    "firmSize": "1-5",
    "practiceAreas": ["personal_injury"],
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@test.com",
    "password": "SecurePass123!",
    "agreedToTerms": false
  }')
echo "Response: $RESPONSE"
echo ""

# Test 4: Valid registration (will fail if Auth0 not configured)
echo "Test 4: Valid registration attempt"
TIMESTAMP=$(date +%s)
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/firm/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"plan\": \"starter\",
    \"firmName\": \"Test Law Firm $TIMESTAMP\",
    \"firmSize\": \"1-5\",
    \"practiceAreas\": [\"personal_injury\", \"family_law\"],
    \"firstName\": \"John\",
    \"lastName\": \"Doe\",
    \"email\": \"john+$TIMESTAMP@testfirm.com\",
    \"password\": \"SecurePass123!\",
    \"agreedToTerms\": true
  }")
echo "Response: $RESPONSE"
echo ""

# Parse response and check for success
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Registration successful!"
    FIRM_ID=$(echo "$RESPONSE" | grep -o '"firmId":"[^"]*"' | cut -d'"' -f4)
    echo "Firm ID: $FIRM_ID"
elif echo "$RESPONSE" | grep -q "Auth0 configuration missing"; then
    echo "⚠️  Registration failed: Auth0 not configured"
    echo "Run ./scripts/configure-auth0.sh to set up Auth0"
elif echo "$RESPONSE" | grep -q "REGISTRATION_FAILED"; then
    echo "❌ Registration failed with error"
else
    echo "❌ Unexpected response"
fi

echo ""
echo "🧪 Testing complete!"