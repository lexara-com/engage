# Law Firm Data and Functionality Specification

## Overview

This document defines the comprehensive data model and functionality requirements for law firm customers using the Lexara Engage platform. Each law firm represents a complete tenant in our multi-tenant architecture with isolated data and customized AI agent behavior.

---

## 1. Basic Identifying Information

**Purpose**: Core firm identity and business details for platform operation and legal compliance.

### Data Structure
```typescript
interface FirmIdentity {
  // Primary Identification
  firmId: string;           // ULID - Primary key
  legalName: string;        // Official registered business name
  dbaName?: string;         // "Doing Business As" name
  displayName: string;      // Brand name shown to clients
  
  // Business Registration
  businessType: 'solo_practice' | 'partnership' | 'llp' | 'pllc' | 'corporation' | 'other';
  ein?: string;            // Employer Identification Number
  stateOfIncorporation?: string;
  businessLicenseNumber?: string;
  
  // Contact Information
  primaryEmail: string;
  primaryPhone: string;
  website?: string;
  
  // Physical Address (Required for legal compliance)
  physicalAddress: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  
  // Mailing Address (if different)
  mailingAddress?: Address;
  
  // Firm Statistics
  foundedYear?: number;
  firmSize: '1' | '2-5' | '6-20' | '21-50' | '51-100' | '100+';
  totalAttorneys: number;
  totalStaff: number;
  
  // Platform Metadata
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'suspended' | 'trial' | 'churned';
  onboardingCompleted: boolean;
  lastActivity: Date;
}
```

### Functionality Requirements
- **Firm Profile Management**: Complete CRUD operations with audit trails
- **Logo and Branding Upload**: Custom logos for white-label experience
- **Verification Workflow**: Email/phone verification during onboarding
- **Compliance Tracking**: Monitor business license and registration status

---

## 2. Geographic Data

**Purpose**: Define service areas, jurisdictional authority, and conflict detection boundaries.

### Data Structure
```typescript
interface GeographicScope {
  firmId: string;
  
  // Service Areas
  primaryMarkets: {
    metropolitan: string[];    // "Denver Metro", "San Francisco Bay Area"
    counties: string[];        // County-level service areas
    cities: string[];         // Specific cities served
  };
  
  // Jurisdictional Authority
  stateBars: {
    state: string;
    barNumber: string;
    admissionDate: Date;
    status: 'active' | 'inactive' | 'suspended';
    disciplinaryHistory?: string;
  }[];
  
  federalCourts: {
    district: string;          // "D. Colo", "N.D. Cal"
    admissionDate: Date;
    status: 'active' | 'inactive';
  }[];
  
  // Court Practice Areas
  courtExperience: {
    courtType: 'state_trial' | 'state_appellate' | 'federal_district' | 'federal_appellate' | 'supreme';
    jurisdiction: string;
    yearsExperience: number;
    notableCases?: string[];
  }[];
  
  // Territorial Restrictions
  excludedJurisdictions: string[];   // Places they cannot practice
  conflictJurisdictions: string[];   // Areas with existing conflicts
  
  // Geographic Preferences
  preferredVenues: string[];         // Preferred courts/jurisdictions
  travelRadius: number;              // Miles willing to travel
  remoteConsultationStates: string[]; // States for remote consultations
}
```

### Functionality Requirements
- **Jurisdiction Validation**: Verify bar admissions and court privileges
- **Conflict Zone Mapping**: Geographic conflict detection
- **Venue Optimization**: Suggest optimal filing locations
- **Compliance Monitoring**: Track multi-state practice requirements

---

## 3. Practice Areas

**Purpose**: Define legal specializations to customize AI agent behavior and data collection workflows.

### Data Structure
```typescript
interface PracticeAreas {
  firmId: string;
  
  // Primary Practice Areas (drives AI behavior)
  primaryAreas: {
    area: LegalPracticeArea;
    percentage: number;        // % of firm's work
    experienceYears: number;
    certifications?: string[];
    specializations: string[]; // Sub-specialties within area
  }[];
  
  // Secondary/Occasional Work
  secondaryAreas: LegalPracticeArea[];
  
  // Excluded Areas (firm will NOT handle)
  excludedAreas: LegalPracticeArea[];
  excludedReasons?: string[];  // "No expertise", "Conflict policy", etc.
  
  // Matter Type Definitions
  matterTypes: {
    id: string;
    name: string;              // "Auto Accident", "Divorce with Children"
    practiceArea: LegalPracticeArea;
    estimatedValue: number;    // Average case value
    timeframe: string;         // "6-12 months"
    complexity: 'simple' | 'moderate' | 'complex';
    requiredDocuments: string[];
    customGoals: string[];     // Reference to Custom Goals
  }[];
  
  // Intake Preferences
  intakeSettings: {
    minimumCaseValue?: number;
    maximumCaseLoad: number;
    acceptContingency: boolean;
    acceptHourly: boolean;
    acceptFlat: boolean;
    retainerRequired: boolean;
    consultationFee?: number;
  };
}

type LegalPracticeArea = 
  | 'personal_injury' | 'family_law' | 'criminal_defense' | 'business_law'
  | 'estate_planning' | 'real_estate' | 'employment_law' | 'bankruptcy'
  | 'immigration' | 'intellectual_property' | 'tax_law' | 'environmental'
  | 'healthcare' | 'securities' | 'insurance' | 'litigation' | 'other';
```

