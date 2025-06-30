# User Management System Specification

## Executive Summary

This document outlines the implementation of a comprehensive user management system for Lexara's multi-tenant law firm platform. The system leverages Auth0's Management API to provide secure user invitations, role-based access control, and firm-specific user administration.

## Current State

### ✅ Completed Infrastructure
- Auth0 Management API integration with M2M authentication
- User creation with firm-specific metadata (`user_metadata.firmId`, `user_metadata.role`)
- Settings page with debug information display
- FirmRegistry Durable Object for firm data management
- Role-based permissions structure in `app_metadata.permissions`

### 🎯 Implementation Goals
- Admin-only user invitation system
- Two-tier role system (Admin/User)
- Secure user removal with confirmation
- Real-time user status tracking
- Firm-specific user isolation

## System Architecture

### User Role System

#### Role Definitions
```typescript
type FirmUserRole = 'admin' | 'user';

interface RolePermissions {
  admin: {
    canEditSettings: true;
    canInviteUsers: true;
    canRemoveUsers: true;
    canChangeRoles: true;
    canViewAllConversations: true;
  };
  user: {
    canEditSettings: false;
    canInviteUsers: false;
    canRemoveUsers: false;
    canChangeRoles: false;
    canViewAllConversations: true;
  };
}
```

#### Business Rules
- Initial firm registrant automatically receives 'admin' role
- Each firm must maintain at least one 'admin' user at all times
- Only 'admin' users can access settings page
- Only 'admin' users can perform user management operations
- Role changes take effect immediately

### Auth0 Integration Strategy

#### Core API Endpoints
```typescript
// User Management APIs
POST   /api/v2/users                                    // Create invited user
POST   /api/v2/tickets/email-verification               // Send invitation email
GET    /api/v2/users?q=app_metadata.organization:"{firmId}"  // List firm users
PATCH  /api/v2/users/{userId}                           // Update user roles
DELETE /api/v2/users/{userId}                           // Remove users
```

#### User Metadata Structure
```typescript
interface Auth0UserMetadata {
  user_metadata: {
    firmId: string;
    role: 'admin' | 'user';
    firstName?: string;
    lastName?: string;
    invitedBy?: string;        // Auth0 user ID of inviting admin
    invitedAt?: string;        // ISO timestamp
  };
  app_metadata: {
    organization: string;       // Same as firmId for consistency
    permissions: string[];     // ['firm:admin'] or ['firm:user']
    plan?: string;
  };
}
```

## User Invitation Flow

### Step-by-Step Process
1. **Admin Initiates Invitation**
   - Fills form with email and role selection
   - Client-side validation for email format
   - Permission check: Only admins can invite

2. **Backend Processing**
   - Validate admin permissions against firmId
   - Check for duplicate emails within firm
   - Create Auth0 user with metadata:
     ```json
     {
       "connection": "Username-Password-Authentication",
       "email": "user@example.com",
       "email_verified": false,
       "user_metadata": {
         "firmId": "firm_123",
         "role": "user",
         "invitedBy": "auth0|inviting_admin_id",
         "invitedAt": "2025-01-01T00:00:00Z"
       },
       "app_metadata": {
         "organization": "firm_123",
         "permissions": ["firm:user"]
       }
     }
     ```

3. **Email Verification Trigger**
   - Use Auth0's email verification ticket API
   - User receives email with verification link
   - Link redirects to Auth0 Universal Login
   - User sets password and completes verification

4. **Completion**
   - User status changes from "pending" to "active"
   - Full firm access granted based on role
   - Admin sees updated status in user grid

### Invitation Expiry
- Auth0's built-in email verification expiry will be used
- No custom expiry logic will be implemented initially
- Future enhancement: Custom expiry management if needed

## User Interface Design

### Enhanced Settings Page

