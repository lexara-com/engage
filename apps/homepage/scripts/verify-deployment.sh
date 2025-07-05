#!/bin/bash

# Verify Firm Registration Deployment
echo "🔍 Verifying Firm Registration Deployment"
echo "========================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Checklist
echo ""
echo "Checking deployment readiness..."
echo ""

# 1. Check D1 Database
echo -n "1. D1 Database configured... "
if grep -q 'database_id = "39dd504c-9bf8-44ff-86b0-d5c2c2b860a9"' wrangler.toml; then
    echo -e "${GREEN}✅ CONFIGURED${NC}"
else
    echo -e "${RED}❌ NOT CONFIGURED${NC}"
    echo "   Run: ./scripts/setup-d1-database.sh"
fi

# 2. Check Durable Objects
echo -n "2. Durable Objects configured... "
if grep -q 'name = "FIRM_REGISTRY"' wrangler.toml; then
    echo -e "${GREEN}✅ CONFIGURED${NC}"
else
    echo -e "${RED}❌ NOT CONFIGURED${NC}"
    echo "   Add Durable Objects binding to wrangler.toml"
fi

# 3. Check if worker is deployed
echo -n "3. Worker deployed to dev... "
if wrangler deployments list | grep -q "dev"; then
    echo -e "${GREEN}✅ DEPLOYED${NC}"
else
    echo -e "${YELLOW}⚠️  NOT DEPLOYED${NC}"
    echo "   Run: wrangler deploy --env dev"
fi

# 4. Check Auth0 secrets
echo -n "4. Auth0 secrets configured... "
if wrangler secret list --env dev 2>/dev/null | grep -q "AUTH0_DOMAIN"; then
    echo -e "${GREEN}✅ CONFIGURED${NC}"
else
    echo -e "${YELLOW}⚠️  NOT VERIFIED${NC}"
    echo "   Run: ./scripts/configure-auth0.sh"
fi

# 5. Test database tables
echo -n "5. Database tables created... "
DB_CHECK=$(wrangler d1 execute lexara-auth --command="SELECT name FROM sqlite_master WHERE type='table';" 2>&1)
if echo "$DB_CHECK" | grep -q "firms"; then
    echo -e "${GREEN}✅ TABLES EXIST${NC}"
else
    echo -e "${RED}❌ TABLES MISSING${NC}"
    echo "   Run: ./scripts/setup-d1-database.sh"
fi

# 6. Test registration endpoint
echo -n "6. Registration endpoint accessible... "
ENDPOINT_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://dev-www.lexara.app/api/v1/firm/register \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null)
    
if [ "$ENDPOINT_CHECK" = "400" ] || [ "$ENDPOINT_CHECK" = "500" ]; then
    echo -e "${GREEN}✅ ACCESSIBLE${NC}"
else
    echo -e "${RED}❌ NOT ACCESSIBLE (HTTP $ENDPOINT_CHECK)${NC}"
    echo "   Check deployment and DNS"
fi

echo ""
echo "========================================"
echo ""

# Run basic tests
echo "Running basic validation tests..."
./scripts/test-registration-complete.sh

echo ""
echo "📊 Deployment Verification Complete!"
echo ""
echo "Next steps:"
echo "1. Configure Auth0 if not done: ./scripts/configure-auth0.sh"
echo "2. Deploy if needed: wrangler deploy --env dev"
echo "3. Test registration: Visit https://dev-www.lexara.app/firm/signup"