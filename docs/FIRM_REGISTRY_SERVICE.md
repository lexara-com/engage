# Firm Registry Service - Detailed Design & API Documentation

## Overview

The Firm Registry Service is the central administrative backbone of Engage, managing all law firm registrations, configurations, and user access control. Built as an enhanced Durable Object, it provides atomic operations, global consistency, and seamless multi-tenant isolation.

## Core Responsibilities

### 1. Firm Lifecycle Management
- **Self-Service Registration**: New firm onboarding with Auth0 integration
- **Profile Management**: Firm details, contact information, branding
- **Subscription Management**: Billing tiers, usage tracking, trial handling
- **Account Status**: Active/suspended/cancelled states with graceful degradation

### 2. Multi-Tenant Infrastructure
- **Domain Routing**: Subdomain (`firm.engage.lexara.com`) and custom domain support
- **Data Isolation**: Complete separation of firm data and configurations
- **Slug Management**: URL-friendly identifiers for firm subdomains
- **Conflict Resolution**: Duplicate prevention across all identifiers

### 3. User & Access Management
- **Role-Based Access Control**: Admin, Lawyer, Staff, Viewer roles
- **Permission Granularity**: Feature-specific permissions (billing, conflicts, analytics)
- **Auth0 Integration**: SSO with user mapping and session management
- **Multi-User Support**: Teams with hierarchical access controls

### 4. Configuration Management
- **Practice Areas**: Legal specialties and service offerings
- **Firm Restrictions**: Areas of law the firm doesn't handle
- **HIPAA Compliance**: Encryption settings, retention policies, access controls
- **Branding Configuration**: Colors, logos, fonts, custom CSS

## Enhanced API Specification

### Authentication & Authorization
All admin endpoints require Auth0 JWT tokens with firm-specific claims:
```
Authorization: Bearer <jwt_token>
X-Firm-ID: <firm_id>
X-User-Role: <admin|lawyer|staff|viewer>
```

### Core Firm Management Endpoints

#### `POST /api/admin/firms` - Register New Firm
```typescript
// Request Body
interface FirmRegistrationRequest {
  // Required Fields
  name: string;                    // "Smith & Associates Law"
  contactEmail: string;           // "admin@smithlaw.com"
  
  // Optional Fields  
  slug?: string;                  // "smith-associates" (auto-generated if not provided)
  domain?: string;                // "intake.smithlaw.com"
  contactPhone?: string;          // "+1-555-123-4567"
  website?: string;               // "https://smithlaw.com"
  
  // Address Information
  address?: {
    street: string;               // "123 Main Street, Suite 400"
    city: string;                 // "Austin"
    state: string;                // "TX"
    postalCode: string;           // "78701"
    country: string;              // "US"
  };
  
  // Initial Configuration
  practiceAreas?: string[];       // ["personal_injury", "employment_law"]
  subscriptionTier?: 'starter' | 'professional' | 'enterprise';
  
  // Initial Admin User (from Auth0 context)
  adminUser: {
    auth0UserId: string;          // "auth0|507f1f77bcf86cd799439011"
    email: string;                // "john@smithlaw.com"
    name: string;                 // "John Smith"
  };
}

// Response
interface FirmRegistrationResponse {
  firmId: string;                 // ULID: "01ARZ3NDEKTSV4RRFFQ69G5FAV"
  slug: string;                   // "smith-associates"
  subdomain: string;              // "smith-associates.engage.lexara.com"
  trialEndsAt: string;           // ISO date: "2025-02-01T00:00:00Z"
  dashboardUrl: string;          // "https://admin.engage.lexara.com/firms/01ARZ3..."
  
  // Initial setup status
  setupRequired: {
    practiceAreas: boolean;       // true if need to configure
    supportingDocuments: boolean; // true if need to upload
    conflictDatabase: boolean;    // true if need to populate
    branding: boolean;           // false (defaults provided)
  };
}
```