#### Add User Modal
```html
<div id="add-user-modal" class="modal">
  <div class="modal-content">
    <h3>Invite Team Member</h3>
    <form id="invite-user-form">
      <div class="form-group">
        <label for="user-email">Email Address *</label>
        <input type="email" id="user-email" required 
               placeholder="colleague@lawfirm.com">
      </div>
      <div class="form-group">
        <label for="user-role">Role *</label>
        <select id="user-role" required>
          <option value="user">User - Can view conversations and basic features</option>
          <option value="admin">Admin - Full access including settings and user management</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" id="cancel-invite">Cancel</button>
        <button type="submit" id="send-invite">Send Invitation</button>
      </div>
    </form>
  </div>
</div>
```

#### User Grid Enhancement
```typescript
interface UserGridDisplay {
  id: string;
  avatar: string;           // Generated initials
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'inactive';
  emailVerified: boolean;
  lastLogin: string | null;
  invitedAt?: string;
  canRemove: boolean;       // False for last admin
}
```

#### Grid Columns
- **User Info**: Avatar, name, email
- **Role**: Color-coded badge (Admin=blue, User=gray)
- **Status**: 
  - 🟢 Active (email verified, can login)
  - 🟡 Pending (invitation sent, awaiting verification)
  - 🔴 Inactive (disabled or blocked)
- **Email Status**: ✅ Verified / ⏳ Pending / ❌ Unverified
- **Last Login**: Timestamp or "Never"
- **Actions**: Role dropdown, Remove button

### User Removal Confirmation

#### Two-Step Confirmation Process
```html
<div id="remove-user-modal" class="modal">
  <div class="modal-content">
    <h3>Remove User Access</h3>
    <div class="user-details">
      <div class="user-avatar">[JD]</div>
      <div>
        <p><strong>Jane Doe</strong></p>
        <p>jane@lawfirm.com</p>
        <p>Role: Admin</p>
      </div>
    </div>
    <div class="warning">
      <p>⚠️ This action will immediately revoke access and cannot be undone.</p>
      <p>The user will no longer be able to login or access any firm data.</p>
    </div>
    <div class="confirmation">
      <label>Type <strong>REMOVE</strong> to confirm:</label>
      <input type="text" id="confirm-text" placeholder="REMOVE">
    </div>
    <div class="form-actions">
      <button type="button" id="cancel-remove">Cancel</button>
      <button type="button" id="confirm-remove" disabled>Remove User</button>
    </div>
  </div>
</div>
```

## API Implementation

### New Endpoints

#### GET /api/v1/firm/users
```typescript
// Request
GET /api/v1/firm/users?firmId=firm_123

// Response
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "auth0|user1",
        "email": "admin@firm.com",
        "name": "John Admin",
        "role": "admin",
        "status": "active",
        "emailVerified": true,
        "lastLogin": "2025-01-01T12:00:00Z",
        "createdAt": "2024-12-01T10:00:00Z"
      }
    ],
    "total": 1,
    "adminCount": 1
  }
}
```

#### POST /api/v1/firm/users
```typescript
// Request
POST /api/v1/firm/users
{
  "firmId": "firm_123",
  "email": "newuser@firm.com",
  "role": "user",
  "firstName": "New",
  "lastName": "User"
}

// Response
{
  "success": true,
  "data": {
    "user": {
      "id": "auth0|newuser",
      "email": "newuser@firm.com",
      "status": "pending",
      "invitationSent": true
    },
    "message": "Invitation sent successfully"
  }
}
```

#### PATCH /api/v1/firm/users/{userId}
```typescript
// Request
PATCH /api/v1/firm/users/auth0|user123
{
  "role": "admin"
}

// Response
{
  "success": true,
  "data": {
    "user": {
      "id": "auth0|user123",
      "role": "admin",
      "updatedAt": "2025-01-01T12:00:00Z"
    }
  }
}
```

#### DELETE /api/v1/firm/users/{userId}
```typescript
// Request
DELETE /api/v1/firm/users/auth0|user123

// Response
{
  "success": true,
  "message": "User removed successfully"
}
```

### Security Implementation

