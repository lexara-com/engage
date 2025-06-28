# Engage Legal AI Platform

> AI-powered legal client intake platform built on Cloudflare's edge infrastructure

## 🏗️ Monorepo Structure

This repository is organized as a monorepo with independent applications and shared packages:

### Applications (`apps/`)

- **`homepage/`** - Law firm marketing and signup site (`lexara.app`)
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

- **[System Architecture](./docs/CLAUDE.md)** - Complete platform design
- **[Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)** - Deployment procedures
- **[Auth0 Setup](./docs/AUTH0_SETUP_GUIDE.md)** - Authentication configuration
- **[Code Quality Guide](./docs/CODE_QUALITY_GUIDE.md)** - Development standards
- **[Monorepo Plan](./docs/MONOREPO_RESTRUCTURE_PLAN.md)** - Restructure documentation

## 🏭 Production URLs

- **Chat Interface**: `https://dev.lexara.app` (development)
- **Platform Admin**: `https://platform-dev.lexara.app` (development)

## 🤝 Contributing

1. Create feature branch from `main`
2. Work in appropriate app or package directory
3. Run `pnpm code:check` before committing
4. Follow conventional commit format
5. Submit pull request

## 📄 License

Proprietary - Lexara Legal Technologies