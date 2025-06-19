#!/bin/bash

# Configure Auth0 for Engage Admin Portal - Development Environment
# This script sets up Auth0 secrets and configuration for local testing

echo "🔐 Setting up Auth0 configuration for Engage Admin Portal..."

# Development Auth0 Configuration
# Replace these with actual values from your Auth0 application
AUTH0_DOMAIN="lexara-dev.us.auth0.com"
AUTH0_CLIENT_ID="dev_WQxQQKbDxw8qMFkL8qJCkPGEelCKtMEL"  # Example client ID format
AUTH0_CLIENT_SECRET="dev_kJlktJN9VJfW9mZ-BNQ2Qh8K7Vw0_T9-FjA4Gx5c"  # Example secret format
AUTH0_AUDIENCE="https://api.dev.lexara.app"

echo "📋 Configuration Summary:"
echo "Domain: $AUTH0_DOMAIN"
echo "Client ID: $AUTH0_CLIENT_ID"
echo "Audience: $AUTH0_AUDIENCE"
echo "Redirect URI: https://admin-dev.lexara.app/auth/callback"

# Set Cloudflare Worker secrets
echo "🚀 Setting Cloudflare Worker secrets..."

echo "Setting AUTH0_CLIENT_ID..."
echo $AUTH0_CLIENT_ID | npx wrangler secret put AUTH0_CLIENT_ID --env dev --config wrangler-admin.toml

echo "Setting AUTH0_CLIENT_SECRET..."
echo $AUTH0_CLIENT_SECRET | npx wrangler secret put AUTH0_CLIENT_SECRET --env dev --config wrangler-admin.toml

echo "Setting AUTH0_DOMAIN (as secret for consistency)..."
echo $AUTH0_DOMAIN | npx wrangler secret put AUTH0_DOMAIN --env dev --config wrangler-admin.toml

echo "Setting AUTH0_AUDIENCE..."
echo $AUTH0_AUDIENCE | npx wrangler secret put AUTH0_AUDIENCE --env dev --config wrangler-admin.toml

echo "✅ Auth0 secrets configured successfully!"
echo ""
echo "🔧 Next Steps:"
echo "1. Create Auth0 application at https://manage.auth0.com"
echo "2. Configure callback URLs:"
echo "   - https://admin-dev.lexara.app/auth/callback"
echo "   - https://admin-dev.lexara.app/admin/auth/callback"
echo "3. Set allowed logout URLs:"
echo "   - https://admin-dev.lexara.app/auth/logout"
echo "   - https://admin-dev.lexara.app/admin"
echo "4. Configure allowed web origins:"
echo "   - https://admin-dev.lexara.app"
echo "5. Deploy admin worker: npx wrangler deploy --env dev --config wrangler-admin.toml"
echo "6. Test authentication flow"
echo ""
echo "📖 For detailed setup instructions, see:"
echo "   scripts/setup-auth0.md"