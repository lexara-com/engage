#!/bin/bash

# Test Security Fixes Script
# This script runs all the critical tests to prove multi-tenant security is working

echo "🔐 Testing Multi-Tenant Security Fixes"
echo "====================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Run the multi-tenant isolation tests
echo "1️⃣  Running Multi-Tenant Isolation Tests..."
echo "These tests verify that users cannot access data from other firms"
echo ""
npx vitest run tests/unit/db/multi_tenant_isolation.test.ts --reporter=verbose

# Run the updated database tests
echo ""
echo "2️⃣  Running Database User Operations Tests..."
echo "These tests verify all user methods require firmId"
echo ""
npx vitest run tests/unit/db/db_user.test.ts --reporter=verbose

# Run the secure API endpoint tests
echo ""
echo "3️⃣  Running Secure API Endpoint Tests..."
echo "These tests verify the new secure endpoints enforce firm isolation"
echo ""
npx vitest run tests/integration/api/secure_endpoints.test.ts --reporter=verbose

# Run all tests and generate coverage
echo ""
echo "4️⃣  Running Full Test Suite with Coverage..."
echo ""
npx vitest run --coverage

# Summary
echo ""
echo "====================================="
echo "🎯 Key Security Tests to Verify:"
echo ""
echo "✅ Users can only access their own firm's data"
echo "✅ getUser() requires firmId parameter"
echo "✅ updateUser() validates firm ownership"
echo "✅ deleteUser() is scoped to firm"
echo "✅ API endpoints automatically use authenticated user's firm"
echo "✅ Cross-firm access attempts return null/404"
echo "✅ Audit logging captures all modifications"
echo ""
echo "If all tests pass, the multi-tenant security is properly implemented!"