### Functionality Requirements
- **AI Agent Customization**: Practice area-specific conversation flows
- **Document Templates**: Area-specific intake forms and checklists
- **Referral Networks**: Connect with specialists for excluded areas
- **Performance Analytics**: Track success rates by practice area

---

## 4. Lawyers and Staff

**Purpose**: User management, access control, and role-based functionality within the firm portal.

### Data Structure
```typescript
interface FirmPersonnel {
  firmId: string;
  
  users: {
    userId: string;           // ULID
    auth0UserId: string;      // Auth0 identity
    
    // Personal Information
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    title: string;            // "Partner", "Associate", "Paralegal"
    
    // Professional Details
    role: UserRole;
    barNumber?: string;       // If attorney
    barAdmissions: string[];  // States admitted to practice
    licenseStatus: 'active' | 'inactive' | 'suspended';
    
    // Platform Access
    permissions: Permission[];
    practiceAreas: LegalPracticeArea[]; // Areas this person handles
    caseloadLimit?: number;
    
    // Contact Preferences
    notificationSettings: {
      email: boolean;
      sms: boolean;
      inApp: boolean;
      urgentOnly: boolean;
    };
    
    // FUTURE FEATURE: Advanced scheduling (not included in initial release)
    workSchedule?: {
      timeZone: string;
      businessHours: {
        day: string;
        startTime: string;
        endTime: string;
        available: boolean;
      }[];
      vacationDates: Date[];
    };
    
    // Metadata
    createdAt: Date;
    lastLogin: Date;
    status: 'active' | 'inactive' | 'suspended';
    onboardingCompleted: boolean;
  }[];
  
  // Organizational Structure
  hierarchy: {
    managerId?: string;       // Reports to
    directReports: string[];  // Manages these users
    practiceGroup?: string;   // "Litigation", "Transactional"
  };
}

type UserRole = 
  | 'managing_partner' | 'partner' | 'senior_associate' | 'associate' 
  | 'of_counsel' | 'paralegal' | 'legal_assistant' | 'administrator'
  | 'marketing' | 'billing' | 'receptionist';

type Permission = 
  | 'view_all_conversations' | 'view_assigned_conversations' | 'delete_conversations'
  | 'manage_firm_settings' | 'manage_users' | 'manage_billing'
  | 'upload_documents' | 'manage_goals' | 'view_analytics'
  | 'export_data' | 'manage_integrations' | 'assign_conversations';
```

### Functionality Requirements
- **Role-Based Access Control**: Granular permissions system
- **User Lifecycle Management**: Onboarding, deactivation, role changes
- **Workload Distribution**: Automatic case assignment based on capacity
- **Performance Tracking**: Individual user metrics and analytics

---

## 5. Supporting Documentation

**Purpose**: Knowledge base for AI agent customization and case-specific guidance.

### Data Structure
```typescript
interface SupportingDocuments {
  firmId: string;
  
  documents: {
    documentId: string;       // ULID
    
    // Document Metadata
    title: string;
    description: string;
    category: DocumentCategory;
    practiceAreas: LegalPracticeArea[];
    matterTypes: string[];    // Specific matter types this applies to
    
    // Content
    content: string;          // Text content for vector search
    fileUrl?: string;         // Original file storage
    fileType?: string;        // PDF, DOCX, etc.
    
    // AI Integration
    vectorEmbeddings?: number[]; // For semantic search
    extractedGoals: string[];    // Goals derived from this document
    triggerKeywords: string[];   // Keywords that should surface this doc
    
    // Usage Instructions
    aiInstructions: string;      // How AI should use this document
    priority: 'high' | 'medium' | 'low';
    requiredForAllCases: boolean;
    
    // Version Control
    version: number;
    parentDocumentId?: string;   // For document revisions
    isActive: boolean;
    
    // Metadata
    uploadedBy: string;          // userId
    uploadedAt: Date;
    lastModified: Date;
    usageCount: number;          // How often this doc is referenced
  }[];
}

type DocumentCategory = 
  | 'intake_checklist' | 'case_strategy' | 'evidence_requirements' 
  | 'legal_standards' | 'document_templates' | 'process_guidelines'
  | 'client_communication' | 'billing_guidance' | 'referral_criteria';
```

### Functionality Requirements
- **Document Upload and Processing**: PDF/DOCX parsing and vector embedding
- **Version Control**: Track document changes and maintain history
- **Usage Analytics**: Monitor which documents are most effective
- **AI Integration**: Automatic goal extraction from uploaded documents

---

## 6. Custom Goals

**Purpose**: Dynamic, situation-specific data collection requirements that enhance AI agent effectiveness.

### Data Structure
```typescript
interface CustomGoals {
  firmId: string;
  
  goals: {
    goalId: string;           // ULID
    
    // Goal Definition
    title: string;
    description: string;
    category: GoalCategory;
    priority: GoalPriority;
    
    // Trigger Conditions
    triggers: {
      keywords: string[];       // "concussion", "head injury"
      practiceAreas: LegalPracticeArea[];
      matterTypes: string[];
      userInputPatterns: string[]; // Regex patterns
      contextConditions: string[]; // "if user mentions medical treatment"
    };
    
    // Data Collection Instructions
    aiInstructions: string;      // Detailed instructions for the AI
    requiredInformation: string[]; // Specific data points to collect
    followUpQuestions: string[];   // Suggested follow-up questions
    
    // Validation Rules
    validationRules: {
      required: boolean;
      dataType: 'text' | 'date' | 'number' | 'boolean' | 'file';
      minLength?: number;
      maxLength?: number;
      pattern?: string;         // Regex validation
    };
    
    // Dependencies
    prerequisiteGoals: string[]; // Must complete these goals first
    relatedGoals: string[];     // Often collected together
    conflictsWith: string[];    // Cannot collect if these are present
    
    // Usage Context
    isActive: boolean;
    applicableStates: string[]; // Geographic restrictions
    effectiveDate: Date;
    expirationDate?: Date;
    
    // Metadata
    createdBy: string;          // userId
    createdAt: Date;
    lastModified: Date;
    usageCount: number;
    successRate: number;        // How often users complete this goal
  }[];
}
```

