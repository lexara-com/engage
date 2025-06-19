# Monorepo Restructure Plan

## Overview
Reorganizing the Engage Legal AI codebase from a single-service structure to a clean monorepo with independent applications and shared packages.

## Updated Target Structure

```
engage-legal-ai/
├── apps/
│   ├── homepage/                    # lexara.app - Product homepage & firm enrollment
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── index.astro      # Product homepage
│   │   │   │   ├── pricing.astro    # Pricing plans
│   │   │   │   ├── features.astro   # Feature showcase
│   │   │   │   └── signup/
│   │   │   │       └── index.astro  # Firm enrollment
│   │   │   ├── components/
│   │   │   │   ├── Hero.astro
│   │   │   │   ├── Pricing.astro
│   │   │   │   └── SignupForm.astro
│   │   │   ├── layouts/
│   │   │   └── styles/
│   │   ├── wrangler-homepage.toml
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── chat-interface/              # dev.lexara.app - Client intake chat
│   │   ├── src/
│   │   │   ├── agent/
│   │   │   │   ├── main-worker.ts
│   │   │   │   └── claude-agent.ts
│   │   │   ├── durable-objects/
│   │   │   │   ├── conversation-session.ts
│   │   │   │   └── hipaa-conversation-session.ts
│   │   │   ├── components/
│   │   │   │   ├── ChatWindow.astro
│   │   │   │   ├── LegalDisclaimer.astro
│   │   │   │   └── MessageBubble.astro
│   │   │   └── utils/
│   │   ├── wrangler.toml
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── platform-admin/              # platform-dev.lexara.app - Lexara admin
│   │   ├── src/
│   │   │   ├── platform/
│   │   │   │   ├── platform-worker.ts
│   │   │   │   ├── auth/
│   │   │   │   ├── security/
│   │   │   │   ├── audit/
│   │   │   │   └── templates/
│   │   │   ├── durable-objects/
│   │   │   │   ├── platform-session.ts
│   │   │   │   ├── platform-audit-log.ts
│   │   │   │   └── firm-registry.ts
│   │   │   └── services/
│   │   │       └── admin-api.ts
│   │   ├── wrangler-platform.toml
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── firm-portal/                 # portal.lexara.app - Law firm admin portal
│   │   ├── src/
│   │   │   ├── portal/
│   │   │   │   ├── portal-worker.ts
│   │   │   │   ├── auth/
│   │   │   │   ├── templates/
│   │   │   │   └── api/
│   │   │   ├── components/
│   │   │   │   ├── Dashboard.astro
│   │   │   │   ├── ConversationList.astro
│   │   │   │   └── ConflictManager.astro
│   │   │   └── services/
│   │   │       ├── conversation-api.ts
│   │   │       └── conflict-api.ts
│   │   ├── wrangler-portal.toml
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── mcp-servers/                 # Microservices
│       ├── goal-tracker/
│       │   ├── src/
│       │   │   ├── server.ts
│       │   │   ├── types.ts
│       │   │   └── worker.ts
│       │   ├── wrangler-goal-tracker.toml
│       │   └── package.json
│       ├── conflict-checker/
│       │   ├── src/
│       │   ├── wrangler-conflict-checker.toml
│       │   └── package.json
│       ├── additional-goals/
│       │   ├── src/
│       │   ├── wrangler-additional-goals.toml
│       │   └── package.json
│       └── shared-mcp/
│           ├── src/types.ts        # Common MCP types
│           └── package.json
│
├── packages/
│   ├── shared-types/                # @lexara/shared-types
│   │   ├── src/
│   │   │   ├── auth.ts             # AuthContext, User, Session types
│   │   │   ├── conversation.ts     # Message, Goal, ConversationSession
│   │   │   ├── firm.ts             # Firm, FirmUser, FirmSettings
│   │   │   ├── hipaa.ts            # HIPAA compliance types
│   │   │   └── index.ts            # Re-exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared-utils/                # @lexara/shared-utils  
│   │   ├── src/
│   │   │   ├── logger.ts           # Centralized logging
│   │   │   ├── errors.ts           # Error classes and handling
│   │   │   ├── ulid.ts             # ULID generation
│   │   │   ├── validation.ts       # Common validators
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── auth-lib/                    # @lexara/auth-lib
│   │   ├── src/
│   │   │   ├── jwt-validator.ts    # JWT validation logic
│   │   │   ├── auth-middleware.ts  # Auth middleware
│   │   │   ├── auth0-config.ts     # Auth0 configuration
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui-components/               # @lexara/ui-components
│   │   ├── src/
│   │   │   ├── ChatWindow.astro
│   │   │   ├── LegalDisclaimer.astro
│   │   │   ├── MessageBubble.astro
│   │   │   ├── AuthGuard.astro
│   │   │   └── layouts/
│   │   │       └── BaseLayout.astro
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── hipaa-compliance/            # @lexara/hipaa-compliance
│       ├── src/
│       │   ├── encryption.ts       # HIPAA encryption utilities
│       │   ├── audit.ts            # HIPAA audit logging
│       │   ├── data-handling.ts    # PII data handling
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                            # All documentation
│   ├── api-reference/
│   │   ├── chat-interface.md
│   │   ├── platform-admin.md
│   │   └── firm-portal.md
│   ├── deployment/
│   │   ├── staging.md
│   │   ├── production.md
│   │   └── environments.md
│   ├── guides/
│   │   ├── auth0-setup.md
│   │   ├── firm-onboarding.md
│   │   └── development.md
│   └── architecture/
│       ├── overview.md
│       ├── data-flow.md
│       └── security.md
│
├── scripts/                         # Deployment automation
│   ├── deploy/
│   │   ├── deploy-all-dev.sh
│   │   ├── deploy-all-production.sh
│   │   ├── deploy-homepage.sh
│   │   ├── deploy-chat.sh
│   │   ├── deploy-platform.sh
│   │   ├── deploy-portal.sh
│   │   └── deploy-mcp.sh
│   ├── setup/
│   │   ├── setup-env.sh
│   │   ├── setup-auth0.sh
│   │   └── setup-domains.sh
│   └── validate/
│       ├── validate-config.sh
│       ├── validate-env.sh
│       └── health-check.sh
│
├── tools/                           # Development tools
│   ├── eslint-config/
│   │   ├── base.js
│   │   ├── worker.js
│   │   └── astro.js
│   ├── tsconfig-base/
│   │   ├── base.json
│   │   ├── worker.json
│   │   └── astro.json
│   └── testing-utils/
│       ├── setup.ts
│       └── helpers.ts
│
├── tests/                           # Global integration tests
│   ├── e2e/
│   │   ├── homepage-to-signup.test.ts
│   │   ├── complete-intake-flow.test.ts
│   │   └── admin-workflow.test.ts
│   └── performance/
│       ├── load-testing.ts
│       └── benchmarks.ts
│
├── package.json                     # Root workspace management
├── pnpm-workspace.yaml             # Workspace configuration
├── turbo.json                       # Build orchestration
├── .eslintrc.js                    # Root ESLint config
├── .prettierrc.js                  # Root Prettier config
└── README.md                       # Main project documentation
```

