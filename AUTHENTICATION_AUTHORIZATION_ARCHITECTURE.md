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

### **Phase 1: Core Auth Infrastructure** ✅ **COMPLETED**
- [x] Auth0 tenant setup with multi-organization structure
- [x] JWT validation middleware implementation
- [x] Basic role and permission system
- [x] API authorization guards

### **Phase 2A: Platform Admin Portal** 🎯 **IMMEDIATE PRIORITY**
- [x] Admin console Auth0 integration (JWT validation)
- [ ] **Platform Admin Portal** - `platform.lexara.app` for Lexara employees
- [ ] **Firm Management Dashboard** - View, create, suspend law firms
- [ ] **Customer Support Tools** - Account levels, billing, authorized users
- [ ] **System Analytics** - Platform health and usage metrics
- [ ] **Audit Logging System** - All platform actions logged for compliance

### **Phase 2B: Firm Admin Portal** 🚧 **SECONDARY PRIORITY**  
- [ ] **Firm Admin Portal** - `admin.lexara.app` for law firm users
- [ ] **MVP Firm Signup Flow** - Self-service firm registration
- [ ] **Firm Dashboard** - Protected page for firm management
- [ ] Firm user management and team invitations
- [ ] Firm settings and branding customization

### **Phase 3: Client Authentication** (1-2 weeks)  
- [x] Optional Auth0 login for conversations
- [ ] Secure conversation transition (enhanced)
- [ ] Resume token security enhancement
- [ ] Cross-device conversation access

### **Phase 4: Advanced Security** (2-3 weeks)
- [ ] Multi-factor authentication
- [ ] Session management and timeout
- [ ] IP restrictions for admin users
- [ ] Advanced audit logging and monitoring

---

## 🏢 **Platform Admin Portal Architecture** (Immediate Priority)

### **Separate Portal Strategy**
- **Platform Portal**: `platform.lexara.app` (Lexara employees only)
- **Firm Portal**: `admin.lexara.app` (Law firm users only)  
- **Client Intake**: `{slug}.lexara.app` (Potential clients)
- **Data Isolation**: Complete separation of platform vs firm admin functionality

### **Platform Admin Portal (`platform.lexara.app`)**

#### **Target Users: Lexara Employees**
- **Platform Administrators**: Full system access and firm management
- **Customer Support**: Firm account support without client data access
- **Billing Team**: Subscription and payment management
- **Technical Support**: System health monitoring and troubleshooting

#### **Platform Admin Data Access Model**

**✅ ALLOWED ACCESS (Customer Support)**
```typescript
interface PlatformAdminAccess {
  // Firm Management
  firms: {
    firmId: string;
    name: string;
    slug: string;
    contactEmail: string;
    contactPhone?: string;
    website?: string;
    practiceAreas: string[];
    createdAt: Date;
    lastActive: Date;
    isActive: boolean;
  }[];
  
  // Account & Subscription
  subscription: {
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    trialEndsAt?: Date;
    monthlyConversationLimit: number;
    currentUsage: number;
    billingCycle: string;
  };
  
  // Authorized Users (for support)
  authorizedUsers: {
    auth0UserId: string;
    email: string;
    name: string;
    role: FirmRole;
    lastLogin?: Date;
    isActive: boolean;
  }[];
  
  // Billing & Payments
  billing: {
    stripeCustomerId?: string;
    paymentMethod?: string;
    invoiceHistory: Invoice[];
    paymentHistory: Payment[];
    currentBalance: number;
  };
  
  // Usage Analytics (Anonymized)
  analytics: {
    totalConversations: number;
    monthlyConversations: number;
    avgResponseTime: number;
    systemUptime: number;
    // No client-specific data
  };
}
```

**❌ FORBIDDEN ACCESS (Client Data Protection)**
```typescript
interface ForbiddenAccess {
  // Client Conversations - NEVER accessible
  conversations?: never;
  messages?: never;
  clientPII?: never;
  
  // Firm Internal Data - Not for platform admins
  conflictDatabase?: never;
  supportingDocuments?: never;
  firmInternalSettings?: never;
  
  // Legal Content - Firm-specific only
  legalGuidance?: never;
  caseTemplates?: never;
  practiceSpecificData?: never;
}
```

#### **Platform Admin Dashboard Features**