### Functionality Requirements
- **Dynamic Goal Activation**: Real-time goal triggering based on conversation context
- **Goal Dependencies**: Complex workflows with prerequisite relationships
- **A/B Testing**: Test different goal configurations for effectiveness
- **Performance Analytics**: Track goal completion rates and user experience

---

## 7. Payment Details

**Purpose**: Subscription management, billing, and financial tracking through Stripe integration.

### Data Structure
```typescript
interface PaymentDetails {
  firmId: string;
  
  // Stripe Integration
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  
  // Subscription Information
  currentPlan: {
    planId: string;            // 'starter', 'professional', 'enterprise'
    planName: string;
    monthlyPrice: number;
    features: string[];
    conversationLimit: number;
    userLimit: number;
    storageLimit: number;      // GB
  };
  
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  billingCycle: 'monthly' | 'annual';
  paymentMethod: 'automatic' | 'invoiced';  // Invoiced only available for annual plans
  trialEndsAt?: Date;
  nextBillingDate: Date;
  
  // Payment Methods (PCI-Compliant - Stored in Stripe)
  paymentMethods: {
    stripePaymentMethodId: string;  // Stripe payment method ID (only reference)
    type: 'card' | 'bank_account';
    isDefault: boolean;
    // Display information from Stripe (no sensitive data stored locally)
    displayInfo: {
      last4?: string;             // From Stripe API (display only)
      brand?: string;             // From Stripe API (display only)
      expiryMonth?: number;       // From Stripe API (display only)
      expiryYear?: number;        // From Stripe API (display only)
      bankName?: string;          // For bank accounts (display only)
    };
    createdAt: Date;
    lastUpdatedFromStripe: Date;  // When we last synced display info
  }[];
  
  // Invoiced Payment Configuration (Annual Plans Only)
  invoicedPayment?: {
    isEnabled: boolean;
    stripeInvoiceSettings: {
      paymentTerms: 'net_15' | 'net_30' | 'net_45' | 'net_60';
      autoCollection: boolean;        // Auto-attempt collection on due date
      customMessage?: string;         // Custom message on invoices
      footer?: string;                // Invoice footer text
    };
    
    // Procurement Information
    procurementContact: {
      name: string;
      email: string;
      phone?: string;
      title: string;                  // "Chief Financial Officer", "Procurement Manager"
      department?: string;            // "Finance", "Operations"
    };
    
    // Payment Preferences
    preferredPaymentMethods: ('ach' | 'wire_transfer' | 'check' | 'card')[];
    requiresPurchaseOrder: boolean;
    purchaseOrderRequired?: string;   // PO number if required
    
    // Approval Workflow
    approvalWorkflow: {
      requiresApproval: boolean;
      approvalLimit?: number;         // Dollar amount requiring approval
      approvers: {
        userId: string;
        name: string;
        email: string;
        approvalLevel: number;        // 1=first level, 2=second level, etc.
      }[];
    };
    
    // Invoice History and Status
    invoiceHistory: {
      stripeInvoiceId: string;
      invoiceNumber: string;
      amount: number;
      currency: string;
      status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
      sentAt?: Date;
      dueDate: Date;
      paidAt?: Date;
      paymentMethod?: string;
      notes?: string;
    }[];
    
    // Collections and Follow-up
    collectionsSettings: {
      enableReminders: boolean;
      reminderSchedule: number[];     // Days before due date [7, 3, 1]
      overdueReminders: number[];     // Days after due date [1, 7, 14, 30]
      escalationContact?: string;     // Email for escalated collections
      maxOverdueDays: number;         // Suspend service after N days overdue
    };
  };
  
  // Billing Information
  billingAddress: Address;
  taxId?: string;             // For business tax purposes
  billingEmail: string;
  invoicePreferences: {
    autoSend: boolean;
    ccEmails: string[];
    paymentTerms: number;     // Days
  };
  
  // Usage Tracking
  currentPeriodUsage: {
    conversations: number;
    storageUsed: number;      // GB
    apiCalls: number;
    resetDate: Date;
  };
  
  // Financial History (References to Stripe records)
  paymentHistory: {
    stripeInvoiceId: string;      // Stripe invoice ID (reference only)
    stripeChargeId?: string;      // Stripe charge ID (reference only)
    amount: number;               // Safe to store - not payment card data
    status: 'paid' | 'pending' | 'failed';
    paidAt?: Date;
    invoiceUrl: string;           // Stripe-hosted invoice URL
    lastSyncedAt: Date;           // When we last synced from Stripe
  }[];
  
  // Discounts and Credits (Stripe references)
  appliedCoupons: {
    stripeCouponId: string;       // Stripe coupon ID (reference only)
    stripePromotionCodeId?: string; // Stripe promotion code ID (reference only)
    discountPercent?: number;     // Safe to cache for display
    discountAmount?: number;      // Safe to cache for display
    validUntil?: Date;            // Safe to cache for display
    lastSyncedAt: Date;           // When we last synced from Stripe
  }[];
  
  accountCredits: number;     // Dollar amount of credits
}
```

