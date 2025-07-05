#!/bin/bash

# Simple test runner for local development
echo "🧪 Running Lexara Engage Tests"
echo "=============================="

# Set working directory to homepage app
cd "$(dirname "$0")"

# Check if vitest is available
if ! command -v vitest &> /dev/null; then
    echo "❌ Vitest not found. Installing globally..."
    npm install -g vitest
fi

# Run tests
echo ""
echo "Running unit tests..."
vitest run tests/unit --reporter=verbose

echo ""
echo "Running integration tests..."
vitest run tests/integration --reporter=verbose

echo ""
echo "=============================="
echo "✅ Test run complete"