#!/bin/bash

echo "=== D1 Local Database Setup Script ==="
echo ""
echo "This script sets up the D1 database for local development."
echo "Using the dev environment configuration."
echo ""

# Execute the schema locally for dev environment
echo "Creating local database schema for dev environment..."
echo "Running: npx wrangler d1 execute dev-lexara-firm-portal --file=./schema.sql --local --env dev"
echo ""
npx wrangler d1 execute dev-lexara-firm-portal --file=./schema.sql --local --env dev

echo ""
echo "Verifying local database setup..."
echo "Running: npx wrangler d1 execute dev-lexara-firm-portal --command=\"SELECT name FROM sqlite_master WHERE type='table';\" --local --env dev"
echo ""
npx wrangler d1 execute dev-lexara-firm-portal --command="SELECT name FROM sqlite_master WHERE type='table';" --local --env dev

echo ""
echo "Checking test firm..."
echo "Running: npx wrangler d1 execute dev-lexara-firm-portal --command=\"SELECT * FROM firms;\" --local --env dev"
echo ""
npx wrangler d1 execute dev-lexara-firm-portal --command="SELECT * FROM firms;" --local --env dev

echo ""
echo "=== Local Setup Complete! ==="
echo ""
echo "Your local D1 database is ready with:"
echo "- firms table"
echo "- firm_users table"
echo "- user_invitations table"
echo "- Test firm (ID: firm_test_001)"
echo ""
echo "The local database is stored in .wrangler/state/v3/d1/"
echo ""
echo "To start development:"
echo "1. Run: npm run dev"
echo "2. Login and test the invitation system"
echo "3. View invitations: npx wrangler d1 execute dev-lexara-firm-portal --command=\"SELECT * FROM user_invitations;\" --local --env dev"