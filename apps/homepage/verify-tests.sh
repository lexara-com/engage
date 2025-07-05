#!/bin/bash

echo "🧪 Verifying Lexara Engage Test Setup"
echo "===================================="
echo ""

# Check current directory
echo "📍 Current directory: $(pwd)"
echo ""

# Check if pnpm is available
if command -v pnpm &> /dev/null; then
    echo "✅ pnpm is installed"
else
    echo "❌ pnpm not found"
fi

# Check if vitest is available
if [ -f "node_modules/.bin/vitest" ]; then
    echo "✅ vitest is installed locally"
else
    echo "❌ vitest not found in node_modules"
fi

echo ""
echo "📁 Test files found:"
find tests -name "*.test.ts" -type f | while read file; do
    echo "  ✅ $file"
done

echo ""
echo "🔧 Attempting to run tests..."
echo ""

# Try running tests directly with vitest
if [ -f "node_modules/.bin/vitest" ]; then
    ./node_modules/.bin/vitest run --reporter=verbose
else
    echo "Installing vitest locally..."
    npm install --save-dev vitest @vitest/ui @vitest/coverage-v8
    echo "Retrying tests..."
    npx vitest run --reporter=verbose
fi