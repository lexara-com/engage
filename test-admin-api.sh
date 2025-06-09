#!/bin/bash

# Test script for Admin API endpoints
# Tests firm registration, user management, and configuration

set -e

# Configuration
ADMIN_API_URL="http://localhost:8787"  # Default wrangler dev URL
CONTENT_TYPE="Content-Type: application/json"

# Test authentication headers (simulated)
AUTH_HEADERS=(
  -H "Authorization: Bearer fake_jwt_token_for_testing"
  -H "X-Auth0-User-ID: auth0|test_admin_user"
  -H "X-User-Email: admin@testfirm.com"  
  -H "X-User-Role: admin"
  -H "X-Firm-ID: test_firm_id"
)

echo "🧪 Testing Admin API Implementation"
echo "=================================="

# Test 1: Health Check
echo ""
echo "📋 Test 1: Health Check"
echo "----------------------"
curl -s -X GET "${ADMIN_API_URL}/health" | jq .

# Test 2: Register New Firm
echo ""
echo "📋 Test 2: Register New Firm"
echo "----------------------------"
FIRM_DATA='{
  "name": "Smith & Associates Law Firm",
  "contactEmail": "admin@smithlaw.com",
  "contactPhone": "+1-555-123-4567",
  "website": "https://smithlaw.com",
  "slug": "smith-associates",
  "practiceAreas": ["personal_injury", "employment_law"],
  "subscriptionTier": "professional",
  "address": {
    "street": "123 Main Street, Suite 400",
    "city": "Austin", 
    "state": "TX",
    "postalCode": "78701",
    "country": "US"
  },
  "adminUser": {
    "auth0UserId": "auth0|admin_user_123",
    "email": "john@smithlaw.com",
    "name": "John Smith"
  }
}'

FIRM_RESPONSE=$(curl -s -X POST "${ADMIN_API_URL}/api/admin/firms" \
  "${AUTH_HEADERS[@]}" \
  -H "${CONTENT_TYPE}" \
  -d "${FIRM_DATA}")

echo "${FIRM_RESPONSE}" | jq .

# Extract firm ID for subsequent tests
FIRM_ID=$(echo "${FIRM_RESPONSE}" | jq -r '.firmId // empty')
if [ -z "${FIRM_ID}" ]; then
  echo "❌ Failed to register firm, skipping further tests"
  exit 1
fi

echo "✅ Firm registered with ID: ${FIRM_ID}"

# Update auth headers with actual firm ID
AUTH_HEADERS=(
  -H "Authorization: Bearer fake_jwt_token_for_testing"
  -H "X-Auth0-User-ID: auth0|test_admin_user"
  -H "X-User-Email: admin@testfirm.com"  
  -H "X-User-Role: admin"
  -H "X-Firm-ID: ${FIRM_ID}"
)

# Test 3: Get Firm Details
echo ""
echo "📋 Test 3: Get Firm Details"
echo "--------------------------"
curl -s -X GET "${ADMIN_API_URL}/api/admin/firms/${FIRM_ID}" \
  "${AUTH_HEADERS[@]}" | jq .

# Test 4: Update Firm Information
echo ""
echo "📋 Test 4: Update Firm Information"
echo "---------------------------------"
UPDATE_DATA='{
  "contactPhone": "+1-555-123-9999",
  "website": "https://smithlaw.net",
  "practiceAreas": ["personal_injury", "employment_law", "business_law"]
}'

curl -s -X PUT "${ADMIN_API_URL}/api/admin/firms/${FIRM_ID}" \
  "${AUTH_HEADERS[@]}" \
  -H "${CONTENT_TYPE}" \
  -d "${UPDATE_DATA}" | jq .

# Test 5: List Firm Users
echo ""
echo "📋 Test 5: List Firm Users"
echo "-------------------------"
curl -s -X GET "${ADMIN_API_URL}/api/admin/firms/${FIRM_ID}/users" \
  "${AUTH_HEADERS[@]}" | jq .

# Test 6: Add New User to Firm
echo ""
echo "📋 Test 6: Add New User to Firm"
echo "-------------------------------"
USER_DATA='{
  "email": "lawyer@smithlaw.com",
  "role": "lawyer",
  "name": "Jane Lawyer",
  "auth0UserId": "auth0|lawyer_user_456"
}'

curl -s -X POST "${ADMIN_API_URL}/api/admin/firms/${FIRM_ID}/users" \
  "${AUTH_HEADERS[@]}" \
  -H "${CONTENT_TYPE}" \
  -d "${USER_DATA}" | jq .

# Test 7: Test Permission Validation (should fail)
echo ""
echo "📋 Test 7: Test Permission Validation"
echo "------------------------------------"
echo "Testing with staff role (should fail for billing operations)..."

# Create headers with staff role
STAFF_HEADERS=(
  -H "Authorization: Bearer fake_jwt_token_for_testing"
  -H "X-Auth0-User-ID: auth0|staff_user"
  -H "X-User-Email: staff@testfirm.com"  
  -H "X-User-Role: staff"
  -H "X-Firm-ID: ${FIRM_ID}"
)

BILLING_UPDATE='{
  "subscription": {
    "tier": "enterprise"
  }
}'

curl -s -X PUT "${ADMIN_API_URL}/api/admin/firms/${FIRM_ID}" \
  "${STAFF_HEADERS[@]}" \
  -H "${CONTENT_TYPE}" \
  -d "${BILLING_UPDATE}" | jq .

# Test 8: Test Invalid Data Handling
echo ""
echo "📋 Test 8: Test Invalid Data Handling"
echo "------------------------------------"
INVALID_FIRM='{
  "name": "",
  "contactEmail": "invalid-email",
  "slug": "a"
}'

curl -s -X POST "${ADMIN_API_URL}/api/admin/firms" \
  "${AUTH_HEADERS[@]}" \
  -H "${CONTENT_TYPE}" \
  -d "${INVALID_FIRM}" | jq .

# Test 9: Test Duplicate Prevention
echo ""
echo "📋 Test 9: Test Duplicate Prevention"
echo "-----------------------------------"
echo "Attempting to register firm with same email..."

DUPLICATE_FIRM='{
  "name": "Another Law Firm",
  "contactEmail": "admin@smithlaw.com",
  "adminUser": {
    "auth0UserId": "auth0|another_admin",
    "email": "another@firm.com",
    "name": "Another Admin"
  }
}'

curl -s -X POST "${ADMIN_API_URL}/api/admin/firms" \
  "${AUTH_HEADERS[@]}" \
  -H "${CONTENT_TYPE}" \
  -d "${DUPLICATE_FIRM}" | jq .

# Test 10: Test Unauthenticated Request
echo ""
echo "📋 Test 10: Test Unauthenticated Request"
echo "---------------------------------------"
curl -s -X GET "${ADMIN_API_URL}/api/admin/firms/${FIRM_ID}" | jq .

echo ""
echo "🎉 Admin API tests completed!"
echo ""
echo "Summary:"
echo "- Health check endpoint"
echo "- Firm registration with validation"
echo "- Firm details retrieval"
echo "- Firm information updates"
echo "- User management"
echo "- Permission validation"
echo "- Error handling"
echo "- Duplicate prevention"
echo "- Authentication requirements"
echo ""
echo "Next steps:"
echo "1. Deploy admin worker: npm run deploy:admin"
echo "2. Set up Auth0 integration"
echo "3. Build admin dashboard UI"
echo "4. Implement remaining endpoints"