### Functionality Requirements

**Automatic Payment Processing (Monthly & Annual)**:
- **Stripe Elements Integration**: Secure card data collection and processing
- **Automated Billing**: Stripe webhooks for payment processing
- **Usage Monitoring**: Real-time tracking against plan limits
- **Overage Management**: Automatic billing for usage overages
- **Payment Recovery**: Failed payment retry logic and notifications

**Invoiced Payment Processing (Annual Plans Only)**:
- **Stripe Invoicing Integration**: Professional invoice generation and delivery
- **Flexible Payment Terms**: Net 15, 30, 45, or 60 day payment terms
- **Multiple Payment Methods**: ACH, wire transfer, check, or card payments
- **Procurement Workflow**: Purchase order support and approval workflows
- **Automated Reminders**: Configurable payment reminder schedules
- **Collections Management**: Overdue payment tracking and escalation

**Business Rules for Invoiced Payments**:
- **Annual Plans Only**: Invoicing restricted to annual billing cycles
- **Minimum Commitment**: Typically for Professional or Enterprise plans
- **Approval Required**: Platform admin approval for invoiced payment setup
- **Credit Check**: May require financial verification for large accounts
- **Service Continuity**: Grace period for overdue payments before service suspension

### PCI Compliance Strategy
**Zero Storage Approach**: We implement a "reference-only" payment architecture to eliminate PCI scope.

**What We Store (PCI-Safe)**:
- **Stripe Reference IDs**: Payment method IDs, customer IDs, invoice IDs, charge IDs
- **Non-Sensitive Display Data**: Last4 digits, card brand, expiry month/year (synced from Stripe)
- **Business Data**: Billing addresses, subscription status, usage metrics, invoice amounts
- **Metadata**: Creation dates, sync timestamps, preferences

**What We Never Store (PCI-Sensitive)**:
- **Full Card Numbers**: Always remain in Stripe's PCI-compliant vault
- **CVV/CVC Codes**: Never stored anywhere (single-use verification only)
- **Raw Payment Tokens**: Only store Stripe's permanent payment method references

**Technical Implementation**:
- **Stripe Elements**: All card data collection handled by Stripe's secure forms (automatic payments)
- **Stripe Invoicing**: All invoice-based payments processed through Stripe's secure platform
- **Server-Side Sync**: Periodic sync of display data from Stripe API for UI purposes
- **Webhook Integration**: Real-time payment status updates via Stripe webhooks
- **Reference Architecture**: All financial operations use Stripe IDs, never raw payment data
- **Dual Payment Processing**: Both subscription billing and invoicing maintain PCI compliance

**Compliance Benefits**:
- **No PCI DSS Requirements**: Payment card data never touches our infrastructure
- **Reduced Security Risk**: Eliminates most payment-related security vectors
- **Simplified Auditing**: Payment security handled by Stripe's certified infrastructure
- **Lower Compliance Costs**: No need for expensive PCI assessments or certifications

### Enterprise Invoicing Workflow

**Target Market**: Large law firms (50+ attorneys) and firms with corporate procurement requirements

**Typical Use Cases**:
- **Corporate Law Firms**: Firms that operate like corporations with formal procurement processes
- **AmLaw 200 Firms**: Large firms that require traditional B2B billing methods
- **Government Contracting**: Firms working with government entities requiring invoiced billing
- **International Firms**: Firms in markets where credit card processing is less common

**Implementation Workflow**:
```typescript
interface InvoicingWorkflow {
  // Initial Setup
  step1: 'Firm requests invoiced billing during onboarding or upgrade';
  step2: 'Platform admin reviews firm profile and plan eligibility';
  step3: 'Credit verification and approval process (if required)';
  step4: 'Procurement contact information collection';
  step5: 'Payment terms and workflow configuration';
  
  // Ongoing Operations
  invoiceGeneration: 'Automated monthly invoice creation for annual service';
  approvalProcess: 'Internal firm approval workflow (if configured)';
  invoiceDelivery: 'Professional invoice sent via email and/or portal';
  paymentCollection: 'Flexible payment method acceptance';
  reminderManagement: 'Automated payment reminders and collections';
  
  // Exception Handling
  overdueManagement: 'Escalation procedures for overdue payments';
  serviceManagement: 'Grace periods and service suspension policies';
  disputeResolution: 'Process for billing disputes and adjustments';
}
```

**Invoice Customization Features**:
- **Branded Invoices**: Custom logo, colors, and firm branding
- **Detailed Line Items**: Service breakdown, usage details, and period coverage
- **Purchase Order Integration**: PO number inclusion and reference tracking
- **Custom Terms**: Firm-specific payment terms and conditions
- **Multiple Recipients**: Send to procurement, finance, and legal contacts
- **Audit Trail**: Complete history of invoice generation, delivery, and payment

**Integration with Automatic Billing**:
- **Hybrid Models**: Firms can use both methods (e.g., automatic for base subscription, invoiced for overages)
- **Migration Support**: Easy transition between payment methods
- **Backup Payment**: Automatic payment as fallback for failed invoiced payments
- **Usage Tracking**: Consistent usage monitoring regardless of payment method

---

## 8. Integrations