#### `GET /api/admin/firms/{firmId}` - Get Firm Details
```typescript
interface FirmDetailsResponse extends Firm {
  // Additional computed fields
  setupCompletePercentage: number;     // 0-100
  lastLoginAt?: string;                // ISO date
  activeUsers: number;                 // Count of active users
  
  // Usage statistics (current month)
  usage: {
    conversations: number;             // Current month conversations
    monthlyLimit: number;              // Based on subscription tier
    utilizationPercentage: number;     // 0-100
    overageCharges?: number;           // If over limit
  };
  
  // System status
  systemStatus: {
    vectorizeIndexes: 'healthy' | 'initializing' | 'error';
    encryptionKeys: 'active' | 'rotation_needed' | 'error';
    domainStatus: 'active' | 'pending_verification' | 'error';
  };
}
```

#### `PUT /api/admin/firms/{firmId}` - Update Firm Profile
```typescript
interface FirmUpdateRequest {
  // Basic Information
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: Address;
  
  // Domain & Branding
  slug?: string;                       // Requires validation
  domain?: string;                     // Triggers domain verification
  branding?: Partial<FirmBranding>;
  
  // Practice Configuration
  practiceAreas?: string[];
  restrictions?: string[];
  
  // Compliance Settings
  compliance?: Partial<FirmCompliance>;
  
  // Subscription (admin only)
  subscription?: Partial<FirmSubscription>;
}

interface FirmUpdateResponse {
  success: boolean;
  updatedFields: string[];
  warnings?: string[];                 // Non-blocking issues
  
  // Domain verification if domain changed
  domainVerification?: {
    required: boolean;
    dnsRecords: {
      type: 'CNAME' | 'TXT';
      name: string;
      value: string;
    }[];
    verificationUrl: string;           // Webhook for verification
  };
}
```

### User Management Endpoints

#### `GET /api/admin/firms/{firmId}/users` - List Firm Users
```typescript
interface FirmUsersResponse {
  users: Array<FirmUser & {
    lastLogin?: string;                // ISO date
    lastActivity?: string;             // ISO date
    conversationsCount: number;        // Conversations they've reviewed
    status: 'active' | 'invited' | 'suspended';
  }>;
  invitations: Array<{
    email: string;
    role: FirmRole;
    invitedAt: string;                // ISO date
    expiresAt: string;                // ISO date
    invitedBy: string;                // User who sent invitation
  }>;
}
```

#### `POST /api/admin/firms/{firmId}/users` - Add User to Firm
```typescript
interface AddUserRequest {
  email: string;                      // "lawyer@smithlaw.com"
  role: FirmRole;                     // "lawyer"
  
  // For existing Auth0 users
  auth0UserId?: string;               // Direct addition
  
  // For new users (invitation flow)
  name?: string;                      // Used in invitation email
  customMessage?: string;             // Personal invitation message
  
  // Permission overrides (optional)
  permissions?: Partial<AdminPermissions>;
}

interface AddUserResponse {
  success: boolean;
  
  // For existing users
  userAdded?: {
    auth0UserId: string;
    role: FirmRole;
    permissions: AdminPermissions;
  };
  
  // For new users  
  invitationSent?: {
    email: string;
    invitationId: string;            // Track invitation status
    expiresAt: string;               // ISO date (7 days)
    invitationUrl: string;           // Auth0 invitation link
  };
}
```

#### `PUT /api/admin/firms/{firmId}/users/{auth0UserId}` - Update User Role/Permissions
```typescript
interface UpdateUserRequest {
  role?: FirmRole;
  permissions?: Partial<AdminPermissions>;
  isActive?: boolean;                 // Suspend/reactivate user
}

interface UpdateUserResponse {
  success: boolean;
  updatedUser: FirmUser;
  permissionChanges: string[];        // List of changed permissions
}
```

#### `DELETE /api/admin/firms/{firmId}/users/{auth0UserId}` - Remove User
```typescript
interface RemoveUserResponse {
  success: boolean;
  removedUser: {
    email: string;
    role: FirmRole;
    lastActivity?: string;
  };
  
  // If user had ongoing responsibilities
  dataTransfer?: {
    conversationsToReassign: number;
    recommendedNewOwner?: string;      // Another admin/lawyer
  };
}
```

