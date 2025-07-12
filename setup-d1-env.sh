#!/bin/bash

# Environment-aware D1 Database Setup Script

echo "=== Environment-Specific D1 Database Setup ==="
echo ""

# Check if environment is provided
if [ -z "$1" ]; then
    echo "Usage: ./setup-d1-env.sh [dev|staging|production]"
    echo ""
    echo "Examples:"
    echo "  ./setup-d1-env.sh dev        # Set up development database"
    echo "  ./setup-d1-env.sh staging    # Set up staging database"
    echo "  ./setup-d1-env.sh production # Set up production database"
    exit 1
fi

ENV=$1
DB_NAME=""

# Set database name based on environment
case $ENV in
    dev)
        DB_NAME="dev-lexara-firm-portal"
        ENV_FLAG="--env dev"
        ;;
    staging)
        DB_NAME="staging-lexara-firm-portal"
        ENV_FLAG="--env staging"
        ;;
    production)
        DB_NAME="prod-lexara-firm-portal"
        ENV_FLAG="--env production"
        echo "⚠️  WARNING: You are about to create a PRODUCTION database!"
        echo "Press Ctrl+C to cancel, or Enter to continue..."
        read
        ;;
    *)
        echo "Error: Invalid environment. Use 'dev', 'staging', or 'production'"
        exit 1
        ;;
esac

echo "Setting up D1 database for environment: $ENV"
echo "Database name: $DB_NAME"
echo ""

# Step 1: Create the database
echo "Step 1: Creating D1 database '$DB_NAME'..."
echo "Running: npx wrangler d1 create $DB_NAME"
echo ""
npx wrangler d1 create $DB_NAME

echo ""
echo "Step 2: Update wrangler.toml with the database ID"
echo "Copy the database_id from above and update the corresponding section in wrangler.toml:"
echo ""
echo "[[env.$ENV.d1_databases]]"
echo "binding = \"DB\""
echo "database_name = \"$DB_NAME\""
echo "database_id = \"YOUR_DATABASE_ID_HERE\"  <-- Replace this"
echo ""
echo "Press Enter when you've updated wrangler.toml..."
read

# Step 3: Execute the schema
echo ""
echo "Step 3: Deploying database schema..."
echo "Running: npx wrangler d1 execute $DB_NAME --file=./schema.sql --remote"
echo ""
npx wrangler d1 execute $DB_NAME --file=./schema.sql --remote

echo ""
echo "Step 4: Verify the setup"
echo "Running: npx wrangler d1 execute $DB_NAME --command=\"SELECT name FROM sqlite_master WHERE type='table';\" --remote"
echo ""
npx wrangler d1 execute $DB_NAME --command="SELECT name FROM sqlite_master WHERE type='table';" --remote

echo ""
echo "=== Setup Complete for $ENV environment! ==="
echo ""
echo "Your D1 database '$DB_NAME' is now set up with:"
echo "- firms table (law firm information)"
echo "- firm_users table (user accounts)"
echo "- user_invitations table (invitation tracking)"
echo ""
echo "Next steps:"
echo "1. Deploy to $ENV: npm run deploy:$ENV"
echo "2. Test the invitation system on $ENV"
echo "3. Monitor with: npx wrangler d1 execute $DB_NAME --command=\"SELECT * FROM user_invitations;\" --remote"