**Purpose**: Connect with existing practice management systems and legal technology stack.

### Data Structure
```typescript
interface Integrations {
  firmId: string;
  
  connectedSystems: {
    integrationId: string;    // ULID
    
    // System Information
    systemType: IntegrationSystem;
    systemName: string;       // "Clio", "MyCase", "PracticePanther"
    version?: string;
    
    // Connection Details
    status: 'active' | 'inactive' | 'error' | 'pending';
    authType: 'oauth2' | 'api_key' | 'webhook' | 'manual';
    credentials: EncryptedCredentials;
    
    // Configuration
    settings: {
      autoExport: boolean;
      exportFormat: 'json' | 'xml' | 'csv';
      exportSchedule?: string;  // Cron expression
      fieldMapping: Record<string, string>; // Lexara field -> System field
      filterCriteria: {
        practiceAreas?: string[];
        matterTypes?: string[];
        minimumValue?: number;
      };
    };
    
    // Data Sync
    lastSyncAt?: Date;
    syncStatus: 'success' | 'error' | 'in_progress';
    syncErrors: string[];
    recordsSynced: number;
    
    // Webhooks
    webhookUrl?: string;
    webhookEvents: WebhookEvent[];
    webhookSecret: string;
    
    // Metadata
    connectedAt: Date;
    connectedBy: string;      // userId
    lastModified: Date;
  }[];
  
  // Export Preferences
  defaultExportSettings: {
    format: 'json' | 'xml' | 'csv' | 'pdf';
    includeConversation: boolean;
    includeDocuments: boolean;
    includeAnalytics: boolean;
    customFields: Record<string, string>;
  };
  
  // Integration Wishlist
  requestedIntegrations: {
    systemName: string;
    priority: 'high' | 'medium' | 'low';
    requestedBy: string;
    requestedAt: Date;
    businessJustification: string;
  }[];
}

type IntegrationSystem = 
  | 'clio' | 'mycase' | 'practicepanther' | 'smokeball' | 'lawmatics'
  | 'filevine' | 'actionstep' | 'cosmolex' | 'aderant' | 'elite'
  | 'salesforce' | 'hubspot' | 'pipedrive' | 'zoho' | 'custom_crm'
  | 'quickbooks' | 'xero' | 'freshbooks' | 'sage' | 'custom_accounting'
  | 'outlook' | 'gmail' | 'slack' | 'teams' | 'zapier' | 'webhook';

type WebhookEvent = 
  | 'conversation.completed' | 'conversation.assigned' | 'conflict.detected'
  | 'goal.completed' | 'document.uploaded' | 'user.created';
```

### Functionality Requirements
- **OAuth2 Flows**: Secure authentication with practice management systems
- **Real-time Sync**: Webhook-based data synchronization
- **Field Mapping**: Flexible data transformation between systems
- **Error Handling**: Robust retry logic and error reporting

---

## 9. Conversation History

**Purpose**: Complete audit trail and management of all client interactions.

### Data Structure
```typescript
interface ConversationHistory {
  firmId: string;
  
  conversations: {
    conversationId: string;   // References ConversationSession.sessionId
    
    // Basic Information
    clientName?: string;
    clientEmail?: string;
    practiceArea: LegalPracticeArea;
    matterType?: string;
    
    // Status Tracking
    status: ConversationStatus;
    phase: ConversationPhase;
    assignedTo?: string;      // userId
    reviewedBy?: string;      // userId
    
    // Workflow Management
    followUpRequired: boolean;
    followUpDate?: Date;
    clientContactDeadline?: Date;
    
    // Conflict Information
    conflictStatus: ConflictStatus;
    conflictDetails?: string;
    conflictResolvedBy?: string;
    conflictResolvedAt?: Date;
    
    // Data Quality
    goalsCompleted: number;
    goalsTotal: number;
    dataQualityScore: number; // 0-100
    missingCriticalInfo: string[];
    
    // Review and Disposition
    reviewNotes: string;
    disposition: ConversationDisposition;
    dispositionReason?: string;
    dispositionDate?: Date;
    
    // Integration Status
    exportedTo: string[];     // System names where this was exported
    exportAttempts: {
      system: string;
      attemptedAt: Date;
      status: 'success' | 'failed';
      error?: string;
    }[];
    
    // Metadata
    createdAt: Date;
    lastActivity: Date;
    duration: number;         // Total conversation time in minutes
    tokensUsed: number;       // Total tokens used
    messageCount: number;
    resumeCount: number;      // How many times client resumed
  }[];
  
  // Summary Statistics
  summary: {
    totalConversations: number;
    completedConversations: number;
    averageCompletionTime: number;
    averageDataQuality: number;
    conversionRate: number;   // % that become clients
    topPracticeAreas: string[];
    monthlyTrends: {
      month: string;
      count: number;
          quality: number;
    }[];
  };
}

type ConversationStatus = 
  | 'active' | 'completed' | 'abandoned' | 'conflict_detected'
  | 'under_review' | 'assigned' | 'contacted' | 'converted' | 'declined';

type ConversationDisposition = 
  | 'converted_to_client' | 'referred_out' | 'declined_representation'
  | 'conflict_of_interest' | 'outside_practice_area' | 'insufficient_merit'
  | 'fee_disagreement' | 'geographic_limitation' | 'client_withdrew';
```