### Subscription & Billing Management

#### `GET /api/admin/firms/{firmId}/subscription` - Get Subscription Details
```typescript
interface SubscriptionDetailsResponse {
  current: FirmSubscription & {
    nextBillingDate?: string;         // ISO date
    prorationCredit?: number;         // If mid-cycle upgrade
    
    // Usage tracking
    currentPeriod: {
      startDate: string;              // ISO date
      endDate: string;                // ISO date
      conversationsUsed: number;
      conversationsLimit: number;
      overageRate?: number;           // Per conversation over limit
    };
  };
  
  // Available tiers
  availableTiers: Array<{
    tier: SubscriptionTier;
    monthlyPrice: number;
    conversationLimit: number;
    features: string[];
    upgradePrice?: number;            // Prorated upgrade cost
  }>;
  
  // Payment information
  paymentMethod?: {
    type: 'card' | 'ach';
    last4: string;
    brand?: string;                   // "visa", "mastercard"
    expiryMonth?: number;
    expiryYear?: number;
  };
  
  // Billing history
  recentInvoices: Array<{
    invoiceId: string;
    amount: number;
    currency: string;                 // "usd"
    date: string;                     // ISO date
    status: 'paid' | 'pending' | 'failed';
    downloadUrl?: string;
  }>;
}
```

#### `PUT /api/admin/firms/{firmId}/subscription` - Update Subscription
```typescript
interface SubscriptionUpdateRequest {
  tier?: SubscriptionTier;            // Upgrade/downgrade
  
  // Payment method update
  stripePaymentMethodId?: string;     // From Stripe Elements
  
  // Billing preferences
  billingEmail?: string;              // Different from contact email
  taxId?: string;                     // For tax-exempt organizations
  
  // Trial extension (admin only)
  extendTrialDays?: number;           // Additional trial days
}

interface SubscriptionUpdateResponse {
  success: boolean;
  
  // Immediate changes
  newTier?: SubscriptionTier;
  effectiveDate: string;              // ISO date
  
  // Financial impact
  prorationAmount?: number;           // Charge or credit
  nextBillingAmount: number;
  nextBillingDate: string;
  
  // Confirmation
  confirmationEmail: boolean;         // Email sent to billing contact
}
```

### Firm Configuration Endpoints

#### `GET /api/admin/firms/{firmId}/configuration` - Get All Configuration
```typescript
interface FirmConfigurationResponse {
  practiceAreas: Array<{
    id: string;                       // "personal_injury"
    name: string;                     // "Personal Injury"
    description?: string;
    isActive: boolean;
    addedAt: string;                  // ISO date
  }>;
  
  restrictions: Array<{
    area: string;                     // "criminal_law"
    reason?: string;                  // "Not licensed for criminal practice"
    addedAt: string;
  }>;
  
  supportingDocuments: Array<{
    documentId: string;
    filename: string;
    uploadedAt: string;
    size: number;                     // Bytes
    type: 'intake_template' | 'case_guidelines' | 'firm_policies';
    status: 'processing' | 'indexed' | 'error';
  }>;
  
  branding: FirmBranding & {
    logoUrl?: string;                 // CDN URL for uploaded logo
    faviconUrl?: string;              // CDN URL for favicon
    lastUpdated: string;              // ISO date
  };
  
  compliance: FirmCompliance & {
    lastReview: string;               // ISO date
    nextReviewDue: string;            // ISO date
    complianceScore: number;          // 0-100
    recommendations: string[];
  };
}
```

#### `PUT /api/admin/firms/{firmId}/configuration/practice-areas` - Update Practice Areas
```typescript
interface PracticeAreasUpdateRequest {
  practiceAreas: Array<{
    id: string;                       // Standard or custom ID
    name: string;
    description?: string;
    isActive: boolean;
  }>;
}

interface PracticeAreasUpdateResponse {
  success: boolean;
  addedAreas: string[];               // New practice areas
  removedAreas: string[];             // Deactivated areas
  
  // Impact analysis
  affectedDocuments: number;          // Supporting docs that may need updates
  affectedGoals: number;              // Agent goals that may need review
}
```

