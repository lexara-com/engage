#!/bin/bash

# Deploy all Engage services to production environment
# Usage: ./scripts/deploy-all-production.sh

set -e

echo "🚀 Deploying Engage Legal AI to Production Environment"
echo "====================================================="
echo "⚠️  WARNING: This will deploy to PRODUCTION domains!"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Production deployment confirmation
echo -e "${YELLOW}Are you sure you want to deploy to production? (yes/no)${NC}"
read -r confirmation
if [ "$confirmation" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

deploy_service() {
    local service_name="$1"
    local command="$2"
    
    echo -e "\n${BLUE}📦 Deploying $service_name to PRODUCTION...${NC}"
    if eval "$command"; then
        echo -e "${GREEN}✅ $service_name deployed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to deploy $service_name${NC}"
        exit 1
    fi
}

# Deploy core services to production
deploy_service "Main Agent Worker" "npm run deploy:production"
deploy_service "Platform Admin Worker" "npm run deploy:platform:production"

# Deploy MCP services to production
deploy_service "Goal Tracker MCP" "npx wrangler deploy --config wrangler-goal-tracker.toml --env production"
deploy_service "Conflict Checker MCP" "npx wrangler deploy --config wrangler-conflict-checker.toml --env production"
deploy_service "Additional Goals MCP" "npx wrangler deploy --config wrangler-additional-goals.toml --env production"

# Optional: Deploy admin API if configured
if [ -f "wrangler-admin.toml" ]; then
    deploy_service "Admin API Worker" "npm run deploy:admin:production"
fi

echo -e "\n${GREEN}🎉 All services deployed to PRODUCTION environment!${NC}"
echo ""
echo "Production URLs:"
echo "• Main Chat: https://lexara.app"
echo "• Platform Admin: https://platform.lexara.app"
echo "• Admin API: https://admin.lexara.app"
echo ""
echo "Verify deployment:"
echo "curl https://lexara.app/health"
echo "curl https://platform.lexara.app/health"