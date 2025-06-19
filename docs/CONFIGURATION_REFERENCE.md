# Configuration Reference - Engage Legal AI

## 📁 Configuration Files Overview

| File | Service | Purpose | Status |
|------|---------|---------|---------|
| `wrangler.toml` | **Main Agent Worker** | Core chat interface & AI agent | ✅ **Primary** |
| `wrangler-platform.toml` | **Platform Admin** | Platform administration portal | ✅ **Primary** |
| `wrangler-admin.toml` | **Admin API** | Firm admin interface | 🔧 **Secondary** |
| `wrangler-pages.toml` | **UI Pages** | Static site deployment | 📦 **Optional** |
| `wrangler-goal-tracker.toml` | **Goal Tracker MCP** | Conversation goal management | 🔌 **MCP Service** |
| `wrangler-conflict-checker.toml` | **Conflict Checker MCP** | Conflict detection service | 🔌 **MCP Service** |
| `wrangler-additional-goals.toml` | **Additional Goals MCP** | Supporting documents search | 🔌 **MCP Service** |

## 🌍 Domain Architecture

### Development Environment (`--env dev`)
- **Main Chat**: `dev.lexara.app`
- **Platform Admin**: `platform-dev.lexara.app`
- **Admin API**: `admin-dev.lexara.app`

### Test Environment (`--env test`)
- **Main Chat**: `test.lexara.app`
- **Platform Admin**: `platform-test.lexara.app`
- **Admin API**: `admin-test.lexara.app`

### Production Environment (`--env production`)
- **Main Chat**: `lexara.app`
- **Platform Admin**: `platform.lexara.app`
- **Admin API**: `admin.lexara.app`

## 🔧 Deployment Commands Quick Reference

```bash
# Core Services (Required for basic functionality)
npm run deploy:dev                    # Main chat to dev.lexara.app
npm run deploy:platform:dev          # Platform admin to platform-dev.lexara.app

# All Core Services
npm run deploy:all:dev               # Deploy both core services to dev
npm run deploy:all:production        # Deploy both core services to production

# MCP Services (Enhanced functionality)
npm run deploy:mcp:dev               # Deploy all MCP services to dev
npm run deploy:mcp:production        # Deploy all MCP services to production

# Validation
npm run validate:config              # Validate all configurations
```

## 🔐 Environment Variables by Service

### Main Agent Worker (`wrangler.toml`)
```toml
[env.dev.vars]
ENVIRONMENT = "development"
LOG_LEVEL = "debug"
AUTH0_DOMAIN = "dev-sv0pf6cz2530xz0o.us.auth0.com"
AUTH0_CLIENT_ID = "OjsR6To3nDqYDLVHtRjDFpk7wRcCfrfi"
API_BASE_URL = "https://api.dev.lexara.app"
```

### Platform Admin Worker (`wrangler-platform.toml`)
```toml
[env.dev.vars]
ENVIRONMENT = "development"
LOG_LEVEL = "debug"
AUTH0_DOMAIN = "dev-sv0pf6cz2530xz0o.us.auth0.com"
AUTH0_CLIENT_ID = "QHexH0yTPx1xBZDIWrzltOjwGX86Bcx3"
AUTH0_CLIENT_SECRET = "(secret)"
AUTH0_AUDIENCE = "https://api.dev.lexara.app"
```

## 🏗️ Durable Object Dependencies

### Main Agent Worker
- `CONVERSATION_SESSION` → `ConversationSession` class
- `FIRM_REGISTRY` → `FirmRegistry` class

### Platform Admin Worker
- `PLATFORM_SESSION` → `PlatformSession` class
- `PLATFORM_AUDIT_LOG` → `PlatformAuditLog` class
- `FIRM_REGISTRY` → `FirmRegistry` class (shared)

### Dependency Order
1. Deploy `FirmRegistry` first (shared dependency)
2. Deploy Main Agent Worker
3. Deploy Platform Admin Worker
4. Deploy MCP services (independent)

## 📦 Package.json Script Mapping

| Command | Configuration | Environment | Description |
|---------|---------------|-------------|-------------|
| `npm run deploy:dev` | `wrangler.toml` | `dev` | Main chat to dev |
| `npm run deploy:platform:dev` | `wrangler-platform.toml` | `dev` | Platform admin to dev |
| `npm run deploy:all:dev` | Multiple | `dev` | All core services to dev |
| `npm run deploy:mcp:dev` | MCP configs | `dev` | All MCP services to dev |

## 🛠️ Common Configuration Patterns

### Environment Configuration Template
```toml
[env.ENVIRONMENT_NAME]
name = "service-name-ENVIRONMENT_NAME"
route = { pattern = "subdomain-ENVIRONMENT_NAME.lexara.app/*", zone_name = "lexara.app" }

[env.ENVIRONMENT_NAME.vars]
ENVIRONMENT = "ENVIRONMENT_NAME"
LOG_LEVEL = "debug|info|warn"
AUTH0_DOMAIN = "environment-specific-domain"
```

### Durable Object Binding Template
```toml
[[env.ENVIRONMENT_NAME.durable_objects.bindings]]
name = "BINDING_NAME"
class_name = "ClassName"
script_name = "service-name-ENVIRONMENT_NAME"
```

## 🚨 Common Issues & Solutions

### Issue: Durable Object Binding Errors
**Symptom**: `Cannot create binding for class that does not exist`
**Solution**: 
1. Ensure script names match exactly in bindings
2. Deploy workers in dependency order
3. Check class exports in worker files

### Issue: Route Conflicts
**Symptom**: Worker not responding or wrong worker handling requests
**Solution**:
1. Verify route patterns don't overlap
2. Check DNS settings in Cloudflare dashboard
3. Ensure each environment has unique routes

### Issue: Environment Variable Missing
**Symptom**: `Missing required environment variables`
**Solution**:
1. Check secrets: `wrangler secret list --env dev`
2. Verify variable names match exactly
3. Use proper environment when deploying

## 🔍 Configuration Validation

Use the validation script to check for common issues:

```bash
# Validate all configurations
npm run validate:config

# Manual validation
wrangler validate --config wrangler.toml
wrangler validate --config wrangler-platform.toml
```

## 📋 Pre-Deployment Checklist

- [ ] All secrets configured: `wrangler secret list --env ENV`
- [ ] Configuration validated: `npm run validate:config`
- [ ] Dependencies deployed in correct order
- [ ] Environment variables match target environment
- [ ] Route patterns don't conflict
- [ ] Health checks pass after deployment

## 🔗 Related Documentation

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Complete deployment procedures
- **[CLAUDE.md](./CLAUDE.md)** - System architecture overview
- **[AUTH0_SETUP_GUIDE.md](./AUTH0_SETUP_GUIDE.md)** - Authentication configuration

---

*This reference covers all configuration aspects of the Engage Legal AI platform. Keep this updated when adding new services or environments.*