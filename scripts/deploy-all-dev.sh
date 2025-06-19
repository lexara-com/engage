#!/bin/bash

# Deploy all Engage services to development environment
# Usage: ./scripts/deploy-all-dev.sh

set -e

echo "🚀 Deploying Engage Legal AI to Development Environment"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

deploy_service() {
    local service_name="$1"
    local command="$2"
    
    echo -e "\n${BLUE}📦 Deploying $service_name...${NC}"
    if eval "$command"; then
        echo -e "${GREEN}✅ $service_name deployed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to deploy $service_name${NC}"
        exit 1
    fi
}

# Deploy core services
deploy_service "Main Agent Worker" "npm run deploy:dev"
deploy_service "Platform Admin Worker" "npm run deploy:platform:dev"

# Deploy MCP services
deploy_service "Goal Tracker MCP" "npx wrangler deploy --config wrangler-goal-tracker.toml --env dev"
deploy_service "Conflict Checker MCP" "npx wrangler deploy --config wrangler-conflict-checker.toml --env dev"
deploy_service "Additional Goals MCP" "npx wrangler deploy --config wrangler-additional-goals.toml --env dev"

# Optional: Deploy admin API if configured
if [ -f "wrangler-admin.toml" ]; then
    deploy_service "Admin API Worker" "npm run deploy:admin:dev"
fi

echo -e "\n${GREEN}🎉 All services deployed to development environment!${NC}"
echo ""
echo "Service URLs:"
echo "• Main Chat: https://dev.lexara.app"
echo "• Platform Admin: https://platform-dev.lexara.app"
echo "• Admin API: https://admin-dev.lexara.app"
echo ""
echo "Verify deployment:"
echo "curl https://dev.lexara.app/health"
echo "curl https://platform-dev.lexara.app/health"