#### Permission Validation Middleware
```typescript
async function validateUserManagementPermissions(
  requestingUserId: string, 
  firmId: string, 
  action: 'invite' | 'remove' | 'change_role'
): Promise<void> {
  // 1. Verify requesting user exists and belongs to firm
  const requestingUser = await getAuth0User(requestingUserId);
  if (requestingUser.user_metadata?.firmId !== firmId) {
    throw new Error('User does not belong to this firm');
  }
  
  // 2. Verify requesting user has admin role
  if (requestingUser.user_metadata?.role !== 'admin') {
    throw new Error('Only admins can manage users');
  }
  
  // 3. For removal actions, check last admin rule
  if (action === 'remove') {
    await validateNotLastAdmin(requestingUserId, firmId);
  }
}

async function validateNotLastAdmin(userId: string, firmId: string): Promise<void> {
  const firmAdmins = await getFirmAdmins(firmId);
  if (firmAdmins.length === 1 && firmAdmins[0].user_id === userId) {
    throw new Error('Cannot remove the last admin user');
  }
}
```

#### Input Validation
```typescript
interface InviteUserRequest {
  firmId: string;        // Must match authenticated user's firm
  email: string;         // Valid email format, unique within firm
  role: 'admin' | 'user'; // Only allowed values
  firstName?: string;    // Optional, sanitized
  lastName?: string;     // Optional, sanitized
}

function validateInviteRequest(data: InviteUserRequest): void {
  // Email validation
  if (!isValidEmail(data.email)) {
    throw new Error('Invalid email format');
  }
  
  // Role validation
  if (!['admin', 'user'].includes(data.role)) {
    throw new Error('Invalid role specified');
  }
  
  // Name sanitization
  if (data.firstName) data.firstName = sanitizeInput(data.firstName);
  if (data.lastName) data.lastName = sanitizeInput(data.lastName);
}
```

## Audit Logging (Stubbed)

### Logging Structure
```typescript
interface UserManagementAuditLog {
  timestamp: string;
  firmId: string;
  action: 'user_invited' | 'user_removed' | 'role_changed' | 'invitation_resent';
  performedBy: string;      // Auth0 user ID
  targetUser: string;       // Auth0 user ID or email
  details: {
    oldRole?: string;
    newRole?: string;
    email?: string;
  };
  ipAddress?: string;
  userAgent?: string;
}
```

### Audit Points
- User invitation sent
- Role changes (old role → new role)
- User removal
- Invitation resending
- Failed permission checks

### Implementation (Stubbed)
```typescript
// For now, console logging with structured format
async function auditUserAction(log: UserManagementAuditLog): Promise<void> {
  console.log('AUDIT_LOG:', JSON.stringify(log));
  
  // TODO: Implement persistent audit storage
  // - Send to Durable Object for persistence
  // - Integrate with logging service
  // - Add retention policies
  // - Implement audit trail queries
}
```

## Error Handling

### User-Facing Error Messages
```typescript
const USER_MANAGEMENT_ERRORS = {
  PERMISSION_DENIED: 'You do not have permission to manage users',
  INVALID_EMAIL: 'Please enter a valid email address',
  EMAIL_EXISTS: 'A user with this email already exists in your firm',
  LAST_ADMIN: 'Cannot remove the last admin user',
  USER_NOT_FOUND: 'User not found or does not belong to your firm',
  INVITATION_FAILED: 'Failed to send invitation. Please try again.',
  AUTH0_ERROR: 'User management service temporarily unavailable'
};
```

### Error Recovery
- **Network Failures**: Retry mechanism with exponential backoff
- **Auth0 Rate Limits**: Queue requests and show progress
- **Validation Errors**: Clear field-level error messages
- **Permission Errors**: Redirect to unauthorized page

## Testing Strategy

### Test Scenarios
1. **Happy Path Testing**
   - Admin invites user → Email sent, user appears as pending
   - User accepts invitation → Status changes to active
   - Admin changes user role → Role updates immediately
   - Admin removes user → Confirmation flow completes

