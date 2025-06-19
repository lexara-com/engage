# Platform Admin Specification - Lexara Employee Portal

## 🏢 **Platform Admin Portal Overview**

**Domain**: `platform.lexara.app`  
**Target Users**: Lexara employees (platform administrators, support staff, billing team)  
**Implementation**: Separate Cloudflare Worker  
**Architecture**: Server-side rendered HTML with strict data access controls  
**Priority**: **IMMEDIATE** - Build before firm admin portal

---

## 🎯 **Core Functional Requirements**

### **Platform Administration Capabilities**
1. **Firm Management** - View, create, suspend, and support law firm accounts
2. **Customer Support** - Access firm metadata and billing for support purposes
3. **System Analytics** - Platform health, usage metrics, and business intelligence
4. **Audit Compliance** - Complete logging of all platform admin actions
5. **Billing Oversight** - Subscription management and payment monitoring

### **Strict Data Access Policy**
- ✅ **CAN ACCESS**: Firm metadata, billing data, system analytics
- ❌ **CANNOT ACCESS**: Client conversations, PII, conflict databases, legal content

---

## 🔐 **Data Access Control Model**

### **Lexara Employee Access Matrix**

| Data Type | Platform Admin | Customer Support | Billing Team | Access Level |
|-----------|---------------|------------------|--------------|--------------|
| **Firm Metadata** | ✅ Full | ✅ Full | ✅ Read Only | Account info, contact details |
| **Subscription Data** | ✅ Full | ✅ Read Only | ✅ Full | Plans, limits, usage stats |
| **Billing & Payments** | ✅ Full | ✅ Read Only | ✅ Full | Invoices, payments, Stripe data |
| **Authorized Users** | ✅ Full | ✅ Read Only | ❌ None | Firm user accounts for support |
| **System Analytics** | ✅ Full | ✅ Limited | ✅ Limited | Platform health, anonymized metrics |
| **Audit Logs** | ✅ Full | ✅ Own Actions | ✅ Own Actions | Platform admin activity logs |
| **Client Conversations** | ❌ **NEVER** | ❌ **NEVER** | ❌ **NEVER** | **FORBIDDEN** |
| **Client PII** | ❌ **NEVER** | ❌ **NEVER** | ❌ **NEVER** | **FORBIDDEN** |
| **Conflict Data** | ❌ **NEVER** | ❌ **NEVER** | ❌ **NEVER** | **FORBIDDEN** |

### **Technical Access Control Implementation**

```typescript
// Compile-time data access restrictions
interface PlatformAdminData {
  // ALLOWED: Firm business data
  firms: FirmMetadata[];
  subscriptions: SubscriptionData[];
  billing: BillingData[];
  authorizedUsers: UserMetadata[];
  systemMetrics: AnonymizedAnalytics;
  auditLogs: PlatformAuditLog[];
  
  // FORBIDDEN: Client and legal data (never accessible)
  conversations?: never;
  clientPII?: never;
  conflictDatabases?: never;
  supportingDocuments?: never;
  legalContent?: never;
}

// Runtime access validation
function validatePlatformAccess(requestedData: any, userContext: AuthContext): void {
  // Verify Lexara employee status
  if (!userContext.userType.startsWith('lexara_')) {
    throw new Error('Platform access denied: Not a Lexara employee');
  }
  
  // Block any client data access attempts
  if (hasClientDataProperties(requestedData)) {
    auditLog.record({
      action: 'unauthorized_access_attempt',
      userId: userContext.userId,
      attemptedData: Object.keys(requestedData),
      result: 'blocked',
      severity: 'critical'
    });
    throw new Error('Client data access forbidden for platform admins');
  }
}
```

---

## 🖥️ **User Interface Specifications**

### **Main Dashboard (`/dashboard`)**

