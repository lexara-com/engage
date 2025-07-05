#!/bin/bash

echo "🧪 Running Conversation Feature Tests"
echo "===================================="

# Set environment for dev testing
export PLAYWRIGHT_BASE_URL=https://dev.console.lexara.app

# Run conversation tests
echo ""
echo "📋 Running functional tests..."
npx playwright test conversations.spec.ts --reporter=list

echo ""
echo "📸 Running visual regression tests..."
npx playwright test conversation-visual.spec.ts --reporter=list

echo ""
echo "♿ Running accessibility tests..."
npx playwright test conversation-a11y.spec.ts --reporter=list

echo ""
echo "⚡ Running performance tests..."
npx playwright test conversation-performance.spec.ts --reporter=list

echo ""
echo "📊 Test Summary"
echo "==============="
npx playwright test conversations.spec.ts conversation-visual.spec.ts conversation-a11y.spec.ts conversation-performance.spec.ts --reporter=html

echo ""
echo "✅ Conversation tests completed!"
echo "View detailed report: npx playwright show-report"