**1. Firm Management Overview**
```html
<div class="platform-dashboard">
  <header class="platform-header">
    <h1>Lexara Platform Administration</h1>
    <p>Manage law firm customers and platform operations</p>
  </header>
  
  <div class="metrics-grid">
    <div class="metric-card">
      <h3>Active Law Firms</h3>
      <span class="metric-number">{{totalActiveFirms}}</span>
      <span class="metric-trend">+{{newFirmsThisMonth}} this month</span>
    </div>
    
    <div class="metric-card">
      <h3>Platform Conversations</h3>
      <span class="metric-number">{{totalConversations}}</span>
      <span class="metric-trend">{{conversationGrowth}}% growth</span>
    </div>
    
    <div class="metric-card">
      <h3>System Health</h3>
      <span class="metric-number">{{systemUptime}}%</span>
      <span class="metric-status healthy">All Systems Operational</span>
    </div>
  </div>
  
  <div class="firm-management-section">
    <h2>Firm Management</h2>
    <div class="firm-actions">
      <button class="btn-primary">Create New Firm</button>
      <button class="btn-secondary">Import Firms</button>
      <input type="search" placeholder="Search firms...">
    </div>
    
    <table class="firms-table">
      <thead>
        <tr>
          <th>Firm Name</th>
          <th>Subdomain</th>
          <th>Subscription</th>
          <th>Usage</th>
          <th>Last Active</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {{#each firms}}
        <tr>
          <td>
            <div class="firm-info">
              <strong>{{name}}</strong>
              <small>{{contactEmail}}</small>
            </div>
          </td>
          <td>
            <code>{{slug}}.lexara.app</code>
          </td>
          <td>
            <span class="subscription-badge {{subscription.status}}">
              {{subscription.tier}}
            </span>
          </td>
          <td>
            <div class="usage-bar">
              <div class="usage-fill" style="width: {{usagePercent}}%"></div>
              <span>{{currentUsage}}/{{limit}}</span>
            </div>
          </td>
          <td>{{formatDate lastActive}}</td>
          <td>
            <button onclick="viewFirm('{{firmId}}')">View</button>
            <button onclick="supportFirm('{{firmId}}')">Support</button>
          </td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
</div>
```

