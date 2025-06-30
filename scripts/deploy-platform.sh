#!/bin/bash
# Deploy platform admin worker

echo "Deploying platform admin worker to development environment..."
wrangler deploy --config wrangler-platform.toml --env dev