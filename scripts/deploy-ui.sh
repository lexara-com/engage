#!/bin/bash

# Deploy Engage UI to Cloudflare Pages
set -e

echo "🚀 Deploying Engage UI to Cloudflare Pages..."

# Check if logged in
if ! npx wrangler whoami >/dev/null 2>&1; then
    echo "❌ Not logged in to Cloudflare. Please run: wrangler login"
    exit 1
fi

# Build the UI
echo "📦 Building UI..."
npm run build:ui

# Deploy based on environment
if [ "$1" = "production" ]; then
    echo "🌍 Deploying to production..."
    npx wrangler pages deploy dist --project-name=engage-ui-production --compatibility-date=2024-01-01
elif [ "$1" = "staging" ]; then
    echo "🧪 Deploying to staging..."
    npx wrangler pages deploy dist --project-name=engage-ui-staging --compatibility-date=2024-01-01
else
    echo "🔧 Deploying to development..."
    npx wrangler pages deploy dist --project-name=engage-ui --compatibility-date=2024-01-01
fi

echo "✅ Deployment complete!"