**2. Firm Detail View (Support Interface)**
```html
<div class="firm-detail-view">
  <header class="firm-header">
    <h1>{{firm.name}}</h1>
    <div class="firm-status">
      <span class="status-badge {{firm.subscription.status}}">
        {{firm.subscription.tier}}
      </span>
      <span class="activity-indicator {{firm.isActive ? 'active' : 'inactive'}}">
        {{firm.isActive ? 'Active' : 'Inactive'}}
      </span>
    </div>
  </header>
  
  <div class="support-sections">
    <!-- Account Information -->
    <section class="account-info">
      <h3>Account Information</h3>
      <div class="info-grid">
        <div class="info-item">
          <label>Firm Name</label>
          <span>{{firm.name}}</span>
        </div>
        <div class="info-item">
          <label>Intake URL</label>
          <span>https://{{firm.slug}}.lexara.app</span>
        </div>
        <div class="info-item">
          <label>Contact Email</label>
          <span>{{firm.contactEmail}}</span>
        </div>
        <div class="info-item">
          <label>Practice Areas</label>
          <span>{{join firm.practiceAreas ", "}}</span>
        </div>
        <div class="info-item">
          <label>Created</label>
          <span>{{formatDate firm.createdAt}}</span>
        </div>
        <div class="info-item">
          <label>Last Active</label>
          <span>{{formatDate firm.lastActive}}</span>
        </div>
      </div>
    </section>
    
    <!-- Authorized Users -->
    <section class="authorized-users">
      <h3>Authorized Users</h3>
      <table class="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Last Login</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {{#each authorizedUsers}}
          <tr>
            <td>{{name}}</td>
            <td>{{email}}</td>
            <td>
              <span class="role-badge {{role}}">{{role}}</span>
            </td>
            <td>{{formatDate lastLogin}}</td>
            <td>
              <span class="status-indicator {{isActive ? 'active' : 'inactive'}}">
                {{isActive ? 'Active' : 'Inactive'}}
              </span>
            </td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </section>
    
    <!-- Subscription & Billing -->
    <section class="billing-info">
      <h3>Subscription & Billing</h3>
      <div class="billing-grid">
        <div class="billing-card">
          <h4>Current Plan</h4>
          <div class="plan-info">
            <span class="plan-name">{{subscription.tier}}</span>
            <span class="plan-status">{{subscription.status}}</span>
          </div>
          <div class="plan-limits">
            <p>{{subscription.monthlyConversationLimit}} conversations/month</p>
            <p>Current usage: {{subscription.currentUsage}}</p>
          </div>
        </div>
        
        <div class="billing-card">
          <h4>Payment Information</h4>
          <p>Stripe Customer: {{billing.stripeCustomerId}}</p>
          <p>Payment Method: {{billing.paymentMethod}}</p>
          <p>Current Balance: ${{billing.currentBalance}}</p>
        </div>
      </div>
      
      <!-- Recent Invoices -->
      <div class="invoice-history">
        <h4>Recent Invoices</h4>
        <table class="invoices-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {{#each billing.invoiceHistory}}
            <tr>
              <td>{{invoiceNumber}}</td>
              <td>{{formatDate date}}</td>
              <td>${{amount}}</td>
              <td>
                <span class="payment-status {{status}}">{{status}}</span>
              </td>
              <td>
                <button onclick="viewInvoice('{{id}}')">View</button>
              </td>
            </tr>
            {{/each}}
          </tbody>
        </table>
      </div>
    </section>
    
    <!-- Usage Analytics (Anonymized) -->
    <section class="usage-analytics">
      <h3>Usage Analytics</h3>
      <div class="analytics-grid">
        <div class="analytics-card">
          <h4>Conversations</h4>
          <div class="metric-large">{{analytics.totalConversations}}</div>
          <p>Total conversations processed</p>
        </div>
        
        <div class="analytics-card">
          <h4>Monthly Activity</h4>
          <div class="metric-large">{{analytics.monthlyConversations}}</div>
          <p>Conversations this month</p>
        </div>
        
        <div class="analytics-card">
          <h4>Response Time</h4>
          <div class="metric-large">{{analytics.avgResponseTime}}s</div>
          <p>Average AI response time</p>
        </div>
      </div>
      
      <!-- Usage Chart (No Client Data) -->
      <div class="usage-chart">
        <canvas id="usageChart" data-usage="{{analyticsData}}"></canvas>
      </div>
    </section>
    
    <!-- Support Actions -->
    <section class="support-actions">
      <h3>Support Actions</h3>
      <div class="action-buttons">
        <button class="btn-primary">Reset User Password</button>
        <button class="btn-secondary">Suspend Account</button>
        <button class="btn-secondary">Upgrade Subscription</button>
        <button class="btn-warning">Extend Trial</button>
      </div>
      
      <!-- Support Log -->
      <div class="support-log">
        <h4>Support History</h4>
        <div class="log-entries">
          {{#each supportHistory}}
          <div class="log-entry">
            <div class="log-header">
              <span class="log-action">{{action}}</span>
              <span class="log-date">{{formatDate timestamp}}</span>
              <span class="log-user">by {{performedBy}}</span>
            </div>
            <div class="log-details">{{details}}</div>
          </div>
          {{/each}}
        </div>
      </div>
    </section>
  </div>
</div>
```

#### **Audit Logging Requirements**

**All Platform Admin Actions Must Be Logged:**
```typescript
interface PlatformAuditLog {
  logId: string;                    // Unique log entry ID
  timestamp: Date;                  // When action occurred
  platformUserId: string;           // Which Lexara employee
  platformUserEmail: string;       // Employee email for reference
  action: PlatformAction;           // What action was performed
  targetFirmId?: string;            // Which firm was affected
  targetUserId?: string;            // Which user was affected
  details: Record<string, any>;     // Action-specific details
  ipAddress: string;                // Source IP for security
  userAgent: string;                // Browser/client info
  result: 'success' | 'failure';    // Action outcome
  errorMessage?: string;            // If action failed
}

type PlatformAction = 
  | 'firm_created'
  | 'firm_suspended'
  | 'firm_reactivated'
  | 'firm_deleted'
  | 'firm_viewed'
  | 'user_password_reset'
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'trial_extended'
  | 'invoice_viewed'
  | 'support_ticket_created'
  | 'analytics_accessed'
  | 'system_settings_changed';

// Example audit log entries
const auditExamples = [
  {
    logId: "01HXXX...",
    timestamp: new Date(),
    platformUserId: "auth0|platform_admin_123",
    platformUserEmail: "sarah@lexara.com",
    action: "firm_viewed",
    targetFirmId: "01HYYY...",
    details: {
      firmName: "Smith & Associates",
      viewedSections: ["account_info", "billing", "users"]
    },
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0...",
    result: "success"
  },
  {
    logId: "01HZZZ...",
    timestamp: new Date(),
    platformUserId: "auth0|support_staff_456", 
    platformUserEmail: "john@lexara.com",
    action: "user_password_reset",
    targetFirmId: "01HYYY...",
    targetUserId: "auth0|firm_user_789",
    details: {
      userEmail: "admin@smithlaw.com",
      resetMethod: "auth0_management_api"
    },
    ipAddress: "192.168.1.101",
    userAgent: "Mozilla/5.0...",
    result: "success"
  }
];
```