### Functionality Requirements
- **Advanced Search and Filtering**: Multi-criteria search across all conversations
- **Bulk Operations**: Mass assignment, export, and status updates
- **Analytics Dashboard**: Visual reporting on conversation metrics
- **Automated Workflows**: Rule-based assignment and follow-up reminders

---

## 10. Assignment Mapping

**Purpose**: Intelligent routing of conversations to appropriate team members based on context and capacity.

### Data Structure
```typescript
interface AssignmentMapping {
  firmId: string;
  
  // Assignment Rules (processed in order)
  rules: {
    ruleId: string;           // ULID
    name: string;
    description: string;
    isActive: boolean;
    priority: number;         // Lower number = higher priority
    
    // Trigger Conditions
    conditions: {
      practiceAreas: LegalPracticeArea[];
      matterTypes: string[];
      keywords: string[];
      estimatedValueMin?: number;
      estimatedValueMax?: number;
      clientLocation?: string[];
      timeOfDay?: TimeRange;
      dayOfWeek?: string[];
      urgencyLevel?: 'urgent' | 'high' | 'normal' | 'low';
    };
    
    // Assignment Targets
    assignmentType: 'individual' | 'group' | 'round_robin' | 'workload_based';
    targetUsers: string[];    // userIds
    targetGroups: string[];   // Practice groups
    
    // Capacity Management
    respectCapacity: boolean;
    overrideIfUrgent: boolean;
    escalationRules: {
      timeLimit: number;      // Minutes before escalation
      escalateTo: string[];   // userIds
    };
    
    // Notification Settings
    notificationMethod: 'email' | 'sms' | 'in_app' | 'all';
    immediateNotification: boolean;
    digestNotification: boolean;
    
    // Metadata
    createdBy: string;
    createdAt: Date;
    lastUsed?: Date;
    usageCount: number;
  }[];
  
  // Default Assignment
  defaultAssignment: {
    fallbackUser: string;     // Default assignee if no rules match
    businessHoursUser: string;
    afterHoursUser: string;
    weekendUser: string;
    vacationBackup: string[];
  };
  
  // Load Balancing
  workloadDistribution: {
    algorithm: 'round_robin' | 'least_busy' | 'weighted' | 'manual';
    weights: Record<string, number>; // userId -> weight
    maxConcurrentCases: Record<string, number>;
    autoRebalance: boolean;
  };
  
  // Escalation Matrix
  escalationChain: {
    level: number;
    timeoutMinutes: number;
    escalateTo: string[];
    notificationMethod: string;
    requiresResponse: boolean;
  }[];
  
  // Performance Tracking
  assignmentMetrics: {
    userId: string;
    averageResponseTime: number;
    conversionRate: number;
    clientSatisfaction: number;
    currentCaseload: number;
    assignmentCount: number;
  }[];
}

interface TimeRange {
  startTime: string;          // "09:00"
  endTime: string;            // "17:00"
  timeZone: string;
}
```

### Functionality Requirements
- **Real-time Assignment**: Immediate routing based on conversation context
- **Capacity Monitoring**: Prevent overload and maintain quality
- **Performance Analytics**: Track assignment effectiveness and team performance
- **Escalation Management**: Automated escalation for unresponded assignments

---

## Additional Categories

### 11. Conflict of Interest Management

**Purpose**: Comprehensive conflict detection and management system.

### Data Structure
```typescript
interface ConflictManagement {
  firmId: string;
  
  // Conflict Database
  conflicts: {
    conflictId: string;       // ULID
    
    // Conflict Details
    type: ConflictType;
    description: string;
    relatedMatter?: string;
    
    // Parties Involved
    primaryParty: ConflictParty;
    relatedParties: ConflictParty[];
    adverseParties: ConflictParty[];
    
    // Scope and Context
    practiceAreas: LegalPracticeArea[];
    jurisdictions: string[];
    dateRange: {
      startDate: Date;
      endDate?: Date;
    };
    
    // Resolution
    status: 'active' | 'resolved' | 'waived' | 'expired';
    resolutionNotes?: string;
    waiverObtained?: boolean;
    waiverDocument?: string;
    
    // Metadata
    addedBy: string;
    addedAt: Date;
    lastReviewed: Date;
    reviewedBy: string;
  }[];
  
  // Conflict Detection Settings
  detectionSettings: {
    strictMode: boolean;
    fuzzyMatching: boolean;
    matchThreshold: number;   // 0-100
    autoResolve: boolean;
    requireManualReview: boolean;
    
    checkFields: {
      names: boolean;
      emails: boolean;
      phones: boolean;
      addresses: boolean;
      businessNames: boolean;
      aliases: boolean;
    };
  };
}

type ConflictType = 
  | 'direct_conflict' | 'positional_conflict' | 'business_conflict'
  | 'family_relationship' | 'former_client' | 'adverse_party'
  | 'referral_source' | 'vendor_relationship' | 'personal_relationship';

interface ConflictParty {
  name: string;
  aliases: string[];
  email?: string;
  phone?: string;
  businessName?: string;
  relationship: string;
}
```

### 12. Brand Customization

**Purpose**: White-label and brand customization for client-facing interfaces.