## Application Responsibilities

### 1. Homepage (`lexara.app`)
- **Purpose**: Product marketing and firm enrollment
- **Features**:
  - Product showcase and feature demonstration
  - Pricing plans and subscription management
  - Firm signup and onboarding workflow
  - Contact forms and lead generation
  - Documentation and support resources
- **Tech Stack**: Astro SSG with Cloudflare Pages
- **Auth**: No authentication required (public site)

### 2. Chat Interface (`dev.lexara.app`)
- **Purpose**: AI-powered client intake conversations
- **Features**:
  - Claude AI integration for legal conversations
  - Conversation session management
  - Goal tracking and completion
  - Conflict detection integration
  - HIPAA-compliant data handling
- **Tech Stack**: Cloudflare Workers + Durable Objects
- **Auth**: Client authentication (Auth0 or session-based)

### 3. Platform Admin (`platform-dev.lexara.app`)
- **Purpose**: Lexara employee administration
- **Features**:
  - Firm management and oversight
  - System analytics and monitoring
  - User management across all firms
  - Platform configuration
  - Audit log review
- **Tech Stack**: Cloudflare Workers + Durable Objects
- **Auth**: Lexara admin authentication (Auth0)

### 4. Firm Portal (`portal.lexara.app`)
- **Purpose**: Law firm administration and conversation management
- **Features**:
  - Conversation review and management
  - Conflict list management
  - Supporting document uploads
  - Firm user management
  - Billing and subscription management
- **Tech Stack**: Cloudflare Workers + Durable Objects
- **Auth**: Firm admin authentication (Auth0)

### 5. MCP Servers
- **Purpose**: Microservices for AI agent functionality
- **Services**:
  - Goal Tracker: Conversation goal management
  - Conflict Checker: Conflict of interest detection
  - Additional Goals: Supporting document search
- **Tech Stack**: Cloudflare Workers (HTTP APIs)
- **Auth**: Internal service authentication

## Migration Steps

### Phase 1: Backup and Planning (Today)
1. ✅ **Create Migration Plan** (`MONOREPO_RESTRUCTURE_PLAN.md`)
2. 🔄 **Commit Current State** (git commit + push)
3. 🔄 **Create Directory Structure** (empty folders and package.json files)

### Phase 2: Extract Shared Packages (Day 1)
1. **Create `packages/shared-types/`**
   - Move `src/types/shared.ts` → `packages/shared-types/src/`
   - Extract common interfaces used across services
   - Set up package.json with proper exports

