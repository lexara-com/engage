#!/bin/bash

# Script to create GitHub issues for Authorization System Refactor
# Run this script to create all issues in the correct order

echo "Creating GitHub issues for Authorization System Refactor..."

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed. Please install it first:"
    echo "https://cli.github.com/"
    exit 1
fi

# Issue 1: Database Schema
gh issue create \
  --title "Auth Refactor Phase 1.1: Database Schema for User Management" \
  --body "## Overview
Replace Auth0 metadata with proper database tables for enterprise-grade user management.

## Tasks
- [ ] Design database schema for firms, users, and user_sessions
- [ ] Create migration scripts
- [ ] Implement database models/types
- [ ] Add database initialization to worker setup

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

## Acceptance Criteria
- Database schema created and tested
- Migration scripts ready
- Models/types implemented
- Integration with Cloudflare D1 working

## Dependencies
None - this is the foundation

## Estimated Time
1 day" \
  --label "enhancement,auth-refactor,phase-1" \
  --milestone "Authorization Refactor"

# Issue 2: Permission Service
gh issue create \
  --title "Auth Refactor Phase 1.2: Centralized Permission Service" \
  --body "## Overview
Create a centralized PermissionService that serves as the single source of truth for all authorization decisions.

## Tasks
- [ ] Implement PermissionService class
- [ ] Add RBAC (Role-Based Access Control) logic
- [ ] Create permission validation methods
- [ ] Add user role management functions
- [ ] Implement firm-scoped permissions

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

## Acceptance Criteria
- PermissionService implemented and tested
- All permission logic centralized
- Clear RBAC implementation
- Database-backed permission storage
- No client-side permission logic needed

## Dependencies
- Database Schema (#previous-issue)

## Estimated Time
2 days" \
  --label "enhancement,auth-refactor,phase-1" \
  --milestone "Authorization Refactor"

# Issue 3: Auth Middleware
gh issue create \
  --title "Auth Refactor Phase 1.3: API Authentication Middleware" \
  --body "## Overview
Create consistent authentication and authorization middleware for all API endpoints.

## Tasks
- [ ] Implement authMiddleware function
- [ ] Add JWT token validation
- [ ] Integrate with PermissionService
- [ ] Apply to all protected API endpoints
- [ ] Remove Auth0 Management API dependencies

## Middleware Design
\`\`\`typescript
async function authMiddleware(
  request: Request,
  requiredPermission: string,
  resourceId?: string
): Promise<{ user: User, permissions: UserPermissions }>
\`\`\`

## Acceptance Criteria
- Consistent auth across all API endpoints
- No direct Auth0 Management API calls in endpoints
- Clear permission validation
- Proper error handling and responses

## Dependencies
- Permission Service (#previous-issue)

## Estimated Time
1 day" \
  --label "enhancement,auth-refactor,phase-1" \
  --milestone "Authorization Refactor"

# Continue with remaining issues...
echo "Creating remaining issues..."

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

## Acceptance Criteria
- Auth0 only handles login/logout/user identity
- No permission data stored in Auth0
- Simplified auth flow

## Dependencies
- Database Schema and Permission Service

## Estimated Time
1 day" \
  --label "enhancement,auth-refactor,phase-2" \
  --milestone "Authorization Refactor"

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

## Acceptance Criteria
- Custom JWT tokens with permissions
- Secure token management
- Proper refresh mechanism
- Integration with Auth0 authentication

## Dependencies
- Permission Service

## Estimated Time
2 days" \
  --label "enhancement,auth-refactor,phase-2" \
  --milestone "Authorization Refactor"

gh issue create \
  --title "Auth Refactor Phase 2.3: Proper User Onboarding Service" \
  --body "## Overview
Create proper onboarding flow that automatically makes first user admin.

## Tasks
- [ ] Implement OnboardingService
- [ ] First-user-as-admin logic during signup
- [ ] Proper firm creation flow
- [ ] Remove post-hoc permission granting

## Acceptance Criteria
- Seamless user onboarding
- No manual permission setup needed
- First user automatically gets admin role
- Clear firm setup process

## Dependencies
- Permission Service, Database Schema

## Estimated Time
1 day" \
  --label "enhancement,auth-refactor,phase-2" \
  --milestone "Authorization Refactor"

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

## Acceptance Criteria
- No client-side permission logic
- Clean codebase without hacks
- UI trusts server completely
- No localStorage dependency

## Dependencies
- Server-side permission API

## Estimated Time
1 day" \
  --label "enhancement,auth-refactor,phase-3" \
  --milestone "Authorization Refactor"

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

## Acceptance Criteria
- Server provides all permission context
- Client doesn't store permissions
- Clean API design
- Fast permission lookups

## Dependencies
- Permission Service

## Estimated Time
1 day" \
  --label "enhancement,auth-refactor,phase-3" \
  --milestone "Authorization Refactor"

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

## Acceptance Criteria
- Settings UI works with server permissions
- No client-side permission logic
- Add User button works correctly
- Clean separation of concerns

## Dependencies
- Server Permission API

## Estimated Time
1 day" \
  --label "enhancement,auth-refactor,phase-3" \
  --milestone "Authorization Refactor"

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

## Acceptance Criteria
- 100% test coverage for permission logic
- All user flows tested
- Performance tests
- Security tests

## Dependencies
- All previous phases completed

## Estimated Time
2 days" \
  --label "testing,auth-refactor,phase-4" \
  --milestone "Authorization Refactor"

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

## Acceptance Criteria
- All existing users migrated
- No data loss
- Permissions preserved
- Rollback plan tested

## Dependencies
- All core system components

## Estimated Time
1 day" \
  --label "enhancement,auth-refactor,phase-4" \
  --milestone "Authorization Refactor"

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

## Acceptance Criteria
- Successful production deployment
- All features working
- No user disruption
- Monitoring in place
- Rollback plan validated

## Dependencies
- Testing and Migration completed

## Estimated Time
1 day" \
  --label "deployment,auth-refactor,phase-4" \
  --milestone "Authorization Refactor"

echo "All GitHub issues created successfully!"
echo ""
echo "To view the issues:"
echo "  gh issue list --milestone 'Authorization Refactor'"
echo ""
echo "To start working on the first issue:"
echo "  gh issue view 1"