### Data Structure
```typescript
interface BrandCustomization {
  firmId: string;
  
  // Visual Identity
  branding: {
    logoUrl?: string;
    logoUrlDark?: string;     // Dark mode variant
    faviconUrl?: string;
    
    colors: {
      primary: string;        // Hex color
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    
    fonts: {
      heading: string;
      body: string;
    };
  };
  
  // Messaging
  customization: {
    firmDisplayName: string;
    welcomeMessage: string;
    disclaimers: string[];
    privacyPolicy?: string;
    termsOfService?: string;
    
    // AI Agent Personality
    agentName: string;
    agentTone: 'professional' | 'friendly' | 'formal' | 'conversational';
    agentInstructions: string;
  };
  
  // Client Access URL Configuration
  urlConfiguration: {
    // Primary access method
    accessMethod: 'custom_domain' | 'subdomain' | 'path_based';
    
    // Custom Domain Option (engage.lawfirm.com)
    customDomain?: {
      domain: string;           // "engage.lawfirm.com"
      sslCertificate?: string;  // SSL cert for custom domain
      dnsConfigured: boolean;   // Whether DNS points to our infrastructure
      verificationStatus: 'pending' | 'verified' | 'failed';
      verifiedAt?: Date;
    };
    
    // Subdomain Option (lawfirm.engage.lexara.app)
    subdomain: {
      slug: string;             // "smith-law" for smith-law.engage.lexara.app
      isActive: boolean;
      reservedAt: Date;
    };
    
    // Path-based Option (engage.lexara.app/smith-law)
    pathBased: {
      slug: string;             // "smith-law" for engage.lexara.app/smith-law
      isActive: boolean;
      reservedAt: Date;
    };
    
    // URL Configuration
    primaryUrl: string;         // The main URL clients use to access Engage
    fallbackUrls: string[];     // Alternative URLs that redirect to primary
    redirectOldUrls: boolean;   // Redirect from old URLs after domain changes
    
    // SEO and Marketing
    metaTitle?: string;         // Custom page title for SEO
    metaDescription?: string;   // Custom meta description
    ogImage?: string;           // Open Graph image URL
    customFavicon?: string;     // Custom favicon URL
    
    // Technical Settings
    forceSsl: boolean;          // Force HTTPS redirects
    includeWww: boolean;        // Include www. variant (for custom domains)
    canonicalUrl: string;       // Canonical URL for SEO
  };
}
```

### URL Configuration Options

Law firms have three options for how their clients access the Engage platform, each with different technical requirements and branding benefits:

#### Option 1: Custom Domain (Premium)
**Format**: `engage.{lawfirm-domain}.com` or `intake.{lawfirm-domain}.com`
**Examples**: 
- `engage.smithlaw.com`
- `intake.johnsonpartners.com`
- `consultation.legaleagles.net`

**Benefits**:
- **Maximum Brand Control**: Clients never see Lexara branding in URL
- **Professional Appearance**: Reinforces firm's domain authority
- **SEO Benefits**: Links and references build firm's domain authority
- **Client Trust**: Familiar domain increases client confidence

**Technical Requirements**:
- **DNS Configuration**: Firm must create CNAME record pointing to our infrastructure
- **SSL Certificate**: We manage SSL certificate for the custom domain
- **Domain Verification**: Verification process to confirm domain ownership
- **Subdomain Choice**: Firm chooses subdomain (engage, intake, consultation, etc.)

**Implementation**:
```typescript
// Custom domain setup process
interface CustomDomainSetup {
  step1: 'Choose subdomain (engage, intake, etc.)';
  step2: 'Provide full domain (engage.lawfirm.com)';
  step3: 'Create CNAME record: engage.lawfirm.com -> {generated-cname}.lexara.app';
  step4: 'Verify DNS configuration';
  step5: 'Issue SSL certificate';
  step6: 'Activate custom domain';
}
```

#### Option 2: Lexara Subdomain (Standard)
**Format**: `{firm-slug}.engage.lexara.app`
**Examples**:
- `smith-law.engage.lexara.app`
- `johnson-partners.engage.lexara.app`
- `legal-eagles.engage.lexara.app`

**Benefits**:
- **No DNS Setup Required**: Works immediately upon firm registration
- **Professional Appearance**: Clean, dedicated URL for the firm
- **SSL Included**: Automatic SSL certificate management
- **Easy Setup**: No technical configuration required

**Technical Requirements**:
- **Slug Selection**: Firm chooses unique identifier (validated for availability)
- **Automatic SSL**: Covered by our wildcard certificate
- **Immediate Activation**: Available as soon as firm account is created

**Slug Rules**:
- **Format**: Lowercase letters, numbers, hyphens only
- **Length**: 3-50 characters
- **Uniqueness**: Must be unique across all Lexara customers
- **Reservations**: Some terms reserved (admin, api, www, etc.)

#### Option 3: Path-Based (Basic)
**Format**: `engage.lexara.app/{firm-slug}`
**Examples**:
- `engage.lexara.app/smith-law`
- `engage.lexara.app/johnson-partners`
- `engage.lexara.app/legal-eagles`

**Benefits**:
- **Immediate Setup**: No configuration required
- **Cost Effective**: Included in all plans
- **Full Functionality**: All Engage features available
- **Simple Management**: No domain or DNS considerations

**Technical Requirements**:
- **None**: Works immediately with any plan
- **Slug Selection**: Same rules as subdomain option
- **Shared SSL**: Uses our primary SSL certificate

### URL Management Features

**URL Redirects and SEO**:
- **Automatic HTTPS**: All URLs automatically redirect to HTTPS
- **Canonical URLs**: Proper canonical tags for SEO optimization
- **Old URL Redirects**: Automatic redirects when changing URL configuration
- **Multiple URL Support**: Support for www and non-www variants (custom domains)