#### **Platform Metrics Overview**
```html
<div class="platform-dashboard">
  <!-- Header -->
  <header class="platform-header">
    <div class="lexara-branding">
      <img src="/lexara-logo.svg" alt="Lexara">
      <h1>Platform Administration</h1>
    </div>
    <div class="user-info">
      <span class="user-name">{{user.name}}</span>
      <span class="user-role">{{user.role}}</span>
      <button class="logout-btn">Logout</button>
    </div>
  </header>

  <!-- Key Metrics Grid -->
  <section class="metrics-overview">
    <div class="metric-card primary">
      <div class="metric-icon">🏢</div>
      <div class="metric-content">
        <h3>Active Law Firms</h3>
        <div class="metric-value">{{metrics.activeFirms}}</div>
        <div class="metric-trend">
          <span class="trend-indicator {{metrics.firmGrowth.direction}}">
            {{metrics.firmGrowth.percentage}}%
          </span>
          <span>vs last month</span>
        </div>
      </div>
    </div>
    
    <div class="metric-card">
      <div class="metric-icon">💬</div>
      <div class="metric-content">
        <h3>Platform Conversations</h3>
        <div class="metric-value">{{metrics.totalConversations}}</div>
        <div class="metric-subtitle">{{metrics.monthlyConversations}} this month</div>
      </div>
    </div>
    
    <div class="metric-card">
      <div class="metric-icon">💰</div>
      <div class="metric-content">
        <h3>Monthly Revenue</h3>
        <div class="metric-value">${{metrics.monthlyRevenue}}</div>
        <div class="metric-trend">
          <span class="trend-indicator {{metrics.revenueGrowth.direction}}">
            {{metrics.revenueGrowth.percentage}}%
          </span>
          <span>vs last month</span>
        </div>
      </div>
    </div>
    
    <div class="metric-card">
      <div class="metric-icon">⚡</div>
      <div class="metric-content">
        <h3>System Health</h3>
        <div class="metric-value">{{metrics.systemUptime}}%</div>
        <div class="metric-status {{metrics.systemStatus.class}}">
          {{metrics.systemStatus.message}}
        </div>
      </div>
    </div>
  </section>

  <!-- Quick Actions -->
  <section class="quick-actions">
    <h2>Quick Actions</h2>
    <div class="action-grid">
      <button class="action-btn primary" onclick="createFirm()">
        <span class="action-icon">➕</span>
        <span class="action-text">Create New Firm</span>
      </button>
      <button class="action-btn" onclick="viewReports()">
        <span class="action-icon">📊</span>
        <span class="action-text">View Reports</span>
      </button>
      <button class="action-btn" onclick="systemHealth()">
        <span class="action-icon">🔧</span>
        <span class="action-text">System Health</span>
      </button>
      <button class="action-btn" onclick="supportQueue()">
        <span class="action-icon">🎫</span>
        <span class="action-text">Support Queue</span>
      </button>
    </div>
  </section>

  <!-- Recent Activity Feed -->
  <section class="activity-feed">
    <h2>Recent Activity</h2>
    <div class="activity-list">
      {{#each recentActivity}}
      <div class="activity-item">
        <div class="activity-icon {{type}}">{{icon}}</div>
        <div class="activity-content">
          <div class="activity-title">{{title}}</div>
          <div class="activity-details">{{details}}</div>
          <div class="activity-meta">
            <span class="activity-time">{{formatTimeAgo timestamp}}</span>
            <span class="activity-user">by {{performedBy}}</span>
          </div>
        </div>
      </div>
      {{/each}}
    </div>
  </section>
</div>
```

### **Firm Management Interface (`/firms`)**

