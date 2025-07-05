#!/bin/bash

# Configure Auth0 Environment Variables for Lexara Homepage
echo "🔐 Configuring Auth0 Environment Variables..."

# Check if Auth0 values are already set
if [ -z "$AUTH0_DOMAIN" ] || [ -z "$AUTH0_CLIENT_ID" ] || [ -z "$AUTH0_CLIENT_SECRET" ]; then
    echo "⚠️  Auth0 environment variables not found."
    echo ""
    echo "Please provide the following Auth0 configuration:"
    echo "(You can find these in your Auth0 dashboard)"
    echo ""
    
    read -p "Auth0 Domain (e.g., dev-xyz.us.auth0.com): " AUTH0_DOMAIN
    read -p "Auth0 Client ID: " AUTH0_CLIENT_ID
    read -s -p "Auth0 Client Secret: " AUTH0_CLIENT_SECRET
    echo ""
else
    echo "✅ Using existing Auth0 configuration"
fi

# Set secrets for development environment
echo ""
echo "Setting Auth0 secrets for development environment..."

wrangler secret put AUTH0_DOMAIN --env dev <<< "$AUTH0_DOMAIN"
wrangler secret put AUTH0_CLIENT_ID --env dev <<< "$AUTH0_CLIENT_ID"
wrangler secret put AUTH0_CLIENT_SECRET --env dev <<< "$AUTH0_CLIENT_SECRET"

echo ""
echo "✅ Auth0 configuration complete!"
echo ""
echo "Summary:"
echo "- Domain: $AUTH0_DOMAIN"
echo "- Client ID: $AUTH0_CLIENT_ID"
echo "- Client Secret: [HIDDEN]"
echo ""
echo "⚠️  Important Auth0 Setup Requirements:"
echo "1. Ensure 'Username-Password-Authentication' connection is enabled"
echo "2. Add callback URLs:"
echo "   - https://dev-www.lexara.app/firm/callback"
echo "   - http://localhost:3000/firm/callback (for local dev)"
echo "3. Add allowed web origins:"
echo "   - https://dev-www.lexara.app"
echo "   - http://localhost:3000"
echo "4. Enable 'Password' grant type for machine-to-machine authentication"