**Marketing and Analytics Integration**:
- **UTM Parameter Support**: Track marketing campaign effectiveness
- **Custom Meta Tags**: SEO optimization with firm-specific metadata
- **Open Graph Tags**: Social media sharing optimization
- **Google Analytics Integration**: Track visitor behavior and conversions

**Security and Compliance**:
- **SSL Everywhere**: All options include SSL/TLS encryption
- **HSTS Headers**: HTTP Strict Transport Security for enhanced security
- **Content Security Policy**: Protection against XSS and other attacks
- **GDPR Cookie Compliance**: Automatic cookie consent management

### Technical Implementation

**DNS Configuration (Custom Domains)**:
```
Type: CNAME
Name: engage (or chosen subdomain)
Value: {firm-id}.custom.lexara.app
TTL: 300 (5 minutes)
```

**URL Routing Architecture**:
```typescript
interface URLRouting {
  // Domain resolution
  resolveFirm(hostname: string, path: string): FirmResolution;
  
  // URL generation
  generatePrimaryUrl(firmId: string): string;
  generateFallbackUrls(firmId: string): string[];
  
  // Redirect handling
  handleRedirects(request: Request): Response | null;
  
  // SSL management
  provisionSSL(domain: string): SSLCertificate;
  renewSSL(domain: string): SSLRenewal;
}
```

**Migration Between URL Types**:
- **Seamless Migration**: Firms can upgrade from path-based to subdomain to custom domain
- **Automatic Redirects**: Old URLs automatically redirect to new configuration
- **No Downtime**: URL changes happen without service interruption
- **SEO Preservation**: Proper redirect chains maintain search engine rankings

### 13. Compliance and Audit

**Purpose**: Legal compliance, audit trails, and regulatory requirements.

### Data Structure
```typescript
interface ComplianceManagement {
  firmId: string;
  
  // Data Retention
  retentionPolicies: {
    conversationData: number; // Days to retain
    personalData: number;
    auditLogs: number;
    backups: number;
    
    automaticPurge: boolean;
    clientConsentRequired: boolean;
  };
  
  // Privacy Compliance
  privacySettings: {
    gdprCompliant: boolean;
    ccpaCompliant: boolean;
    pipedaCompliant: boolean;
    
    cookieConsent: boolean;
    dataProcessingConsent: boolean;
    rightToErasure: boolean;
    rightToPortability: boolean;
  };
  
  // Security Requirements
  securityPolicies: {
    mfaRequired: boolean;
    passwordPolicy: PasswordPolicy;
    sessionTimeout: number;   // Minutes
    ipWhitelist: string[];
    
    encryptionAtRest: boolean;
    encryptionInTransit: boolean;
    keyRotationDays: number;
  };
  
  // Audit Configuration
  auditSettings: {
    logAllActions: boolean;
    logRetentionDays: number;
    requireJustification: string[]; // Actions requiring justification
    
    externalAuditing: boolean;
    auditFrequency: 'quarterly' | 'annually';
    nextAuditDate?: Date;
  };
}
```

### 14. Analytics and Reporting

**Purpose**: Business intelligence and performance monitoring.

### Data Structure
```typescript
interface AnalyticsConfiguration {
  firmId: string;
  
  // Dashboard Preferences
  dashboardConfig: {
    defaultTimeRange: '7d' | '30d' | '90d' | '1y';
    defaultMetrics: AnalyticsMetric[];
    customCharts: CustomChart[];
    autoRefresh: boolean;
    refreshInterval: number; // Minutes
  };
  
  // Reporting Schedule
  scheduledReports: {
    reportId: string;
    name: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    recipients: string[];
    format: 'pdf' | 'excel' | 'csv';
    metrics: AnalyticsMetric[];
    filters: ReportFilter[];
    nextRun: Date;
  }[];
  
  // Data Export Preferences
  exportSettings: {
    includePersonalData: boolean;
    anonymizeData: boolean;
    aggregationLevel: 'individual' | 'summary';
    allowedFormats: string[];
  };
}

type AnalyticsMetric = 
  | 'conversation_volume' | 'conversion_rate' | 'response_time'
  | 'data_quality' | 'user_satisfaction' | 'practice_area_distribution'
  | 'geographic_distribution' | 'conflict_rate' | 'assignment_efficiency';
```

---

## Implementation Priority

### Phase 1: Core Infrastructure (Immediate)
1. **Basic Identifying Information** - Foundation for all other data
2. **Practice Areas** - Essential for AI agent behavior
3. **Lawyers and Staff** - User management and access control
4. **Payment Details** - Revenue generation and billing

### Phase 2: AI Enhancement (3-6 months)
5. **Supporting Documentation** - AI customization capabilities
6. **Custom Goals** - Advanced data collection workflows
7. **Conflict Management** - Enhanced conflict detection
8. **Assignment Mapping** - Intelligent case routing

### Phase 3: Business Intelligence (6-12 months)
9. **Conversation History** - Advanced analytics and reporting
10. **Integrations** - Practice management system connectivity
11. **Analytics Configuration** - Business intelligence tools
12. **Brand Customization** - White-label capabilities

### Phase 4: Enterprise Features (12+ months)
13. **Compliance Management** - Enterprise security and audit
14. **Geographic Expansion** - Multi-jurisdiction support
15. **Advanced Workflows** - Complex business process automation

This comprehensive data model provides the foundation for a sophisticated, multi-tenant legal intake platform that can scale from solo practitioners to large law firms while maintaining data isolation, security, and compliance requirements.