#!/bin/bash

# Deploy Admin API to Cloudflare Workers

set -e

echo "🚀 Deploying Engage Admin API..."
echo "================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it first:${NC}"
    echo "npm install -g wrangler"
    exit 1
fi

# Function to check if logged in to Cloudflare
check_auth() {
    if ! wrangler whoami &> /dev/null; then
        echo -e "${YELLOW}⚠️  Not logged in to Cloudflare. Running 'wrangler login'...${NC}"
        wrangler login
    else
        echo -e "${GREEN}✓ Authenticated with Cloudflare${NC}"
    fi
}

# Function to create D1 database if it doesn't exist
setup_d1_database() {
    echo -e "\n${BLUE}Setting up D1 Database...${NC}"
    
    # Check if database exists
    if wrangler d1 list | grep -q "engage-db"; then
        echo -e "${GREEN}✓ D1 database 'engage-db' already exists${NC}"
    else
        echo -e "${YELLOW}Creating D1 database 'engage-db'...${NC}"
        wrangler d1 create engage-db
        echo -e "${GREEN}✓ D1 database created${NC}"
    fi
    
    # Run migrations
    echo -e "${YELLOW}Running database migrations...${NC}"
    wrangler d1 execute engage-db --file=./src/api/admin/database/schema.sql
    echo -e "${GREEN}✓ Database schema applied${NC}"
}

# Function to create queues
setup_queues() {
    echo -e "\n${BLUE}Setting up Queues...${NC}"
    
    # Check if queue exists
    if wrangler queues list | grep -q "conversation-sync"; then
        echo -e "${GREEN}✓ Queue 'conversation-sync' already exists${NC}"
    else
        echo -e "${YELLOW}Creating queue 'conversation-sync'...${NC}"
        wrangler queues create conversation-sync
        echo -e "${GREEN}✓ Queue created${NC}"
    fi
}

# Function to create R2 bucket
setup_r2_bucket() {
    echo -e "\n${BLUE}Setting up R2 Bucket...${NC}"
    
    # Check if bucket exists
    if wrangler r2 bucket list | grep -q "engage-documents"; then
        echo -e "${GREEN}✓ R2 bucket 'engage-documents' already exists${NC}"
    else
        echo -e "${YELLOW}Creating R2 bucket 'engage-documents'...${NC}"
        wrangler r2 bucket create engage-documents
        echo -e "${GREEN}✓ R2 bucket created${NC}"
    fi
}

# Function to set secrets
setup_secrets() {
    echo -e "\n${BLUE}Setting up Secrets...${NC}"
    
    # Check if AUTH0_DOMAIN is set
    if ! wrangler secret list -c wrangler.admin-api.toml | grep -q "AUTH0_DOMAIN"; then
        echo -e "${YELLOW}Setting AUTH0_DOMAIN secret...${NC}"
        echo -n "Enter your Auth0 domain (e.g., your-tenant.auth0.com): "
        read AUTH0_DOMAIN
        echo "$AUTH0_DOMAIN" | wrangler secret put AUTH0_DOMAIN -c wrangler.admin-api.toml
    else
        echo -e "${GREEN}✓ AUTH0_DOMAIN secret already set${NC}"
    fi
    
    # Check if AUTH0_AUDIENCE is set
    if ! wrangler secret list -c wrangler.admin-api.toml | grep -q "AUTH0_AUDIENCE"; then
        echo -e "${YELLOW}Setting AUTH0_AUDIENCE secret...${NC}"
        echo -n "Enter your Auth0 API audience (e.g., https://api.engage.lexara.com): "
        read AUTH0_AUDIENCE
        echo "$AUTH0_AUDIENCE" | wrangler secret put AUTH0_AUDIENCE -c wrangler.admin-api.toml
    else
        echo -e "${GREEN}✓ AUTH0_AUDIENCE secret already set${NC}"
    fi
}

# Function to update wrangler.toml with actual IDs
update_wrangler_config() {
    echo -e "\n${BLUE}Updating wrangler configuration...${NC}"
    
    # Get D1 database ID
    DB_ID=$(wrangler d1 list | grep "engage-db" | awk '{print $2}')
    if [ -n "$DB_ID" ]; then
        echo -e "${YELLOW}Updating D1 database ID in wrangler.admin-api.toml...${NC}"
        # Update the database_id in wrangler.toml
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/YOUR_D1_DATABASE_ID/$DB_ID/g" wrangler.admin-api.toml
        else
            # Linux
            sed -i "s/YOUR_D1_DATABASE_ID/$DB_ID/g" wrangler.admin-api.toml
        fi
        echo -e "${GREEN}✓ Updated D1 database ID: $DB_ID${NC}"
    else
        echo -e "${RED}❌ Could not find D1 database ID${NC}"
        exit 1
    fi
}

# Function to deploy the worker
deploy_worker() {
    echo -e "\n${BLUE}Deploying Admin API Worker...${NC}"
    
    # Deploy to production
    echo -e "${YELLOW}Deploying to production environment...${NC}"
    wrangler deploy -c wrangler.admin-api.toml --env production
    
    echo -e "${GREEN}✓ Admin API deployed successfully!${NC}"
}

# Function to run post-deployment tests
post_deployment_test() {
    echo -e "\n${BLUE}Running post-deployment tests...${NC}"
    
    # Get the deployed URL
    WORKER_URL=$(wrangler deployments list -c wrangler.admin-api.toml | grep "Current" | awk '{print $4}')
    
    if [ -z "$WORKER_URL" ]; then
        # Fallback to subdomain URL
        WORKER_URL="https://engage-admin-api.${CF_ACCOUNT_SUBDOMAIN}.workers.dev"
    fi
    
    echo -e "${YELLOW}Testing health endpoint at: $WORKER_URL/v1/admin/health${NC}"
    
    # Test health endpoint
    HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$WORKER_URL/v1/admin/health")
    STATUS_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
    
    if [ "$STATUS_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Health check passed!${NC}"
        echo "$HEALTH_RESPONSE" | sed '$d' | jq '.'
    else
        echo -e "${RED}❌ Health check failed (Status: $STATUS_CODE)${NC}"
    fi
}

# Main deployment flow
main() {
    echo -e "${BLUE}Starting Admin API deployment process...${NC}\n"
    
    # Step 1: Check authentication
    check_auth
    
    # Step 2: Set up D1 database
    setup_d1_database
    
    # Step 3: Set up queues
    setup_queues
    
    # Step 4: Set up R2 bucket
    setup_r2_bucket
    
    # Step 5: Update wrangler config
    update_wrangler_config
    
    # Step 6: Set up secrets
    setup_secrets
    
    # Step 7: Deploy the worker
    deploy_worker
    
    # Step 8: Run tests
    post_deployment_test
    
    echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "\nNext steps:"
    echo -e "1. Configure your Auth0 application with the API audience"
    echo -e "2. Update CORS origins in production environment variables"
    echo -e "3. Set up monitoring and alerts"
    echo -e "4. Test the API with your admin portal"
}

# Run main function
main