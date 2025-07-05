#!/bin/bash

# Setup D1 Database for Lexara Homepage
echo "🚀 Setting up D1 Database for Lexara Homepage..."

# Create the D1 database
echo "Creating D1 database..."
DB_CREATE_OUTPUT=$(wrangler d1 create lexara-auth 2>&1)

if echo "$DB_CREATE_OUTPUT" | grep -q "Successfully created"; then
    echo "✅ Database created successfully!"
    
    # Extract the database ID from the output
    DB_ID=$(echo "$DB_CREATE_OUTPUT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)
    
    echo "📝 Database ID: $DB_ID"
    echo ""
    echo "⚠️  IMPORTANT: Update wrangler.toml with this database ID:"
    echo "   Replace 'YOUR_DATABASE_ID_HERE' with '$DB_ID'"
    echo ""
    
    # Run migrations
    echo "Running database migrations..."
    wrangler d1 execute lexara-auth --file=./src/db/migrations/001_initial_schema.sql
    
    if [ $? -eq 0 ]; then
        echo "✅ Migrations completed successfully!"
    else
        echo "❌ Migration failed. Please check the error above."
        exit 1
    fi
    
    # Verify tables were created
    echo ""
    echo "Verifying database tables..."
    wrangler d1 execute lexara-auth --command="SELECT name FROM sqlite_master WHERE type='table';"
    
else
    if echo "$DB_CREATE_OUTPUT" | grep -q "already exists"; then
        echo "ℹ️  Database already exists. Running migrations..."
        
        # Run migrations anyway
        wrangler d1 execute lexara-auth --file=./src/db/migrations/001_initial_schema.sql
        
        if [ $? -eq 0 ]; then
            echo "✅ Migrations completed successfully!"
        else
            echo "❌ Migration failed. Please check the error above."
            exit 1
        fi
        
        # List existing database
        echo ""
        echo "Getting database info..."
        wrangler d1 list | grep lexara-auth
    else
        echo "❌ Failed to create database. Error:"
        echo "$DB_CREATE_OUTPUT"
        exit 1
    fi
fi

echo ""
echo "✅ D1 Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Update wrangler.toml with the database ID if not already done"
echo "2. Configure Auth0 environment variables"
echo "3. Deploy the worker with: wrangler deploy"