#### **Firm List View**
```html
<div class="firm-management">
  <header class="page-header">
    <h1>Firm Management</h1>
    <div class="header-actions">
      <button class="btn-primary" onclick="createFirm()">
        Create New Firm
      </button>
      <button class="btn-secondary" onclick="exportFirms()">
        Export Data
      </button>
    </div>
  </header>

  <!-- Filters and Search -->
  <div class="firm-filters">
    <div class="filter-group">
      <input type="search" 
             placeholder="Search firms by name, email, or subdomain..." 
             class="search-input"
             onInput="filterFirms(this.value)">
    </div>
    
    <div class="filter-group">
      <select class="filter-select" onchange="filterByStatus(this.value)">
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="trial">Trial</option>
        <option value="suspended">Suspended</option>
        <option value="cancelled">Cancelled</option>
      </select>
      
      <select class="filter-select" onchange="filterByTier(this.value)">
        <option value="">All Plans</option>
        <option value="starter">Starter</option>
        <option value="professional">Professional</option>
        <option value="enterprise">Enterprise</option>
      </select>
    </div>
  </div>

  <!-- Firms Table -->
  <div class="firms-table-container">
    <table class="firms-table">
      <thead>
        <tr>
          <th class="sortable" onclick="sortBy('name')">
            Firm Name <span class="sort-icon">↕️</span>
          </th>
          <th class="sortable" onclick="sortBy('subdomain')">
            Subdomain <span class="sort-icon">↕️</span>
          </th>
          <th class="sortable" onclick="sortBy('subscription.tier')">
            Plan <span class="sort-icon">↕️</span>
          </th>
          <th class="sortable" onclick="sortBy('subscription.status')">
            Status <span class="sort-icon">↕️</span>
          </th>
          <th class="sortable" onclick="sortBy('analytics.monthlyConversations')">
            Usage <span class="sort-icon">↕️</span>
          </th>
          <th class="sortable" onclick="sortBy('lastActive')">
            Last Active <span class="sort-icon">↕️</span>
          </th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {{#each firms}}
        <tr class="firm-row" data-firm-id="{{firmId}}">
          <td class="firm-name-cell">
            <div class="firm-info">
              <strong class="firm-name">{{name}}</strong>
              <div class="firm-contact">{{contactEmail}}</div>
              <div class="firm-practice-areas">
                {{#each practiceAreas}}
                <span class="practice-badge">{{this}}</span>
                {{/each}}
              </div>
            </div>
          </td>
          
          <td class="subdomain-cell">
            <code class="subdomain">{{slug}}.lexara.app</code>
            <button class="copy-btn" onclick="copyToClipboard('https://{{slug}}.lexara.app')">
              📋
            </button>
          </td>
          
          <td class="plan-cell">
            <span class="plan-badge {{subscription.tier}}">
              {{titleCase subscription.tier}}
            </span>
            {{#if subscription.trialEndsAt}}
            <div class="trial-info">
              Trial ends {{formatDate subscription.trialEndsAt}}
            </div>
            {{/if}}
          </td>
          
          <td class="status-cell">
            <span class="status-badge {{subscription.status}}">
              {{titleCase subscription.status}}
            </span>
          </td>
          
          <td class="usage-cell">
            <div class="usage-info">
              <div class="usage-numbers">
                {{subscription.currentUsage}} / {{subscription.monthlyConversationLimit}}
              </div>
              <div class="usage-bar">
                <div class="usage-fill" 
                     style="width: {{calculatePercentage subscription.currentUsage subscription.monthlyConversationLimit}}%">
                </div>
              </div>
              {{#if (isOverLimit subscription.currentUsage subscription.monthlyConversationLimit)}}
              <div class="usage-warning">Over limit</div>
              {{/if}}
            </div>
          </td>
          
          <td class="last-active-cell">
            <div class="activity-info">
              <div class="activity-date">{{formatDate lastActive}}</div>
              <div class="activity-indicator {{getActivityStatus lastActive}}">
                {{getActivityLabel lastActive}}
              </div>
            </div>
          </td>
          
          <td class="actions-cell">
            <div class="action-buttons">
              <button class="btn-sm btn-primary" 
                      onclick="viewFirm('{{firmId}}')">
                View
              </button>
              <div class="dropdown">
                <button class="btn-sm btn-secondary dropdown-toggle">
                  More ▼
                </button>
                <div class="dropdown-menu">
                  <button onclick="supportFirm('{{firmId}}')">Support</button>
                  <button onclick="upgradeFirm('{{firmId}}')">Upgrade</button>
                  <button onclick="suspendFirm('{{firmId}}')">Suspend</button>
                  <button onclick="viewAuditLog('{{firmId}}')">Audit Log</button>
                </div>
              </div>
            </div>
          </td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  <div class="pagination">
    <button class="pagination-btn" onclick="previousPage()" {{#unless hasPreviousPage}}disabled{{/unless}}>
      ← Previous
    </button>
    <span class="pagination-info">
      Page {{currentPage}} of {{totalPages}} ({{totalFirms}} firms)
    </span>
    <button class="pagination-btn" onclick="nextPage()" {{#unless hasNextPage}}disabled{{/unless}}>
      Next →
    </button>
  </div>
</div>
```

### **Firm Detail View (`/firms/{firmId}`)**

