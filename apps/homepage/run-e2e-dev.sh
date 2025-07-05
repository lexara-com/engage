#!/bin/bash

# Run E2E tests against dev environment
echo "Running E2E tests against https://dev.console.lexara.app"

# Export the base URL
export PLAYWRIGHT_BASE_URL=https://dev.console.lexara.app

# Run tests
./node_modules/.bin/playwright test "$@"