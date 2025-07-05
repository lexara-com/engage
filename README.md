# Engage Legal AI Platform

> AI-powered legal client intake platform built on Cloudflare's edge infrastructure

**Last Updated**: January 3, 2025  
**Status**: 🚧 In Development

## 🏗️ Monorepo Structure

This repository is organized as a monorepo with independent applications and shared packages:

### Applications (`apps/`)

- **`homepage/`** - Law firm portal with signup, dashboard, and management
  - ✅ Firm registration with Auth0 and D1 database
  - ✅ Multi-tenant architecture with firm isolation
  - 🚧 Testing framework (10/32 tests passing)
  - 📋 User management and conversation views
- **`api-worker/`** - RESTful API for firm data (discovered during development)
- **`chat-interface/`** - AI-powered client intake chat (`dev.lexara.app`)
- **`platform-admin/`** - Lexara platform administration (`platform-dev.lexara.app`)
- **`mcp-servers/`** - Microservices for AI agent functionality
  - `goal-tracker/` - Conversation goal management
  - `conflict-checker/` - Conflict of interest detection  
  - `additional-goals/` - Supporting document search

### Shared Packages (`packages/`)

- **`@lexara/shared-types`** - Common TypeScript interfaces and types
- **`@lexara/shared-utils`** - Logger, errors, ULID, validation utilities
- **`@lexara/auth-lib`** - JWT validation and Auth0 integration

### Documentation (`docs/`)

- **System Architecture**: Complete platform design and specifications
- **Deployment Guides**: Step-by-step deployment procedures
- **API References**: Detailed API documentation
- **Development Guides**: Setup and development workflows

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages and apps
pnpm build

# Start development servers for all apps
pnpm dev

# Start specific application
pnpm dev:chat        # Chat interface only
pnpm dev:platform    # Platform admin only
pnpm dev:mcp         # MCP servers only
```

## 📦 Package Management

This monorepo uses **pnpm workspaces** with **Turbo** for build orchestration:

```bash
# Install dependencies for all packages
pnpm install

# Build all packages (dependencies first)
pnpm build

# Run tests across all packages
pnpm test

# Run tests for specific app
pnpm test --filter=homepage

# Type check all packages
pnpm typecheck

# Lint all packages
pnpm lint
```

## 🛠️ Development Workflow

### Working on a Specific App

```bash
# Navigate to app directory
cd apps/chat-interface

# Install dependencies (if needed)
pnpm install

# Start development
pnpm dev

# Deploy to development
pnpm deploy:dev
```

### Working with Shared Packages

```bash
# Build all shared packages
pnpm build:packages

# Make changes to @lexara/shared-types
cd packages/shared-types
# Edit files...
pnpm build

# Changes automatically available to all apps
```

### Adding Dependencies

```bash
# Add to specific app
cd apps/chat-interface
pnpm add some-package

# Add to shared package
cd packages/shared-utils
pnpm add some-utility

# Add dev dependency to workspace root
pnpm add -D some-tool -w
```

## 🚀 Deployment

### Individual Apps

```bash
# Deploy chat interface to development
cd apps/chat-interface
pnpm deploy:dev

# Deploy platform admin to production
cd apps/platform-admin
pnpm deploy:production
```

### All Apps

```bash
# Deploy all apps to development
pnpm deploy:dev

# Deploy all apps to production
pnpm deploy:production
```

## 🔧 Available Scripts

### Root Level

- `pnpm build` - Build all packages and apps
- `pnpm dev` - Start all development servers
- `pnpm typecheck` - Type check all packages
- `pnpm lint` - Lint all packages
- `pnpm test` - Run all tests

### App Level

- `pnpm dev` - Start development server
- `pnpm build` - Build for deployment
- `pnpm deploy:dev` - Deploy to development environment
- `pnpm deploy:production` - Deploy to production environment

## 📖 Documentation

### Core Documentation
- **[System Architecture](./docs/CLAUDE.md)** - Complete platform design
- **[Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)** - Deployment procedures
- **[Auth0 Setup](./docs/AUTH0_SETUP_GUIDE.md)** - Authentication configuration
- **[Code Quality Guide](./docs/CODE_QUALITY_GUIDE.md)** - Development standards

### Application-Specific Documentation
- **[Homepage App](./apps/homepage/docs/)** - Firm portal documentation
  - [Testing Guide](./apps/homepage/docs/TESTING_GUIDE.md) - Test framework and status
  - [Database API](./apps/homepage/docs/DATABASE_CLIENT_API.md) - Database client reference
  - [Registration Setup](./apps/homepage/docs/FIRM_REGISTRATION_SETUP.md) - Registration flow

### Recent Updates
- **[Test Results Summary](./apps/homepage/TEST_RESULTS_SUMMARY.md)** - Current test status
- **[Priority Fixes Plan](./apps/homepage/PRIORITY_FIXES_PLAN.md)** - Security and API fixes needed

## 🏭 Production URLs

- **Homepage/Firm Portal**: `https://www.lexara.app` (production)
- **Chat Interface**: `https://dev.lexara.app` (development)
- **Platform Admin**: `https://platform-dev.lexara.app` (development)
- **API Worker**: `https://lexara-api-demo.cloudswift.workers.dev` (demo)

## 🧪 Testing

The project uses Vitest for unit and integration testing:

```bash
# Run all tests
pnpm test

# Run tests for specific app
pnpm test --filter=homepage

# Run tests with coverage
pnpm test:coverage --filter=homepage

# Run tests in watch mode
pnpm test:watch --filter=homepage
```

**Current Test Status (Homepage App)**:
- Total: 32 tests
- Passing: 10 ✅
- Failing: 22 ❌ (due to method/field name mismatches)
- [See Priority Fixes](./apps/homepage/PRIORITY_FIXES_PLAN.md)

## 🤝 Contributing

1. Create feature branch from `main`
2. Work in appropriate app or package directory
3. Write tests for new functionality
4. Run `pnpm test` to ensure tests pass
5. Run `pnpm code:check` before committing
6. Follow conventional commit format
7. Submit pull request

## 📄 License

Proprietary - Lexara Legal Technologies