#### **Comprehensive Support Interface**
```html
<div class="firm-detail-view">
  <!-- Firm Header -->
  <header class="firm-header">
    <div class="firm-title">
      <h1>{{firm.name}}</h1>
      <div class="firm-badges">
        <span class="status-badge {{firm.subscription.status}}">
          {{titleCase firm.subscription.status}}
        </span>
        <span class="plan-badge {{firm.subscription.tier}}">
          {{titleCase firm.subscription.tier}}
        </span>
        {{#if firm.subscription.trialEndsAt}}
        <span class="trial-badge">
          Trial ends {{formatDate firm.subscription.trialEndsAt}}
        </span>
        {{/if}}
      </div>
    </div>
    
    <div class="firm-actions">
      <button class="btn-primary" onclick="contactFirm('{{firm.firmId}}')">
        Contact Firm
      </button>
      <button class="btn-secondary" onclick="generateReport('{{firm.firmId}}')">
        Generate Report
      </button>
      <div class="dropdown">
        <button class="btn-secondary dropdown-toggle">
          Admin Actions ▼
        </button>
        <div class="dropdown-menu">
          <button onclick="resetPassword('{{firm.firmId}}')">Reset Admin Password</button>
          <button onclick="upgradePlan('{{firm.firmId}}')">Upgrade Plan</button>
          <button onclick="extendTrial('{{firm.firmId}}')">Extend Trial</button>
          <button onclick="suspendAccount('{{firm.firmId}}')">Suspend Account</button>
        </div>
      </div>
    </div>
  </header>

  <!-- Firm Information Tabs -->
  <div class="firm-tabs">
    <nav class="tab-nav">
      <button class="tab-btn active" onclick="showTab('overview')">Overview</button>
      <button class="tab-btn" onclick="showTab('users')">Users</button>
      <button class="tab-btn" onclick="showTab('billing')">Billing</button>
      <button class="tab-btn" onclick="showTab('analytics')">Analytics</button>
      <button class="tab-btn" onclick="showTab('support')">Support Log</button>
    </nav>

    <!-- Overview Tab -->
    <div id="overview-tab" class="tab-content active">
      <div class="overview-grid">
        <!-- Account Information -->
        <section class="info-section">
          <h3>Account Information</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Firm ID</label>
              <code>{{firm.firmId}}</code>
            </div>
            <div class="info-item">
              <label>Subdomain</label>
              <code>{{firm.slug}}.lexara.app</code>
            </div>
            <div class="info-item">
              <label>Contact Email</label>
              <a href="mailto:{{firm.contactEmail}}">{{firm.contactEmail}}</a>
            </div>
            <div class="info-item">
              <label>Contact Phone</label>
              <span>{{firm.contactPhone}}</span>
            </div>
            <div class="info-item">
              <label>Website</label>
              <a href="{{firm.website}}" target="_blank">{{firm.website}}</a>
            </div>
            <div class="info-item">
              <label>Practice Areas</label>
              <div class="practice-areas">
                {{#each firm.practiceAreas}}
                <span class="practice-badge">{{this}}</span>
                {{/each}}
              </div>
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

        <!-- Quick Stats -->
        <section class="stats-section">
          <h3>Quick Stats</h3>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">{{firm.analytics.totalConversations}}</div>
              <div class="stat-label">Total Conversations</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{firm.analytics.monthlyConversations}}</div>
              <div class="stat-label">This Month</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{firm.analytics.avgResponseTime}}s</div>
              <div class="stat-label">Avg Response Time</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{firm.users.length}}</div>
              <div class="stat-label">Authorized Users</div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Users Tab -->
    <div id="users-tab" class="tab-content">
      <section class="users-section">
        <div class="section-header">
          <h3>Authorized Users</h3>
          <button class="btn-primary" onclick="inviteUser('{{firm.firmId}}')">
            Invite User
          </button>
        </div>
        
        <table class="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last Login</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {{#each firm.users}}
            <tr>
              <td>{{name}}</td>
              <td>{{email}}</td>
              <td>
                <span class="role-badge {{role}}">{{titleCase role}}</span>
              </td>
              <td>{{formatDate lastLogin}}</td>
              <td>
                <span class="status-indicator {{isActive}}">
                  {{#if isActive}}Active{{else}}Inactive{{/if}}
                </span>
              </td>
              <td>
                <div class="user-actions">
                  <button class="btn-sm" onclick="resetUserPassword('{{auth0UserId}}')">
                    Reset Password
                  </button>
                  <button class="btn-sm {{#unless isActive}}btn-primary{{else}}btn-secondary{{/unless}}" 
                          onclick="toggleUserStatus('{{auth0UserId}}')">
                    {{#if isActive}}Deactivate{{else}}Activate{{/if}}
                  </button>
                </div>
              </td>
            </tr>
            {{/each}}
          </tbody>
        </table>
      </section>
    </div>

    <!-- Billing Tab -->
    <div id="billing-tab" class="tab-content">
      <div class="billing-overview">
        <!-- Current Plan -->
        <section class="plan-section">
          <h3>Current Plan</h3>
          <div class="plan-details">
            <div class="plan-info">
              <div class="plan-name">{{titleCase firm.subscription.tier}}</div>
              <div class="plan-status">{{titleCase firm.subscription.status}}</div>
              <div class="plan-limits">
                <div>{{firm.subscription.monthlyConversationLimit}} conversations/month</div>
                <div>Current usage: {{firm.subscription.currentUsage}}</div>
              </div>
            </div>
            <div class="plan-actions">
              <button class="btn-primary" onclick="upgradePlan('{{firm.firmId}}')">
                Upgrade Plan
              </button>
              <button class="btn-secondary" onclick="changePlan('{{firm.firmId}}')">
                Change Plan
              </button>
            </div>
          </div>
        </section>

        <!-- Payment Information -->
        <section class="payment-section">
          <h3>Payment Information</h3>
          <div class="payment-details">
            <div class="payment-info">
              <div class="payment-item">
                <label>Stripe Customer ID</label>
                <code>{{firm.billing.stripeCustomerId}}</code>
              </div>
              <div class="payment-item">
                <label>Payment Method</label>
                <span>{{firm.billing.paymentMethod}}</span>
              </div>
              <div class="payment-item">
                <label>Current Balance</label>
                <span class="balance {{firm.billing.balanceStatus}}">
                  ${{firm.billing.currentBalance}}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- Invoice History -->
        <section class="invoice-section">
          <h3>Invoice History</h3>
          <table class="invoice-table">
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
              {{#each firm.billing.invoiceHistory}}
              <tr>
                <td>{{invoiceNumber}}</td>
                <td>{{formatDate date}}</td>
                <td>${{amount}}</td>
                <td>
                  <span class="payment-status {{status}}">{{titleCase status}}</span>
                </td>
                <td>
                  <button class="btn-sm" onclick="viewInvoice('{{id}}')">View</button>
                  <button class="btn-sm" onclick="downloadInvoice('{{id}}')">Download</button>
                </td>
              </tr>
              {{/each}}
            </tbody>
          </table>
        </section>
      </div>
    </div>

    <!-- Analytics Tab (Anonymized) -->
    <div id="analytics-tab" class="tab-content">
      <section class="analytics-section">
        <h3>Usage Analytics</h3>
        <p class="analytics-disclaimer">
          📊 Analytics are anonymized and contain no client-specific information
        </p>
        
        <div class="analytics-charts">
          <!-- Conversation Volume Chart -->
          <div class="chart-container">
            <h4>Conversation Volume (Last 12 Months)</h4>
            <canvas id="conversationChart" 
                    data-firm-id="{{firm.firmId}}"
                    data-chart-type="conversations">
            </canvas>
          </div>
          
          <!-- Response Time Chart -->
          <div class="chart-container">
            <h4>Average Response Time</h4>
            <canvas id="responseTimeChart"
                    data-firm-id="{{firm.firmId}}"
                    data-chart-type="response-time">
            </canvas>
          </div>
        </div>

        <div class="analytics-summary">
          <div class="summary-card">
            <h4>Performance Summary</h4>
            <ul>
              <li>Average conversations/month: {{firm.analytics.avgMonthlyConversations}}</li>
              <li>Peak conversation day: {{firm.analytics.peakDay}}</li>
              <li>Average response time: {{firm.analytics.avgResponseTime}}s</li>
              <li>System uptime: {{firm.analytics.uptime}}%</li>
            </ul>
          </div>
        </div>
      </section>
    </div>

    <!-- Support Log Tab -->
    <div id="support-tab" class="tab-content">
      <section class="support-section">
        <div class="section-header">
          <h3>Support History</h3>
          <button class="btn-primary" onclick="addSupportNote('{{firm.firmId}}')">
            Add Support Note
          </button>
        </div>
        
        <div class="support-timeline">
          {{#each firm.supportHistory}}
          <div class="support-entry">
            <div class="support-header">
              <span class="support-action {{type}}">{{action}}</span>
              <span class="support-date">{{formatDate timestamp}}</span>
              <span class="support-user">by {{performedBy}}</span>
            </div>
            <div class="support-details">{{details}}</div>
            {{#if attachments}}
            <div class="support-attachments">
              {{#each attachments}}
              <a href="{{url}}" class="attachment-link">{{name}}</a>
              {{/each}}
            </div>
            {{/if}}
          </div>
          {{/each}}
        </div>
      </section>
    </div>
  </div>
</div>
```

