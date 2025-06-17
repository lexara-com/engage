# Authentication & Authorization Architecture
## Engage Legal AI Platform - Security Design

### Executive Summary

The Engage platform requires a sophisticated authentication and authorization system to support multiple user types across a multi-tenant SaaS architecture. This document defines the complete security model, Auth0 integration strategy, and implementation approach.

## User Types & Access Patterns

### 1. **Lexara Platform Admins** 
*Anthropic/Lexara employees managing the platform*

**Access Requirements:**
- **Cross-Firm Access**: Can view and manage ALL law firms
- **System Administration**: Platform-wide settings, billing, support
- **Analytics**: System-wide usage metrics and health monitoring
- **Firm Management**: Create, suspend, or delete firm accounts

**Auth0 Configuration:**
- **Organization**: `lexara-platform` (special Lexara organization)
- **Roles**: `platform:admin`, `platform:support`, `platform:billing`
- **Metadata**: `{ "user_type": "lexara_admin", "access_level": "platform" }`

**Security Considerations:**
- Separate Auth0 tenant or organization for Lexara employees
- Multi-factor authentication required
- Audit logging for all cross-firm access
- IP restrictions for enhanced security

---

### 2. **Firm Administrators**
*Law firm owners/partners managing their firm's Engage instance*

**Access Requirements:**
- **Firm-Only Access**: Can ONLY access their specific firm's data
- **User Management**: Add/remove firm users, assign roles
- **Firm Configuration**: Practice areas, conflicts, supporting documents
- **Billing Management**: Subscription settings, usage monitoring
- **Analytics**: Firm-specific conversation metrics and reports

**Auth0 Configuration:**
- **Organization**: `firm-{firmId}` (one organization per law firm)
- **Roles**: `firm:admin`, `firm:billing_admin`
- **Metadata**: `{ "user_type": "firm_admin", "firm_id": "{firmId}", "firm_slug": "{slug}" }`

**Security Boundaries:**
- Cannot access other firms' data under any circumstances
- All API requests validated against `firm_id` in JWT
- Admin console scoped to single firm

---

### 3. **Firm Lawyers & Staff**
*Law firm employees using Engage for client intake*

**Access Requirements:**
- **Firm-Only Access**: Limited to their firm's conversations and data
- **Role-Based Permissions**: Varying access based on role (lawyer vs staff)
- **Conversation Management**: View, search, and manage client conversations
- **Limited Configuration**: May manage conflicts but not billing/users

**Auth0 Configuration:**
- **Organization**: `firm-{firmId}` (same as firm admins)
- **Roles**: `firm:lawyer`, `firm:staff`, `firm:viewer`
- **Metadata**: `{ "user_type": "firm_user", "firm_id": "{firmId}", "role": "lawyer|staff|viewer" }`

**Permission Matrix:**
```typescript
const FIRM_PERMISSIONS = {
  'firm:admin': {
    canManageUsers: true,
    canManageConflicts: true,
    canViewAnalytics: true,
    canManageBilling: true,
    canManageBranding: true,
    canViewConversations: true
  },
  'firm:lawyer': {
    canManageUsers: false,
    canManageConflicts: true,
    canViewAnalytics: true,
    canManageBilling: false,
    canManageBranding: false,
    canViewConversations: true
  },
  'firm:staff': {
    canManageUsers: false,
    canManageConflicts: true,
    canViewAnalytics: false,
    canManageBilling: false,
    canManageBranding: false,
    canViewConversations: true
  },
  'firm:viewer': {
    canManageUsers: false,
    canManageConflicts: false,
    canViewAnalytics: true,
    canManageBilling: false,
    canManageBranding: false,
    canViewConversations: true
  }
};
```

---

### 4. **End Users (Potential Clients)**
*People seeking legal help through Engage*

**Access Requirements:**
- **Conversation-Only Access**: Can only access their own conversations
- **Resume Capability**: Secure resume tokens for returning to conversations
- **Optional Authentication**: May complete intake anonymously or with Auth0 login

**Auth0 Configuration:**
- **Organization**: `clients` (shared organization for all potential clients)
- **Roles**: `client:user`
- **Metadata**: `{ "user_type": "client", "conversation_ids": ["session1", "session2"] }`

**Security Model:**
- **Pre-Login Phase**: Anonymous conversation with resume tokens
- **Post-Login Phase**: Auth0-secured conversation locked to user
- **Data Isolation**: Cannot access other users' conversations

## Auth0 Architecture Strategy

### **Multi-Organization Structure**