#### `PUT /api/admin/firms/{firmId}/configuration/branding` - Update Branding
```typescript
interface BrandingUpdateRequest {
  primaryColor?: string;              // Hex color: "#1e40af"
  secondaryColor?: string;
  fontFamily?: string;                // Web-safe font or Google Fonts
  customCss?: string;                 // Advanced styling
  
  // Logo upload (multipart form data in separate endpoint)
  logoFile?: File;                    // Handled by /upload-logo endpoint
  faviconFile?: File;                 // Handled by /upload-favicon endpoint
}

interface BrandingUpdateResponse {
  success: boolean;
  previewUrl: string;                 // Live preview of changes
  
  // Validation results
  colorContrast: {
    textOnPrimary: number;            // WCAG contrast ratio
    textOnSecondary: number;
    passes: boolean;                  // Meets WCAG AA standards
  };
  
  cssValidation: {
    valid: boolean;
    warnings: string[];               // Non-critical CSS issues
    errors: string[];                 // Critical CSS issues
  };
}
```

### Advanced Operations

#### `POST /api/admin/firms/{firmId}/backup` - Create Full Firm Backup
```typescript
interface BackupRequest {
  includeConversations: boolean;      // Include all conversation data
  includeDocuments: boolean;          // Include supporting documents
  encryptBackup: boolean;             // HIPAA-compliant encryption
}

interface BackupResponse {
  backupId: string;                   // Track backup progress
  estimatedSize: number;              // Bytes
  estimatedDuration: number;          // Seconds
  downloadAvailableUntil: string;     // ISO date (30 days)
  
  // Progress tracking
  statusUrl: string;                  // GET endpoint for progress
}
```

#### `POST /api/admin/firms/{firmId}/migrate` - Migrate From Another Platform
```typescript
interface MigrationRequest {
  sourceType: 'clio' | 'practice_panther' | 'csv' | 'other';
  
  // For API-based migrations
  apiCredentials?: {
    clientId: string;
    clientSecret: string;
    apiUrl?: string;
  };
  
  // For file-based migrations
  dataFiles?: {
    clientsFile: string;              // File upload ID
    casesFile?: string;
    conflictsFile?: string;
  };
  
  // Migration options
  options: {
    importClients: boolean;
    importConflicts: boolean;
    importCaseTypes: boolean;
    dryRun: boolean;                  // Test migration first
  };
}

interface MigrationResponse {
  migrationId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  
  // Preview results (if dryRun: true)
  preview?: {
    clientsToImport: number;
    conflictsToImport: number;
    duplicatesDetected: number;
    potentialIssues: string[];
  };
  
  // Progress tracking
  statusUrl: string;
  estimatedCompletion?: string;       // ISO date
}
```

## Data Models & Validation

### Firm Validation Rules
```typescript
const FIRM_VALIDATION = {
  name: {
    minLength: 2,
    maxLength: 100,
    pattern: /^[A-Za-z0-9\s&.,'-]+$/,  // Business name characters
  },
  slug: {
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-z0-9-]+$/,           // URL-safe lowercase
    reserved: ['admin', 'api', 'www', 'mail', 'ftp'], // Reserved slugs
  },
  contactEmail: {
    pattern: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/,
  },
  domain: {
    pattern: /^[a-z0-9.-]+\.[a-z]{2,}$/,
    blacklist: ['engage.lexara.com', 'lexara.com'], // Reserved domains
  }
};
```