---

## 🔍 **Audit Logging System**

### **Comprehensive Audit Requirements**

**All platform admin actions must be logged with:**
- **Who**: Lexara employee details (ID, email, role)
- **What**: Specific action performed
- **When**: Precise timestamp with timezone
- **Where**: Source IP address and user agent
- **Target**: Which firm/user was affected
- **Result**: Success or failure with details
- **Context**: Additional relevant information

### **Audit Log Storage**

```typescript
interface PlatformAuditLog {
  // Unique identifier
  logId: string;                    // ULID for sorting and uniqueness
  
  // Temporal information
  timestamp: Date;                  // UTC timestamp
  timezone: string;                 // User's timezone for context
  
  // Actor information (Lexara employee)
  platformUserId: string;           // Auth0 user ID
  platformUserEmail: string;       // Employee email
  platformUserName: string;        // Employee name
  platformUserRole: string;        // Employee role (admin, support, billing)
  
  // Action details
  action: PlatformAction;           // Standardized action type
  actionCategory: ActionCategory;   // Grouping for reporting
  description: string;              // Human-readable description
  
  // Target information
  targetType: 'firm' | 'user' | 'system' | 'billing';
  targetId?: string;                // Firm ID, user ID, etc.
  targetName?: string;              // Firm name, user email, etc.
  
  // Request context
  ipAddress: string;                // Source IP
  userAgent: string;                // Browser/client info
  requestId: string;                // Request correlation ID
  sessionId: string;                // Admin session ID
  
  // Action outcome
  result: 'success' | 'failure' | 'partial';
  errorMessage?: string;            // If action failed
  warningMessage?: string;          // If action had issues
  
  // Data context
  beforeData?: Record<string, any>; // State before action
  afterData?: Record<string, any>;  // State after action
  metadata: Record<string, any>;    // Additional context
  
  // Security context
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;        // For sensitive actions
  approvedBy?: string;              // If action required approval
}

type PlatformAction = 
  // Firm management
  | 'firm_created'
  | 'firm_viewed'
  | 'firm_updated'
  | 'firm_suspended'
  | 'firm_reactivated'
  | 'firm_deleted'
  
  // User management
  | 'user_password_reset'
  | 'user_invited'
  | 'user_deactivated'
  | 'user_reactivated'
  | 'user_role_changed'
  
  // Subscription management
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'subscription_cancelled'
  | 'trial_extended'
  | 'usage_limit_increased'
  
  // Billing actions
  | 'invoice_viewed'
  | 'invoice_generated'
  | 'payment_processed'
  | 'refund_issued'
  | 'credit_applied'
  
  // Support actions
  | 'support_ticket_created'
  | 'support_note_added'
  | 'support_escalated'
  
  // System actions
  | 'analytics_accessed'
  | 'report_generated'
  | 'data_exported'
  | 'system_settings_changed'
  
  // Security actions
  | 'platform_login'
  | 'platform_logout'
  | 'unauthorized_access_attempt'
  | 'permission_denied';

type ActionCategory = 
  | 'account_management'
  | 'user_administration'
  | 'billing_operations'
  | 'customer_support'
  | 'system_administration'
  | 'security_events'
  | 'data_access';
```