#### **Platform Admin Authentication**

**Separate Auth0 Organization for Lexara Employees:**
```typescript
// Platform admin login flow
async function handlePlatformLogin(request: Request, env: Env) {
  const auth0Config = getAuth0Config(env);
  
  const authUrl = `https://${auth0Config.domain}/authorize?` + new URLSearchParams({
    response_type: 'code',
    client_id: auth0Config.platformClientId,  // Different client ID
    redirect_uri: 'https://platform.lexara.app/callback',
    scope: 'openid profile email',
    audience: auth0Config.audience,
    organization: 'lexara-platform',  // Platform org only
    state: generateSecureState()
  });
  
  return Response.redirect(authUrl);
}

// Platform admin authorization check
function requirePlatformAdmin(authContext: AuthContext): void {
  // Must be Lexara employee
  if (!authContext.userType.startsWith('lexara_')) {
    throw new Error('Platform admin access required');
  }
  
  // Must belong to platform organization
  if (authContext.orgId !== 'lexara-platform') {
    throw new Error('Invalid organization for platform access');
  }
  
  // Log access attempt
  auditLog.record({
    action: 'platform_access_attempt',
    platformUserId: authContext.userId,
    result: 'success'
  });
}
```

---

## 🎯 **MVP Firm Admin Portal Architecture** (Secondary Priority)

### **Phase 2A: Simple Self-Signup Flow** (Next Implementation)

#### **Architecture Decision: Separate Admin Worker**
- **Admin Domain**: `admin.lexara.app` (separate from client intake)
- **Implementation**: New Cloudflare Worker (`src/admin/admin-worker.ts`)
- **UI Framework**: Server-side rendered HTML with embedded forms
- **Data Storage**: FirmRegistry Durable Object + Auth0 user creation

#### **Signup Flow (`admin.lexara.app/signup`)**

**Step 1: Registration Form**
```html
<!-- Self-service firm registration -->
<form action="/signup" method="POST">
  <h2>Create Your Law Firm Account</h2>
  
  <!-- Firm Information -->
  <input name="firmName" placeholder="Smith & Associates Law" required>
  <input name="subdomain" placeholder="smith-associates" required>
  <select name="practiceArea">
    <option>Personal Injury</option>
    <option>Employment Law</option>
    <option>Corporate Law</option>
  </select>
  
  <!-- Admin User -->
  <input name="adminName" placeholder="John Smith" required>
  <input name="adminEmail" placeholder="john@smithlaw.com" required>
  <input name="phone" placeholder="+1 (555) 123-4567">
  
  <!-- Legal -->
  <label>
    <input type="checkbox" required>
    I agree to Terms of Service and Privacy Policy
  </label>
  
  <button type="submit">Create Account</button>
</form>
```

**Step 2: Server Processing**
```typescript
// POST /signup handler
async function handleSignup(request: Request, env: Env) {
  const formData = await request.formData();
  
  // 1. Validate input data
  const validation = validateSignupData(formData);
  if (!validation.valid) return showErrors(validation.errors);
  
  // 2. Check subdomain availability
  const subdomainAvailable = await checkSubdomainAvailability(formData.get('subdomain'));
  if (!subdomainAvailable) return showError('Subdomain already taken');
  
  // 3. Create Auth0 user (simplified - single organization for MVP)
  const auth0User = await createAuth0User({
    email: formData.get('adminEmail'),
    password: generateTempPassword(),
    userType: 'firm_admin'
  });
  
  // 4. Create firm in FirmRegistry
  const firmId = await createFirmRecord({
    name: formData.get('firmName'),
    slug: formData.get('subdomain'),
    adminAuth0UserId: auth0User.user_id,
    practiceAreas: [formData.get('practiceArea')]
  });
  
  // 5. Send welcome email with Auth0 password reset
  await sendWelcomeEmail(auth0User.email, firmId);
  
  // 6. Redirect to success page
  return Response.redirect('/signup/success');
}
```

**Step 3: Welcome & First Login**
- User receives email with Auth0 password setup link
- Redirects to `admin.lexara.app/login` after password creation
- First login redirects to onboarding dashboard

#### **Login Flow (`admin.lexara.app/login`)**

**Auth0 Integration**
```typescript
// GET /login - Redirect to Auth0
async function handleLogin(request: Request, env: Env) {
  const auth0Config = getAuth0Config(env);
  const state = generateSecureState();
  
  const authUrl = `https://${auth0Config.domain}/authorize?` + new URLSearchParams({
    response_type: 'code',
    client_id: auth0Config.adminClientId,
    redirect_uri: 'https://admin.lexara.app/callback',
    scope: 'openid profile email',
    audience: auth0Config.audience,
    state
  });
  
  return Response.redirect(authUrl);
}