```
Auth0 Tenant: lexara-engage-platform
├── Organization: lexara-platform (Lexara employees)
├── Organization: firm-{firmId-1} (Law Firm 1)
├── Organization: firm-{firmId-2} (Law Firm 2)
├── Organization: firm-{firmId-N} (Law Firm N)
└── Organization: clients (All potential clients)
```

### **JWT Token Structure**

**Standard Claims:**
```json
{
  "sub": "auth0|user-id",
  "iss": "https://lexara.us.auth0.com/",
  "aud": ["engage-api", "admin-api"],
  "exp": 1640995200,
  "iat": 1640991600,
  "azp": "client-id"
}
```

**Custom Claims:**
```json
{
  "https://lexara.app/user_type": "firm_admin",
  "https://lexara.app/firm_id": "01HKXXX...",
  "https://lexara.app/firm_slug": "acme-law",
  "https://lexara.app/org_id": "org_firm_01HKXXX",
  "https://lexara.app/roles": ["firm:admin"],
  "https://lexara.app/permissions": [
    "manage:users",
    "manage:conflicts", 
    "view:analytics",
    "manage:billing"
  ]
}
```

### **Application Registration**

**Admin Console Application:**
- **Domain**: `admin.lexara.app`, `admin-dev.lexara.app`
- **Type**: Single Page Application (SPA)
- **Allowed URLs**: `https://admin*.lexara.app/*`
- **Scopes**: `openid profile email admin:read admin:write`

**Client Intake Application:**
- **Domain**: `*.lexara.app` (wildcard for subdomains)
- **Type**: Single Page Application (SPA) 
- **Allowed URLs**: `https://*.lexara.app/*`
- **Scopes**: `openid profile email client:read client:write`

**API Applications:**
- **Main API**: `api.lexara.app` - Conversation and client intake
- **Admin API**: `admin-api.lexara.app` - Firm management and analytics

## API Authorization Implementation

### **JWT Validation Middleware**

```typescript
interface AuthContext {
  userId: string;
  userType: 'lexara_admin' | 'firm_admin' | 'firm_user' | 'client';
  firmId?: string;
  roles: string[];
  permissions: string[];
  orgId: string;
}

async function validateJWT(request: Request): Promise<AuthContext | null> {
  const token = extractBearerToken(request);
  if (!token) return null;
  
  try {
    const decoded = await verifyJWT(token, env.AUTH0_DOMAIN);
    
    return {
      userId: decoded.sub,
      userType: decoded['https://lexara.app/user_type'],
      firmId: decoded['https://lexara.app/firm_id'],
      roles: decoded['https://lexara.app/roles'] || [],
      permissions: decoded['https://lexara.app/permissions'] || [],
      orgId: decoded['https://lexara.app/org_id']
    };
  } catch (error) {
    return null;
  }
}
```

### **Authorization Guards**

```typescript
// Firm-scoped authorization
function requireFirmAccess(requiredFirmId: string) {
  return (authContext: AuthContext) => {
    if (authContext.userType === 'lexara_admin') {
      return true; // Platform admins can access any firm
    }
    
    return authContext.firmId === requiredFirmId;
  };
}

// Permission-based authorization
function requirePermission(permission: string) {
  return (authContext: AuthContext) => {
    return authContext.permissions.includes(permission);
  };
}

// Role-based authorization
function requireRole(role: string) {
  return (authContext: AuthContext) => {
    return authContext.roles.includes(role);
  };
}
```

### **API Endpoint Security**

## Current Implementation Status ✅

### **Client Intake API Endpoints (IMPLEMENTED)**

| Endpoint | Method | Auth Required | Protection Level | Implementation Status |
|----------|---------|---------------|------------------|----------------------|
| `/` | GET | ❌ No | Public | ✅ **DEPLOYED** |
| `/api/v1/conversations` | POST | ❌ No | Public | ✅ **DEPLOYED** |
| `/api/v1/conversations/message` | POST | 🔒 **Conditional** | **Phase-Based** | ✅ **DEPLOYED** |
| `/health` | GET | ❌ No | Public | ✅ **DEPLOYED** |
| `/api/v1/version` | GET | ❌ No | Public | ✅ **DEPLOYED** |
| `/api/v1/test/*` | GET/POST | ❌ No | Public | ✅ **DEPLOYED** |

### **Conversation Message Endpoint - Phase-Based Security**

**The core conversation endpoint has conditional authentication:**

```typescript
POST /api/v1/conversations/message
```

**Security Behavior:**
- **Pre-login Phase (`pre_login`)**: 
  - ❌ **No Auth Required** - Anonymous access allowed
  - 🔑 Access Control: Resume token only
  - 📊 Data: Basic intake info, no PII

