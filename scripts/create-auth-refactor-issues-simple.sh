#!/bin/bash

# Script to create GitHub issues for Authorization System Refactor
# Simplified version without custom labels or milestones

echo "Creating GitHub issues for Authorization System Refactor..."

# Issue 1: Database Schema
gh issue create \
  --title "Auth Refactor Phase 1.1: Database Schema for User Management" \
  --body "## Overview
Replace Auth0 metadata with proper database tables for enterprise-grade user management.

## Tasks
- [x] Design database schema for firms, users, and user_sessions
- [x] Create migration scripts
- [x] Implement database models/types
- [x] Add database initialization to worker setup

## Schema Design
\`\`\`sql
CREATE TABLE firms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL,
  settings JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  auth0_id TEXT UNIQUE NOT NULL,
  firm_id TEXT REFERENCES firms(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'inactive')),
  permissions JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  token_hash TEXT NOT NULL,
  permissions JSONB,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## Status: ✅ COMPLETED
- Database schema created and tested
- Migration scripts ready
- Models/types implemented
- Integration with Cloudflare D1 working

## Estimated Time: 1 day"

# Issue 2: Permission Service
gh issue create \
  --title "Auth Refactor Phase 1.2: Centralized Permission Service" \
  --body "## Overview
Create a centralized PermissionService that serves as the single source of truth for all authorization decisions.

## Tasks
- [x] Implement PermissionService class
- [x] Add RBAC (Role-Based Access Control) logic
- [x] Create permission validation methods
- [x] Add user role management functions
- [x] Implement firm-scoped permissions

## API Design
\`\`\`typescript
class PermissionService {
  async validatePermission(userId: string, action: string, resourceId?: string): Promise<boolean>
  async getUserPermissions(userId: string): Promise<UserPermissions>
  async assignRole(userId: string, role: Role, firmId: string): Promise<void>
  async removeUserFromFirm(userId: string, firmId: string): Promise<void>
  async getFirstAdminForFirm(firmId: string): Promise<User | null>
}
\`\`\`

## Status: ✅ COMPLETED
- PermissionService implemented and tested
- All permission logic centralized
- Clear RBAC implementation
- Database-backed permission storage
- No client-side permission logic needed

## Dependencies: Phase 1.1 (Database Schema)
## Estimated Time: 2 days"

# Issue 3: Auth Middleware
gh issue create \
  --title "Auth Refactor Phase 1.3: API Authentication Middleware" \
  --body "## Overview
Create consistent authentication and authorization middleware for all API endpoints.

## Tasks
- [x] Implement authMiddleware function
- [x] Add JWT token validation
- [x] Integrate with PermissionService
- [x] Apply to all protected API endpoints
- [x] Remove Auth0 Management API dependencies

## Middleware Design
\`\`\`typescript
async function authMiddleware(
  request: Request,
  requiredPermission: string,
  resourceId?: string
): Promise<{ user: User, permissions: UserPermissions }>
\`\`\`

## Status: ✅ COMPLETED
- Consistent auth across all API endpoints
- No direct Auth0 Management API calls in endpoints
- Clear permission validation
- Proper error handling and responses

## Dependencies: Phase 1.2 (Permission Service)
## Estimated Time: 1 day"

echo "Phase 1 issues created successfully!"
echo ""
echo "Creating Phase 2 issues..."

# Phase 2 Issues
gh issue create \
  --title "Auth Refactor Phase 2.1: Clean Auth0 Integration" \
  --body "## Overview
Simplify Auth0 to handle only authentication, remove all permission metadata.

## Tasks
- [ ] Remove user_metadata and app_metadata permission fields
- [ ] Keep Auth0 for authentication only
- [ ] Update Auth0 callbacks to not set permissions
- [ ] Clean up Auth0 configuration

## Status: 🔄 PENDING
- Auth0 only handles login/logout/user identity
- No permission data stored in Auth0
- Simplified auth flow

## Dependencies: Database Schema and Permission Service
## Estimated Time: 1 day"

gh issue create \
  --title "Auth Refactor Phase 2.2: Custom JWT Claims Management" \
  --body "## Overview
Implement our own JWT tokens with permission claims, issued after Auth0 authentication.

## Tasks
- [ ] Create JWT token generation service
- [ ] Add permission claims to tokens
- [ ] Implement token refresh mechanism
- [ ] Add token validation middleware
- [ ] Short-lived tokens with proper refresh

## Status: 🔄 PENDING
- Custom JWT tokens with permissions
- Secure token management
- Proper refresh mechanism
- Integration with Auth0 authentication

## Dependencies: Permission Service
## Estimated Time: 2 days"

gh issue create \
  --title "Auth Refactor Phase 2.3: Proper User Onboarding Service" \
  --body "## Overview
Create proper onboarding flow that automatically makes first user admin.

## Tasks
- [ ] Implement OnboardingService
- [ ] First-user-as-admin logic during signup
- [ ] Proper firm creation flow
- [ ] Remove post-hoc permission granting

## Status: 🔄 PENDING
- Seamless user onboarding
- No manual permission setup needed
- First user automatically gets admin role
- Clear firm setup process

## Dependencies: Permission Service, Database Schema
## Estimated Time: 1 day"

echo "Phase 2 issues created successfully!"
echo ""
echo "Creating Phase 3 issues..."

# Phase 3 Issues
gh issue create \
  --title "Auth Refactor Phase 3.1: Remove Client-Side Permission Hacks" \
  --body "## Overview
Clean up all client-side permission logic, localStorage hacks, and manual overrides.

## Tasks
- [ ] Remove all localStorage permission storage
- [ ] Delete manual override mechanisms
- [ ] Remove bypass parameters
- [ ] Clean up client-side auth logic
- [ ] Remove permission checks from UI

## Status: 🔄 PENDING
- No client-side permission logic
- Clean codebase without hacks
- UI trusts server completely
- No localStorage dependency

## Dependencies: Server-side permission API
## Estimated Time: 1 day"

gh issue create \
  --title "Auth Refactor Phase 3.2: Server-Provided Permission API" \
  --body "## Overview
Create API endpoint that provides current user's permissions for UI rendering.

## Tasks
- [ ] Implement GET /api/v1/user/permissions endpoint
- [ ] Return user context and permissions
- [ ] Update UI to fetch permissions from server
- [ ] Remove client-side permission storage

## API Design
\`\`\`typescript
GET /api/v1/user/permissions
Response: {
  user: User,
  permissions: {
    canManageUsers: boolean,
    canViewSettings: boolean,
    // etc.
  },
  firm: Firm
}
\`\`\`

## Status: 🔄 PENDING
- Server provides all permission context
- Client doesn't store permissions
- Clean API design
- Fast permission lookups

## Dependencies: Permission Service
## Estimated Time: 1 day"

gh issue create \
  --title "Auth Refactor Phase 3.3: UI Permission Context Refactor" \
  --body "## Overview
Refactor settings UI to use server-provided permission context instead of client-side logic.

## Tasks
- [ ] Update settings page to fetch permissions
- [ ] Remove inline permission checks
- [ ] Use server context for UI rendering
- [ ] Clean up JavaScript permission logic
- [ ] Test user management features

## Status: 🔄 PENDING
- Settings UI works with server permissions
- No client-side permission logic
- Add User button works correctly
- Clean separation of concerns

## Dependencies: Server Permission API
## Estimated Time: 1 day"

echo "Phase 3 issues created successfully!"
echo ""
echo "Creating Phase 4 issues..."

# Phase 4 Issues
gh issue create \
  --title "Auth Refactor Phase 4.1: Comprehensive Testing" \
  --body "## Overview
Create comprehensive test suite for the new permission system.

## Tasks
- [ ] Unit tests for PermissionService
- [ ] Integration tests for auth middleware
- [ ] API endpoint tests
- [ ] UI permission tests
- [ ] End-to-end user flow tests

## Status: 🔄 PENDING
- 100% test coverage for permission logic
- All user flows tested
- Performance tests
- Security tests

## Dependencies: All previous phases completed
## Estimated Time: 2 days"

gh issue create \
  --title "Auth Refactor Phase 4.2: User Migration from Auth0" \
  --body "## Overview
Implement migration of existing users from Auth0 metadata to new database system.

## Tasks
- [ ] Create migration script
- [ ] Export users from Auth0
- [ ] Import to new database schema
- [ ] Validate data integrity
- [ ] Create rollback plan

## Status: 🔄 PENDING
- All existing users migrated
- No data loss
- Permissions preserved
- Rollback plan tested

## Dependencies: All core system components
## Estimated Time: 1 day"

gh issue create \
  --title "Auth Refactor Phase 4.3: Production Deployment" \
  --body "## Overview
Deploy the new authorization system to production with proper rollback plan.

## Tasks
- [ ] Staging environment testing
- [ ] Production deployment plan
- [ ] Rollback procedures
- [ ] Monitoring and alerts
- [ ] User communication
- [ ] Post-deployment validation

## Status: 🔄 PENDING
- Successful production deployment
- All features working
- No user disruption
- Monitoring in place
- Rollback plan validated

## Dependencies: Testing and Migration completed
## Estimated Time: 1 day"

echo ""
echo "All GitHub issues created successfully!"
echo ""
echo "Summary:"
echo "✅ Phase 1: Server-Side Foundation (3 issues) - COMPLETED"
echo "🔄 Phase 2: Authentication Separation (3 issues) - PENDING"
echo "🔄 Phase 3: Client-Side Cleanup (3 issues) - PENDING"
echo "🔄 Phase 4: Testing & Deployment (3 issues) - PENDING"
echo ""
echo "Total: 12 issues created"
echo ""
echo "To view all issues:"
echo "  gh issue list"
echo ""
echo "Next steps:"
echo "1. Begin Phase 2.1: Clean Auth0 Integration"
echo "2. Continue with remaining phases in order"