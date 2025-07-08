#!/bin/bash

# Script to run chatbot E2E test and show conversation in dashboard
echo "🤖 Lexara Chatbot E2E Test Runner"
echo "=================================="
echo ""
echo "This will:"
echo "1. Create a test conversation through the chatbot"
echo "2. Show the conversation in the firm dashboard"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Install dependencies if needed
echo -e "${BLUE}📦 Installing dependencies...${NC}"
cd /Users/shawnswaner/code/lexara/cf_version
pnpm install

# Install Playwright browsers if needed
echo -e "${BLUE}🌐 Checking Playwright browsers...${NC}"
cd apps/chat-interface
npx playwright install chromium

# Create test results directory
mkdir -p test-results

# Run the specific test that creates a conversation
echo -e "${YELLOW}🚀 Running chatbot test...${NC}"
echo "Using firm ID: firm_test_123"
echo ""

# Run just the car accident test to create one conversation
npx playwright test chatbot-flow.spec.ts -g "Car accident victim" --headed --project=chromium

# Show results
echo ""
echo -e "${GREEN}✅ Test completed!${NC}"
echo ""
echo "To see the conversation in the dashboard:"
echo "1. Go to: https://dev.console.lexara.app/firm/login"
echo "2. Log in with your test credentials"
echo "3. Navigate to Conversations"
echo "4. Look for the new conversation from 'Sarah Thompson'"
echo ""
echo "Screenshot saved in: test-results/"