// GET /callback - Handle Auth0 callback
async function handleCallback(request: Request, env: Env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  // Validate state and exchange code for tokens
  const tokens = await exchangeAuthCodeForTokens(code, env);
  const userInfo = await validateJWT(tokens.id_token, env);
  
  // Set secure session cookie
  const sessionCookie = await createSecureSession(userInfo);
  
  return new Response('', {
    status: 302,
    headers: {
      'Location': '/dashboard',
      'Set-Cookie': `session=${sessionCookie}; HttpOnly; Secure; SameSite=Strict; Path=/`
    }
  });
}
```

#### **Protected Dashboard (`admin.lexara.app/dashboard`)**

**Authentication Middleware**
```typescript
// Dashboard route protection
async function requireAuth(request: Request, env: Env): Promise<AuthContext | Response> {
  const sessionCookie = getCookie(request, 'session');
  if (!sessionCookie) {
    return Response.redirect('/login');
  }
  
  const authContext = await validateSession(sessionCookie, env);
  if (!authContext) {
    return Response.redirect('/login');
  }
  
  return authContext;
}

// GET /dashboard
async function handleDashboard(request: Request, env: Env) {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult; // Redirect to login
  
  const authContext = authResult as AuthContext;
  
  // Get firm data
  const firm = await getFirmByAuth0UserId(authContext.userId, env);
  
  return renderDashboard({
    user: authContext,
    firm,
    features: {
      conversations: 'coming_soon',
      conflicts: 'coming_soon',
      analytics: 'coming_soon',
      settings: 'basic'
    }
  });
}
```

#### **MVP Dashboard Features**

**Initial Dashboard Content**
```html
<div class="admin-dashboard">
  <header>
    <h1>Welcome, {{firm.name}}</h1>
    <p>Manage your legal client intake system</p>
  </header>
  
  <div class="quick-stats">
    <div class="stat-card">
      <h3>Client Intake URL</h3>
      <code>https://{{firm.slug}}.lexara.app</code>
      <button onclick="copyToClipboard()">Copy Link</button>
    </div>
    
    <div class="stat-card">
      <h3>Conversations This Month</h3>
      <span class="number">{{stats.conversations}}</span>
    </div>
  </div>
  
  <div class="feature-grid">
    <div class="feature-card coming-soon">
      <h4>Client Conversations</h4>
      <p>View and manage client intake conversations</p>
      <span class="badge">Coming Soon</span>
    </div>
    
    <div class="feature-card coming-soon">
      <h4>Conflict Management</h4>
      <p>Manage your conflict of interest database</p>
      <span class="badge">Coming Soon</span>
    </div>
    
    <div class="feature-card available">
      <h4>Firm Settings</h4>
      <p>Update firm information and branding</p>
      <a href="/settings">Configure</a>
    </div>
  </div>
</div>
```

### **MVP Limitations & Future Enhancements**

#### **MVP Simplifications**
- **Single Auth0 Organization**: All firms in one org initially (vs per-firm orgs)
- **Basic Validation**: Email format + subdomain availability only
- **No Domain Verification**: Skip email domain verification for MVP
- **Temporary Passwords**: Auth0 generates, user resets on first login
- **Limited Customization**: Basic firm settings only

#### **Post-MVP Enhancements**
- **Multi-Organization Setup**: Migrate to per-firm Auth0 organizations
- **Enhanced Validation**: Business verification, phone confirmation
- **Custom Domains**: `intake.smithlaw.com` support
- **Team Management**: Invite additional firm users
- **Advanced Security**: MFA, IP restrictions, audit logs

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