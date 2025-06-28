#!/bin/bash

# Validate Wrangler configurations for common issues
# Usage: ./scripts/validate-config.sh

set -e

echo "🔍 Validating Wrangler Configurations"
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

log_error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    ((ERRORS++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    ((WARNINGS++))
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    log_error "Wrangler CLI is not installed. Run: npm install -g wrangler"
    exit 1
fi

# Check authentication
if ! wrangler whoami &> /dev/null; then
    log_error "Not authenticated with Cloudflare. Run: wrangler login"
    exit 1
fi

log_success "Wrangler CLI is installed and authenticated"

# Validate each configuration file
validate_config() {
    local config_file="$1"
    local description="$2"
    
    if [ ! -f "$config_file" ]; then
        log_error "Configuration file not found: $config_file"
        return
    fi
    
    echo -e "\n${BLUE}📋 Validating $description ($config_file)${NC}"
    
    # Check for basic syntax
    if ! grep -q "^name = " "$config_file"; then
        log_error "$config_file: Missing 'name' field"
    fi
    
    if ! grep -q "^main = " "$config_file"; then
        log_error "$config_file: Missing 'main' field"
    fi
    
    # Check main file exists
    main_file=$(grep "^main = " "$config_file" | cut -d'"' -f2)
    if [ -n "$main_file" ] && [ ! -f "$main_file" ]; then
        log_error "$config_file: Main file does not exist: $main_file"
    fi
    
    # Check for environment configurations
    if grep -q "\[env\." "$config_file"; then
        log_success "$config_file: Has environment configurations"
    else
        log_warning "$config_file: No environment configurations found"
    fi
    
    # Check for Auth0 variables in platform config
    if [[ "$config_file" == *"platform"* ]]; then
        if ! grep -q "AUTH0_DOMAIN" "$config_file"; then
            log_error "$config_file: Missing AUTH0_DOMAIN configuration"
        fi
        if ! grep -q "AUTH0_CLIENT_ID" "$config_file"; then
            log_error "$config_file: Missing AUTH0_CLIENT_ID configuration"
        fi
    fi
}

# Validate all configuration files
validate_config "wrangler.toml" "Main Agent Worker"
validate_config "wrangler-platform.toml" "Platform Admin Worker"
validate_config "wrangler-admin.toml" "Admin API Worker"
validate_config "wrangler-goal-tracker.toml" "Goal Tracker MCP"
validate_config "wrangler-conflict-checker.toml" "Conflict Checker MCP"
validate_config "wrangler-additional-goals.toml" "Additional Goals MCP"
validate_config "wrangler-pages.toml" "Pages Deployment"

# Check for duplicate names
echo -e "\n${BLUE}🔄 Checking for duplicate worker names${NC}"
if [ $(grep "^name = " wrangler*.toml | sort | uniq -d | wc -l) -gt 0 ]; then
    log_error "Duplicate worker names found:"
    grep "^name = " wrangler*.toml | sort | uniq -d
else
    log_success "No duplicate worker names found"
fi

# Check package.json scripts
echo -e "\n${BLUE}📦 Checking package.json deployment scripts${NC}"
if [ -f "package.json" ]; then
    if grep -q "deploy:dev" package.json; then
        log_success "package.json has deploy:dev script"
    else
        log_warning "package.json missing deploy:dev script"
    fi
    
    if grep -q "deploy:platform:dev" package.json; then
        log_success "package.json has deploy:platform:dev script"
    else
        log_warning "package.json missing deploy:platform:dev script"
    fi
else
    log_error "package.json not found"
fi

# Summary
echo ""
echo "================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    log_success "Configuration validation passed! ✨"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}Configuration validation completed with $WARNINGS warnings${NC}"
else
    echo -e "${RED}Configuration validation failed with $ERRORS errors and $WARNINGS warnings${NC}"
    echo "Please fix the errors before deploying."
    exit 1
fi