- **Secured Phase (`secured`)**:
  - ✅ **Auth0 JWT Required** - Must provide valid Bearer token
  - 🔒 Access Control: JWT validation + conversation ownership verification
  - 🛡️ Data: Full PII, sensitive legal information

**Implementation Logic:**
```typescript
// Validate JWT token (optional for conversations)
const authContext = await validateJWT(request, env);

// For secured conversations, validate access control
if (requestData.sessionId && authContext) {
  const hasAccess = await validateConversationAccess(requestData.sessionId, authContext, env);
  if (!hasAccess) {
    return 403 FORBIDDEN;
  }
}
```

### **Admin API Endpoints (PLANNED - NOT YET IMPLEMENTED)**

| Endpoint | Method | Auth Required | Roles/Permissions | Implementation Status |
|----------|---------|---------------|-------------------|----------------------|
| `/admin/api/v1/firms` | GET | ✅ Yes | `platform:admin` | 🚧 **PLANNED** |
| `/admin/api/v1/firms/{firmId}` | GET | ✅ Yes | Firm access + `view:analytics` | 🚧 **PLANNED** |
| `/admin/api/v1/firms/{firmId}/users` | POST | ✅ Yes | Firm access + `manage:users` | 🚧 **PLANNED** |
| `/admin/api/v1/conversations` | GET | ✅ Yes | Firm access + `view:conversations` | 🚧 **PLANNED** |

**Admin Endpoint Security (Future Implementation):**
```typescript
// Example: GET /admin/api/v1/firms/{firmId} - Get firm details
app.get('/admin/api/v1/firms/:firmId', [
  validateJWT,                    // Require valid Auth0 JWT
  requireFirmAccess(params.firmId), // Must belong to firm or be platform admin
  requirePermission('view:analytics') // Must have analytics permission
], handleGetFirm);
```

## Conversation Security Model

### **Anonymous Conversations**
- **Phase**: `pre_login`
- **Authentication**: None required
- **Access Control**: Resume token only
- **Data Sensitivity**: Basic intake info, no PII
- **Transition**: Suggest Auth0 login when goals met

### **Authenticated Conversations**
- **Phase**: `secured`
- **Authentication**: Auth0 JWT required
- **Access Control**: JWT validation + conversation ownership
- **Data Sensitivity**: Full PII, sensitive legal information
- **Permanence**: Once secured, cannot revert to anonymous

### **Security Transition**
```typescript
interface ConversationSecurity {
  phase: 'pre_login' | 'secured';
  isAuthenticated: boolean;
  allowedAuth0Users: string[]; // Empty until secured
  
  // Security transition
  transitionToSecured(auth0UserId: string): void {
    this.phase = 'secured';
    this.isAuthenticated = true;
    this.allowedAuth0Users = [auth0UserId];
    // Cannot be reversed
  }
}
```

## Implementation Roadmap

### **Phase 1: Core Auth Infrastructure** (2-3 weeks)
- [ ] Auth0 tenant setup with multi-organization structure
- [ ] JWT validation middleware implementation
- [ ] Basic role and permission system
- [ ] API authorization guards

### **Phase 2: Admin Authentication** (1-2 weeks)
- [ ] Admin console Auth0 integration
- [ ] Firm admin user management
- [ ] Platform admin super-user functionality
- [ ] Audit logging system

### **Phase 3: Client Authentication** (1-2 weeks)  
- [ ] Optional Auth0 login for conversations
- [ ] Secure conversation transition
- [ ] Resume token security enhancement
- [ ] Cross-device conversation access

### **Phase 4: Advanced Security** (2-3 weeks)
- [ ] Multi-factor authentication
- [ ] Session management and timeout
- [ ] IP restrictions for admin users
- [ ] Advanced audit logging and monitoring

## Security Compliance

### **Data Protection**
- **HIPAA Compliance**: Encrypted conversations, access controls, audit logs
- **GDPR/CCPA**: Data deletion, export, and user consent management
- **SOC 2**: Access controls, monitoring, incident response

### **Access Controls**
- **Principle of Least Privilege**: Users get minimum required permissions
- **Data Isolation**: Firm data completely separated
- **Audit Trail**: All access logged and monitored
- **Regular Reviews**: Periodic access and permission audits

### **Monitoring & Alerting**
- **Failed Authentication**: Multiple failed login attempts
- **Cross-Firm Access**: Any attempt to access other firm's data
- **Privilege Escalation**: Users requesting elevated permissions
- **Data Export**: Large data downloads or exports

---

This architecture provides a robust foundation for secure, multi-tenant operation while maintaining the flexibility to add advanced features as the platform grows.