### **Audit Log Implementation**

```typescript
class PlatformAuditLogger {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }
  
  async logAction(params: {
    action: PlatformAction;
    description: string;
    platformUser: AuthContext;
    targetType: string;
    targetId?: string;
    targetName?: string;
    beforeData?: any;
    afterData?: any;
    metadata?: any;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    request: Request;
  }): Promise<void> {
    const logEntry: PlatformAuditLog = {
      logId: generateULID(),
      timestamp: new Date(),
      timezone: 'UTC',
      
      // Platform user context
      platformUserId: params.platformUser.userId,
      platformUserEmail: params.platformUser.email || '',
      platformUserName: params.platformUser.name || '',
      platformUserRole: params.platformUser.userType,
      
      // Action details
      action: params.action,
      actionCategory: this.categorizeAction(params.action),
      description: params.description,
      
      // Target information
      targetType: params.targetType,
      targetId: params.targetId,
      targetName: params.targetName,
      
      // Request context
      ipAddress: params.request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: params.request.headers.get('User-Agent') || 'unknown',
      requestId: params.request.headers.get('CF-Ray') || generateULID(),
      sessionId: this.extractSessionId(params.request),
      
      // Action outcome (set to success, can be updated)
      result: 'success',
      
      // Data context
      beforeData: params.beforeData,
      afterData: params.afterData,
      metadata: params.metadata || {},
      
      // Security context
      riskLevel: params.riskLevel || 'low',
      requiresApproval: this.requiresApproval(params.action),
    };
    
    // Store in audit log Durable Object
    await this.storeAuditLog(logEntry);
    
    // Send high-risk actions to security monitoring
    if (logEntry.riskLevel === 'high' || logEntry.riskLevel === 'critical') {
      await this.alertSecurityTeam(logEntry);
    }
  }
  
  async logFailure(params: {
    action: PlatformAction;
    description: string;
    platformUser: AuthContext;
    error: Error;
    request: Request;
  }): Promise<void> {
    await this.logAction({
      ...params,
      riskLevel: 'medium',
      metadata: {
        errorName: params.error.name,
        errorMessage: params.error.message,
        errorStack: params.error.stack
      }
    });
  }
  
  private categorizeAction(action: PlatformAction): ActionCategory {
    if (action.startsWith('firm_')) return 'account_management';
    if (action.startsWith('user_')) return 'user_administration';
    if (action.includes('subscription') || action.includes('billing')) return 'billing_operations';
    if (action.startsWith('support_')) return 'customer_support';
    if (action.includes('system')) return 'system_administration';
    return 'security_events';
  }
  
  private requiresApproval(action: PlatformAction): boolean {
    const sensitiveActions = [
      'firm_deleted',
      'subscription_cancelled',
      'refund_issued',
      'system_settings_changed'
    ];
    return sensitiveActions.includes(action);
  }
}

// Usage in platform admin handlers
async function handleFirmView(firmId: string, request: Request, env: Env) {
  const authContext = await requirePlatformAdmin(request, env);
  const auditLogger = new PlatformAuditLogger(env);
  
  try {
    const firm = await getFirmById(firmId, env);
    
    // Log the access
    await auditLogger.logAction({
      action: 'firm_viewed',
      description: `Viewed firm details for ${firm.name}`,
      platformUser: authContext,
      targetType: 'firm',
      targetId: firmId,
      targetName: firm.name,
      metadata: {
        viewedSections: ['overview', 'users', 'billing'],
        firmSlug: firm.slug
      },
      request
    });
    
    return renderFirmDetailView(firm);
    
  } catch (error) {
    // Log the failure
    await auditLogger.logFailure({
      action: 'firm_viewed',
      description: `Failed to view firm ${firmId}`,
      platformUser: authContext,
      error: error as Error,
      request
    });
    
    throw error;
  }
}
```

