# Engage Legal AI - Deployment Guide

## 🏗️ Architecture Overview

Engage is a **multi-worker system** deployed across Cloudflare's edge infrastructure:

```
Engage Legal AI Platform
├── Main Agent Worker (wrangler.toml)          - Chat interface & AI agent
├── Platform Admin Worker (wrangler-platform.toml) - Platform administration  
├── Admin API Worker (wrangler-admin.toml)     - Firm admin interface
├── UI Pages (wrangler-pages.toml)             - Static site deployment
└── MCP Servers (3 workers)                    - Agent service integrations
    ├── Goal Tracker MCP                       - Conversation goal management
    ├── Conflict Checker MCP                   - Conflict detection service
    └── Additional Goals MCP                    - Supporting documents search
```

## 🌍 Environment Strategy

**Three-tier deployment model:**
- **Development**: `*-dev.lexara.app` domains 
- **Test/Staging**: `*-test.lexara.app` domains
- **Production**: `lexara.app` and `*.lexara.app` domains

## 📦 Deployment Commands

### Primary Workers (Required for core functionality)

```bash
# 1. Main Agent Worker - Core chat functionality
npm run deploy:dev                          # Deploy to dev.lexara.app
npm run deploy:test                         # Deploy to test.lexara.app  
npm run deploy:production                   # Deploy to lexara.app

# 2. Platform Admin Worker - Platform administration
npm run deploy:platform:dev                # Deploy to platform-dev.lexara.app
npm run deploy:platform:test               # Deploy to platform-test.lexara.app
npm run deploy:platform:production         # Deploy to platform.lexara.app
```

### Secondary Workers (Admin & MCP Services)

```bash
# Admin API Worker
npm run deploy:admin:dev
npm run deploy:admin:test  
npm run deploy:admin:production

# MCP Server Workers (deployed independently)
npx wrangler deploy --config wrangler-goal-tracker.toml --env dev
npx wrangler deploy --config wrangler-conflict-checker.toml --env dev
npx wrangler deploy --config wrangler-additional-goals.toml --env dev
```

### UI/Pages Deployment

```bash
# Build and deploy static pages (if using separate UI)
npm run build:ui
npx wrangler pages deploy dist --project-name engage-ui
```

## 🔧 Configuration Files Reference

| File | Purpose | Deployment Command | Domain |
|------|---------|-------------------|---------|
| `wrangler.toml` | Main Agent Worker | `npm run deploy:dev` | `dev.lexara.app` |
| `wrangler-platform.toml` | Platform Admin | `npm run deploy:platform:dev` | `platform-dev.lexara.app` |
| `wrangler-admin.toml` | Admin API | `npm run deploy:admin:dev` | `admin-dev.lexara.app` |
| `wrangler-pages.toml` | Static UI | `npx wrangler pages deploy` | `engage-ui.pages.dev` |
| `wrangler-goal-tracker.toml` | Goal Tracker MCP | `npx wrangler deploy --config` | Internal service |
| `wrangler-conflict-checker.toml` | Conflict Checker MCP | `npx wrangler deploy --config` | Internal service |
| `wrangler-additional-goals.toml` | Additional Goals MCP | `npx wrangler deploy --config` | Internal service |

## 🔐 Environment Variables

### Required Secrets (per environment)

```bash
# Auth0 Configuration
wrangler secret put AUTH0_CLIENT_SECRET --env dev
wrangler secret put ANTHROPIC_API_KEY --env dev

# OpenTelemetry (optional)
wrangler secret put OTEL_EXPORTER_OTLP_HEADERS --env dev
wrangler secret put LOGFIRE_TOKEN --env dev
```

### Environment-Specific Variables

**Development (`--env dev`)**
- `AUTH0_DOMAIN`: `dev-sv0pf6cz2530xz0o.us.auth0.com`
- `AUTH0_CLIENT_ID`: `QHexH0yTPx1xBZDIWrzltOjwGX86Bcx3` (Platform), `OjsR6To3nDqYDLVHtRjDFpk7wRcCfrfi` (Agent)

**Test (`--env test`)**
- `AUTH0_DOMAIN`: `lexara-test.us.auth0.com`
- `AUTH0_CLIENT_ID`: Test environment client IDs

**Production (`--env production`)**
- `AUTH0_DOMAIN`: `lexara.us.auth0.com`
- `AUTH0_CLIENT_ID`: Production client IDs

## 🚀 Quick Deployment Scripts

### Full System Deployment

```bash
# Deploy all core services to development
./scripts/deploy-all-dev.sh

# Deploy all core services to production  
./scripts/deploy-all-production.sh
```

### Individual Service Deployment

```bash
# Deploy specific worker to specific environment
npx wrangler deploy --config wrangler-platform.toml --env dev
npx wrangler deploy --config wrangler.toml --env production
```

## 🔍 Deployment Verification

After deployment, verify each service:

```bash
# Main Agent Worker
curl https://dev.lexara.app/health

# Platform Admin Worker  
curl https://platform-dev.lexara.app/health

# Admin API Worker
curl https://admin-dev.lexara.app/health
```

## 🛠️ Troubleshooting

### Common Deployment Issues

1. **Durable Object Binding Errors**
   - Ensure script names match exactly in bindings
   - Deploy workers in dependency order

2. **Environment Variable Issues**
   - Check secret values with `wrangler secret list --env dev`
   - Verify Auth0 client IDs match configuration

3. **Route Conflicts**
   - Each worker must have unique route patterns
   - Check domain DNS settings in Cloudflare dashboard

### Debug Commands

```bash
# Check worker status
wrangler status --config wrangler-platform.toml

# View real-time logs
wrangler tail --config wrangler.toml --env dev

# List all deployments
wrangler deployments list --name engage-legal-ai-dev
```

## 📚 Development Workflow

1. **Local Development**: Use `npm run dev:*` commands for local testing
2. **Development Deployment**: Deploy to `*-dev.lexara.app` for integration testing
3. **Staging**: Deploy to `*-test.lexara.app` for pre-production validation
4. **Production**: Deploy to production domains after testing

## 🔒 Security Considerations

- **Secrets Management**: Never commit secrets to git
- **Environment Isolation**: Each environment has separate Auth0 tenants
- **Domain Security**: Production domains use strict security headers
- **Access Control**: Platform admin has separate authentication domain

---

*This guide covers the complete deployment architecture for Engage Legal AI platform. For specific configuration details, see individual wrangler.toml files.*