### Permission Matrix
```typescript
const PERMISSION_MATRIX: Record<FirmRole, AdminPermissions> = {
  admin: {
    canManageUsers: true,
    canManageConflicts: true,
    canViewAnalytics: true,
    canManageBilling: true,
    canManageBranding: true,
    canManageCompliance: true,
  },
  lawyer: {
    canManageUsers: false,
    canManageConflicts: true,
    canViewAnalytics: true,
    canManageBilling: false,
    canManageBranding: false,
    canManageCompliance: true,
  },
  staff: {
    canManageUsers: false,
    canManageConflicts: true,
    canViewAnalytics: false,
    canManageBilling: false,
    canManageBranding: false,
    canManageCompliance: false,
  },
  viewer: {
    canManageUsers: false,
    canManageConflicts: false,
    canViewAnalytics: true,
    canManageBilling: false,
    canManageBranding: false,
    canManageCompliance: false,
  },
};
```

## Error Handling & Status Codes

### Standard Error Responses
```typescript
interface ErrorResponse {
  error: string;                      // Error code
  message: string;                    // Human-readable message
  details?: Record<string, any>;      // Additional context
  field?: string;                     // Field that caused validation error
  retryAfter?: number;                // Seconds to wait before retry
}

// Common error codes
const ERROR_CODES = {
  FIRM_NOT_FOUND: 'Firm does not exist',
  DUPLICATE_SLUG: 'Firm slug already exists',
  DUPLICATE_DOMAIN: 'Domain already registered',
  INVALID_FIRM_DATA: 'Invalid or missing required data',
  INSUFFICIENT_PERMISSIONS: 'User lacks required permissions',
  SUBSCRIPTION_LIMIT_EXCEEDED: 'Action would exceed subscription limits',
  DOMAIN_VERIFICATION_REQUIRED: 'Custom domain requires DNS verification',
  TRIAL_EXPIRED: 'Firm trial period has ended',
};
```

### HTTP Status Codes
- `200 OK` - Successful operation
- `201 Created` - Firm registration successful
- `400 Bad Request` - Invalid request data or validation failure
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions for operation
- `404 Not Found` - Firm, user, or resource not found
- `409 Conflict` - Duplicate slug, domain, or user
- `422 Unprocessable Entity` - Valid format but business logic prevents action
- `429 Too Many Requests` - Rate limiting (with Retry-After header)
- `500 Internal Server Error` - System error

## Implementation Architecture

### Durable Object Design
- **Single Global Instance**: One FirmRegistry DO manages all firms
- **Atomic Operations**: All firm operations are transactional
- **Consistent Routing**: Domain/slug resolution never stale
- **Memory Efficiency**: Lazy loading with LRU cache for inactive firms

### Performance Considerations
- **Bulk Operations**: Batch user additions and configuration updates
- **Caching Strategy**: Edge caching for public firm information
- **Rate Limiting**: Protect against abuse during registration
- **Monitoring**: Track registration funnel and success rates

### Security Features
- **Input Validation**: Comprehensive validation on all inputs
- **SQL Injection Prevention**: Parameterized queries for external integrations
- **XSS Protection**: Sanitize all user-provided content
- **CSRF Protection**: State verification for sensitive operations
- **Audit Logging**: Complete audit trail for all administrative actions

## Integration Points

### Auth0 Integration
- **User Registration**: Automatic Auth0 user creation for firm admins
- **SSO Configuration**: Firm-specific Auth0 applications for custom domains
- **Permission Sync**: Real-time permission updates in Auth0 user metadata
- **Session Management**: Coordinate session timeouts with firm policies

### Stripe Integration
- **Customer Creation**: Automatic Stripe customer for billing
- **Subscription Management**: Real-time subscription status sync
- **Usage Metering**: Report conversation usage for billing
- **Webhook Handling**: Process payment status, subscription changes

### Vectorize Integration
- **Index Creation**: Automatic firm-specific Vectorize indexes
- **Document Pipeline**: Supporting documents to vector embeddings
- **Conflict Database**: Vector search for conflict detection
- **Performance Monitoring**: Index health and query performance

This comprehensive design provides the foundation for a scalable, secure, and user-friendly firm administration system that can support thousands of law firms with complete data isolation and enterprise-grade features.