---

## 🚀 **Implementation Roadmap**

### **Phase 1: Core Platform Portal (Week 1-2)**
1. **Authentication Setup** - Auth0 platform organization, login flow
2. **Basic Dashboard** - Platform metrics, firm list view
3. **Firm Management** - View firm details, basic support interface
4. **Audit Logging** - Core logging infrastructure

### **Phase 2: Enhanced Features (Week 3-4)**
1. **Advanced Firm Management** - Create, suspend, delete firms
2. **Billing Integration** - Stripe data, invoice management
3. **User Management** - Password resets, user administration
4. **Analytics Dashboard** - System health, usage metrics

### **Phase 3: Production Readiness (Week 5-6)**
1. **Security Hardening** - IP restrictions, session management
2. **Audit Compliance** - Complete audit trail, security monitoring
3. **Support Tools** - Ticket system, escalation workflows
4. **Performance Optimization** - Caching, query optimization

---

## 📊 **Success Metrics**

### **Platform Administration KPIs**
- **Firm Onboarding Time**: < 24 hours from creation to active
- **Support Response Time**: < 2 hours for critical issues
- **System Uptime**: 99.9% availability target
- **Audit Completeness**: 100% of actions logged
- **Security Incidents**: Zero unauthorized data access

### **User Experience Goals**
- **Dashboard Load Time**: < 3 seconds
- **Firm Search Performance**: < 1 second for any query
- **Report Generation**: < 30 seconds for standard reports
- **Navigation Efficiency**: < 3 clicks to reach any function

---

*This specification provides the complete technical foundation for implementing the Lexara platform administration portal with strict data access controls and comprehensive audit capabilities.*