2. **Create `packages/shared-utils/`**
   - Move `src/utils/logger.ts` → `packages/shared-utils/src/`
   - Move `src/utils/errors.ts` → `packages/shared-utils/src/`
   - Move `src/utils/ulid.ts` → `packages/shared-utils/src/`

3. **Create `packages/auth-lib/`**
   - Move `src/auth/jwt-validator.ts` → `packages/auth-lib/src/`
   - Move `src/auth/auth-middleware.ts` → `packages/auth-lib/src/`
   - Move `src/auth/auth0-config.ts` → `packages/auth-lib/src/`

### Phase 3: Migrate Applications (Day 2)
1. **Create `apps/chat-interface/`**
   - Move `src/agent/` → `apps/chat-interface/src/agent/`
   - Move `src/durable-objects/conversation-session.ts` → `apps/chat-interface/src/durable-objects/`
   - Move `wrangler.toml` → `apps/chat-interface/wrangler.toml`
   - Update imports to use shared packages

2. **Create `apps/platform-admin/`**
   - Move `src/platform/` → `apps/platform-admin/src/platform/`
   - Move `src/durable-objects/firm-registry.ts` → `apps/platform-admin/src/durable-objects/`
   - Move `wrangler-platform.toml` → `apps/platform-admin/wrangler.toml`

3. **Create `apps/mcp-servers/`**
   - Move `src/mcp/goal-tracker/` → `apps/mcp-servers/goal-tracker/src/`
   - Move `src/mcp/conflict-checker/` → `apps/mcp-servers/conflict-checker/src/`
   - Move `src/mcp/additional-goals/` → `apps/mcp-servers/additional-goals/src/`

### Phase 4: Create New Applications (Day 3)
1. **Create `apps/homepage/`** (New)
   - Design product homepage with Astro
   - Implement firm signup workflow
   - Create pricing and features pages

2. **Create `apps/firm-portal/`** (New)
   - Design firm admin interface
   - Implement conversation management
   - Create conflict management UI

### Phase 5: Documentation and Cleanup (Day 4)
1. **Move Documentation**
   - Move all `.md` files → `docs/`
   - Create app-specific README files
   - Update deployment documentation

2. **Update Configuration**
   - Set up `pnpm-workspace.yaml`
   - Configure `turbo.json` for build orchestration
   - Update all package.json dependencies

3. **Update Deployment Scripts**
   - Move `scripts/` → root `scripts/`
   - Update deployment scripts for new structure
   - Test all deployment flows

## Key Design Decisions

### Workspace Management
- **Tool**: pnpm workspaces (faster than npm, better than yarn)
- **Build**: Turbo for build orchestration and caching
- **Dependencies**: Shared dev dependencies at root, app-specific at app level

### Package Naming
- **Scope**: `@lexara/` for all internal packages
- **Naming**: Descriptive names (`shared-types`, `auth-lib`, `ui-components`)

### Import Strategy
```typescript
// Before (current)
import { Logger } from '../../../utils/logger';
import { AuthContext } from '../../../types/shared';

// After (clean)
import { Logger } from '@lexara/shared-utils';
import { AuthContext } from '@lexara/shared-types';
```

### Build and Deploy
- Each app has independent build and deploy
- Shared packages built once, consumed by apps
- Turbo handles dependency graph and caching

## Risk Mitigation

### Backup Strategy
1. **Git Commit**: Current state committed before any changes
2. **Branch Protection**: Work on `feature/monorepo-restructure` branch
3. **Incremental Approach**: One app at a time, test deployments

### Testing Strategy
1. **Maintain Current Tests**: Move tests with their respective apps
2. **Integration Tests**: Global e2e tests in root `tests/` directory
3. **CI/CD**: Update GitHub Actions for new structure

### Rollback Plan
1. **Git Reset**: Can revert to pre-restructure commit
2. **DNS**: Keep current DNS until new structure is validated
3. **Environment Variables**: No changes to secrets during migration

## Success Criteria

### Technical
- [ ] All apps build and deploy independently
- [ ] No code duplication between apps
- [ ] Shared packages work correctly
- [ ] All tests pass
- [ ] Performance maintained or improved

### Operational  
- [ ] Development workflow improved
- [ ] Context memory usage reduced
- [ ] New developer onboarding easier
- [ ] Deployment process clearer
- [ ] Documentation comprehensive

## Timeline

- **Day 1**: Backup, shared packages extraction
- **Day 2**: Migrate existing applications
- **Day 3**: Create new applications (homepage, firm portal)
- **Day 4**: Documentation, testing, deployment validation

**Total Estimated Effort**: 3-4 days of focused work

## Next Steps

1. **Commit current state to git**
2. **Create feature branch**: `feature/monorepo-restructure`  
3. **Begin Phase 1**: Directory structure creation
4. **Systematic migration**: One application at a time
5. **Continuous testing**: Ensure each step works before proceeding

This plan provides a clear roadmap for transforming the current monolithic structure into a clean, maintainable monorepo that will scale well as the platform grows.