2. **Permission Testing**
   - Non-admin tries to access settings → Blocked
   - Non-admin tries to invite user → API error
   - User tries to remove themselves → Allowed if not last admin

3. **Edge Case Testing**
   - Invite existing email → Error message
   - Remove last admin → Blocked with error
   - Auth0 API failure → Graceful error handling
   - Concurrent role changes → Consistency maintained

4. **Security Testing**
   - Cross-firm user access attempts → Blocked
   - JWT manipulation → Rejected
   - Role escalation attempts → Prevented

## Implementation Plan

### Phase 1: Core API Infrastructure (Week 1)
**Files to Create/Modify:**
- `src/pages/api/v1/firm/users.ts` (New - Main user management API)
- `src/pages/api/v1/firm/users/[userId].ts` (New - Individual user operations)
- `src/utils/auth0-management.ts` (New - Auth0 API helpers)
- `src/utils/user-permissions.ts` (New - Permission validation)

**Tasks:**
1. Create user listing API with Auth0 Management API integration
2. Implement user invitation API with email verification
3. Add role change API with validation
4. Implement user removal API with last-admin protection
5. Add comprehensive error handling and validation

**Deliverables:**
- Working API endpoints for all user management operations
- Proper Auth0 metadata structure for invited users
- Permission validation middleware
- Error handling with user-friendly messages

### Phase 2: Settings Page UI Enhancement (Week 2)
**Files to Modify:**
- `src/pages/firm/settings.astro` (Major updates to user section)

**Tasks:**
1. Replace placeholder user grid with real Auth0 data
2. Build "Add User" modal with role selection
3. Implement role change dropdown functionality
4. Add user removal with two-step confirmation
5. Add real-time status updates and loading states

**Deliverables:**
- Fully functional user management interface
- Responsive design for mobile/desktop
- Loading states and error feedback
- Confirmation dialogs for destructive actions

### Phase 3: Security & Polish (Week 3)
**Files to Create/Modify:**
- `src/middleware/user-management-auth.ts` (New - Enhanced auth middleware)
- `src/utils/audit-logger.ts` (New - Audit logging structure)

**Tasks:**
1. Add rate limiting for invitation endpoints
2. Implement audit logging structure (stubbed)
3. Add comprehensive input sanitization
4. Enhance error messages and user feedback
5. Add client-side validation and UX improvements

**Deliverables:**
- Production-ready security measures
- Audit logging framework
- Enhanced user experience
- Comprehensive error handling

### Phase 4: Testing & Documentation (Week 4)
**Files to Create:**
- `tests/user-management.test.ts` (New - API tests)
- `tests/settings-ui.test.ts` (New - UI tests)

**Tasks:**
1. Write comprehensive API tests
2. Add UI automation tests for user flows
3. Security testing and penetration testing
4. Performance testing for large firm scenarios
5. Update documentation and deployment guides

**Deliverables:**
- Full test coverage for user management
- Security validation
- Performance benchmarks
- Deployment-ready system

## Success Criteria

### Functional Requirements
- ✅ Admins can invite users with email + role selection
- ✅ Invited users receive Auth0 verification emails
- ✅ User grid shows real-time status and login information
- ✅ Role changes take effect immediately
- ✅ User removal requires confirmation and respects last-admin rule
- ✅ Non-admins cannot access user management features

### Security Requirements
- ✅ All operations validate admin permissions
- ✅ Firm-specific user isolation maintained
- ✅ Cannot remove last admin user
- ✅ Input validation prevents malicious data
- ✅ Audit trail for all user management actions

### User Experience Requirements
- ✅ Intuitive interface for common operations
- ✅ Clear error messages and validation feedback
- ✅ Loading states during API operations
- ✅ Confirmation dialogs prevent accidental actions
- ✅ Responsive design works on all devices

This specification provides a comprehensive roadmap for implementing secure, user-friendly user management within the existing Lexara platform architecture.