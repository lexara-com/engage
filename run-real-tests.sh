#!/bin/bash

echo "=== Running Real Integration Tests ==="
echo ""
echo "This will:"
echo "1. Build the application"
echo "2. Start a real Cloudflare Worker"
echo "3. Make actual HTTP requests"
echo "4. Test against the real D1 database"
echo ""

# Kill any existing processes on port 8788
echo "Cleaning up any existing processes..."
lsof -ti:8788 | xargs kill -9 2>/dev/null || true

# Ensure local D1 database is set up
echo "Setting up local D1 database..."
npx wrangler d1 execute dev-lexara-firm-portal --file=./schema.sql --local --env dev

# Run the real tests
echo ""
echo "Running real integration tests..."
npm run test tests/e2e/real-d1-test.ts

echo ""
echo "=== Real Tests Complete ==="