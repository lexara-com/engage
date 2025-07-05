# **Engage by Lexara — Final Software Design Document**  
*Version 1.0 — July 3, 2025*

## 1. Introduction

### 1.1 Project Summary
Engage is a cloud-based SaaS solution designed for law firms, providing an AI-powered chatbot to intake potential client cases, automate conflict checks, and streamline the client screening process. Engage reduces the manual overhead of initial client qualification, ensures compliance, and enables firms to customize and brand their intake experience.

### 1.2 Scope
This document covers the design of Engage’s core architecture, data model, authentication, chatbot workflow, customization features, admin dashboard, and testing framework. It includes all backend, frontend, and integration points necessary for a complete implementation.

### 1.3 Objectives
- Automate client intake and screening for law firms.
- Provide a customizable, branded chatbot interface.
- Ensure secure, multi-tenant data isolation and compliance.
- Enable robust admin controls and user management.
- Support scalable, reliable, and testable cloud-native architecture.

### 1.4 Audience
This document is intended for software engineers, QA, DevOps, product managers, and stakeholders involved in the development, deployment, and maintenance of Engage.

### 1.5 Glossary
- **Firm:** A law firm using Engage.
- **User:** A staff member or admin of a firm.
- **Contact:** A potential client interacting with the chatbot.
- **Conversation:** An intake session between the chatbot and a contact.
- **Durable Object:** A Cloudflare construct for stateful, per-conversation logic.
- **D1:** Cloudflare’s serverless SQL database.
- **Vectorize:** Cloudflare’s vector database for semantic search.
- **Auth0:** Third-party authentication provider.

## 2. Stakeholders and Responsibilities

| Name            | Role                | Responsibility                      |
|-----------------|---------------------|-------------------------------------|
| Product Owner   | Requirements, UAT   | Feature specification, acceptance   |
| Lead Engineer   | Technical Lead      | Architecture, code reviews          |
| Backend Dev     | Implementation      | API, D1, Durable Objects            |
| Frontend Dev    | Implementation      | Dashboard, Chatbot UI               |
| QA Engineer     | Testing             | Test plan, automation, regression   |
| DevOps          | Deployment          | CI/CD, environment management       |

## 3. System Architecture

### 3.1 High-Level Architecture Diagram

```
+-------------------+         +-------------------+         
|    Frontend UI    | <-----> |  Cloudflare Worker| <-----> |     D1 Database   |
| (Dashboard/Chatbot|         |   (API Gateway)   |         |  (SQL, Vectorize) |
+-------------------+         +-------------------+         
         |                            |                             |
         |                            v                             |
         |                +-------------------+                    |
         |                | Durable Objects   |                    |
         |                | (Conversations)   |                    |
         |                +-------------------+                    |
         |                            |                             |
         |                            v                             |
         |                +-------------------+                    |
         |                |  Auth0 (OAuth2)   |                    |
         |                +-------------------+                    |
```

### 3.2 Component Descriptions

- **Frontend UI:**  
  - **Dashboard:** Admin interface for firm/user management, conversation review, customization, and data export.
  - **Chatbot:** Branded, embeddable intake widget for potential clients.

- **Cloudflare Worker:**  
  - Serves static assets, routes API requests, enforces authentication, and orchestrates Durable Objects and D1 access.

- **Durable Objects:**  
  - Each conversation is a Durable Object, managing state, chatbot flow, and data collection.

- **D1 Database:**  
  - Stores all metadata: firms, users, contacts, conversations, conflict lists, customization settings, and vector data indexes.

- **Cloudflare Vectorize:**  
  - Stores firm-uploaded intake requirements and supports semantic search for dynamic question generation.

- **Auth0:**  
  - Provides authentication and user management for firm staff and admins.

## 4. Data Design

### 4.1 Database Schema

```sql
CREATE TABLE firms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo_url TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    custom_labels JSON,
    unique_url TEXT NOT NULL UNIQUE
);

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (firm_id) REFERENCES firms(id)
);

CREATE TABLE contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL,
    name TEXT,
    email TEXT,
    phone TEXT,
    resume_token TEXT UNIQUE,
    FOREIGN KEY (firm_id) REFERENCES firms(id)
);

CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL,
    user_id INTEGER,
    contact_id INTEGER NOT NULL,
    durable_object_id TEXT NOT NULL,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    resume_url TEXT,
    FOREIGN KEY (firm_id) REFERENCES firms(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE TABLE conflict_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL,
    entity_name TEXT NOT NULL,
    entity_type TEXT,
    notes TEXT,
    FOREIGN KEY (firm_id) REFERENCES firms(id)
);

CREATE TABLE vector_data_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL,
    document_name TEXT,
    document_type TEXT,
    vector_index_id TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (firm_id) REFERENCES firms(id)
);

CREATE TABLE goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL,
    case_type TEXT,
    goal_data JSON,
    FOREIGN KEY (firm_id) REFERENCES firms(id)
);
```

- **Indexes:**  
  - All tables indexed on `firm_id` for fast multi-tenant queries.
  - Additional indexes on `user_id`, `contact_id` in `conversations`.

### 4.2 Data Flow

- **Firm/User Creation:**  
  - Admin registers firm, adds users.
- **Chatbot Intake:**  
  - Contact initiates conversation at firm’s unique URL.
  - Durable Object manages state, collects data, performs conflict check.
  - Conversation is indexed in D1 for dashboard access.
- **Custom Data Gathering:**  
  - Chatbot queries Vectorize for additional questions based on firm-uploaded requirements.
- **Resume/Export:**  
  - Contact can resume via unique URL; firm can export conversation data.

## ## 5. Authentication and Authorization — Detailed Approach

### 5.1 Overview

Engage uses **Auth0** as its identity provider for all firm user authentication, leveraging OAuth2 and OpenID Connect standards. This ensures secure, standards-based authentication and robust authorization for all dashboard and API interactions. Potential clients (contacts) interact with the chatbot via unique, secure resume URLs and do not require Auth0 authentication.

### 5.2 Auth0 Integration for Firm Users

- **Single Auth0 Tenant, Multi-Tenant SaaS:**  
  All law firms (tenants) and their users are managed within a single Auth0 tenant. Each user’s profile includes a `firm_id` (stored in `app_metadata`) to associate them with their firm and enforce tenant isolation[1][2].
- **OAuth2/OpenID Connect Flows:**  
  Users authenticate via Auth0’s Universal Login, which supports OAuth2 Authorization Code Flow and OpenID Connect for secure, standards-based authentication[3].
- **User Profile Enrichment:**  
  Upon login, the application reads the user’s `firm_id` and role from the Auth0 token claims or `app_metadata` to determine access rights and scope the user’s experience to their firm[1].

### 5.3 API Security and JWT Validation

- **JWT Requirement:**  
  All API endpoints (except those for contact resume URLs) require a valid Auth0-issued JWT in the `Authorization: Bearer <token>` header.
- **JWT Validation:**  
  - The backend (Cloudflare Worker) validates the JWT’s signature using Auth0’s public JWKS endpoint.
  - Checks include signature verification, token expiration (`exp`), not-before (`nbf`), issuer (`iss`), and audience (`aud`) claims[4][5].
  - Only requests with valid, unexpired tokens are processed; others are rejected with a 401 Unauthorized response.
- **Token Scope and Claims:**  
  - The JWT includes claims for `sub` (user ID), `firm_id`, `role`, and any additional permissions.
  - The backend uses these claims to enforce tenant isolation and role-based access control.

### 5.4 Role-Based Access Control (RBAC)

- **Role Assignment:**  
  Each user is assigned a role (e.g., admin, staff) in their Auth0 profile (`app_metadata` or custom claims).
- **Enforcement:**  
  - The backend checks the user’s role claim on every API request.
  - Only users with the appropriate role can perform sensitive actions (e.g., user management, data export, conflict review).
- **Authorization Models:**  
  RBAC is implemented in code, with all access checks scoped by both `firm_id` and `role` to ensure strict tenant isolation and least-privilege access[6].

### 5.5 Contact (Potential Client) Access

- **No Auth0 Required:**  
  Contacts do not authenticate via Auth0. Instead, they interact with the chatbot using a unique, cryptographically secure resume URL/token.
- **Resume Token Security:**  
  - Each conversation generates a unique, hard-to-guess token (stored in D1 and referenced in the resume URL).
  - The backend validates the token on each request to ensure only the intended contact can access or resume their conversation.
- **Limited Scope:**  
  Contacts can only access their own conversation and cannot view or modify any firm or user data.

### 5.6 Security Best Practices

- **HTTPS Everywhere:**  
  All authentication and API traffic is encrypted via HTTPS/TLS[3][7].
- **Short-Lived Tokens:**  
  JWTs have short expiration times and are refreshed as needed to minimize risk if compromised[3].
- **Token Revocation:**  
  Support for token revocation and logout flows to immediately invalidate sessions if needed.
- **Audit Logging:**  
  All authentication and authorization events are logged for monitoring and compliance.

### 5.7 Multi-Tenant Considerations

- **Tenant Isolation:**  
  All user and data access is scoped by `firm_id` at every layer (database, API, UI).
- **User-to-Tenant Mapping:**  
  The application reads the `firm_id` from the JWT or user profile to ensure users only access their own firm’s data[1][2].
- **Support for Multiple Roles and Memberships:**  
  Users can belong to multiple firms if needed, with the application context switching based on the selected `firm_id`[8].

### 5.8 Summary Table: Authentication and Authorization Flows

| Actor         | Auth Method         | Token/ID Used         | Access Scope                | Security Enforcement         |
|---------------|--------------------|-----------------------|-----------------------------|------------------------------|
| Firm User     | Auth0 (OAuth2/OIDC)| JWT (Bearer)          | Firm data, dashboard, API   | JWT validation, RBAC, firm_id|
| Contact       | None (resume URL)  | Resume token (UUID)   | Own conversation only       | Token validation, limited scope|

### 5.9 Implementation Notes

- **JWT validation** can be performed in Cloudflare Workers using libraries or Cloudflare’s API Shield JWT validation features[4][9][5].
- **Auth0 configuration** should include proper audience, issuer, and JWKS settings for secure token validation.
- **RBAC logic** should be centralized and thoroughly tested to prevent privilege escalation or data leakage.

This approach ensures robust, scalable, and secure authentication and authorization for all users and API interactions in Engage, while providing a seamless, low-friction experience for potential clients.

Sources
[1] Multi-Tenant Applications Best Practices - Auth0 https://auth0.com/docs/get-started/auth0-overview/create-tenants/multi-tenant-apps-best-practices
[2] How to Use Auth0 for B2B Multi/Single-Tenant SaaS Solutions https://auth0.com/blog/using-auth0-for-b2b-multi-and-single-tenant-saas-solutions/
[3] Securing APIs with OAuth 2.0 and OpenID Connect https://www.momentslog.com/development/web-backend/securing-apis-with-oauth-2-0-and-openid-connect
[4] Configure JWT validation · Cloudflare API Shield docs https://developers.cloudflare.com/api-shield/security/jwt-validation/configure/
[5] JSON Web Tokens validation - API Shield https://developers.cloudflare.com/api-shield/security/jwt-validation/
[6] How to Choose the Right Authorization Model for Your Multi-Tenant ... https://auth0.com/blog/how-to-choose-the-right-authorization-model-for-your-multi-tenant-saas-application/
[7] Using OAuth 2.0 and OpenID Connect to Secure Your API https://apistandards.digital.health.nz/api-security/SecuringAPIswithOAuth2andOpenIDConnect/
[8] Demystifying Multi-Tenancy in a B2B SaaS Application - Auth0 https://auth0.com/blog/demystifying-multi-tenancy-in-b2b-saas/
[9] Protecting APIs with JWT Validation https://blog.cloudflare.com/protecting-apis-with-jwt-validation/
[10] Approach to a multi-tenant enterprise app https://community.auth0.com/t/approach-to-a-multi-tenant-enterprise-app/25137
[11] Handling RBAC for a Multi-Tenant SaaS Platform - Auth0 Community https://community.auth0.com/t/handling-rbac-for-a-multi-tenant-saas-platform/99136
[12] How OpenID Connect Works - OpenID Foundation https://openid.net/developers/how-connect-works/
[13] Managing authentication and authorization between services - Edge Computing with Cloudflare Workers: Building Fast, Global Serverless Applications https://app.studyraid.com/en/read/14352/488233/managing-authentication-and-authorization-between-services
[14] Auth0 Management API: Basics, Tutorial, and 5 Best Practices https://frontegg.com/blog/auth0-management-api-basics-tutorial-and-5-best-practices
[15] Best Approach for Multi-Tenant Authentication in Auth0? Post https://community.auth0.com/t/best-approach-for-multi-tenant-authentication-in-auth0-post/184116
[16] OAuth 2.0 and OpenID Connect overview - Okta Developer https://developer.okta.com/docs/concepts/oauth-openid/
[17] Multiple Organization Architecture - Auth0 https://auth0.com/docs/get-started/architecture-scenarios/multiple-organization-architecture
[18] Authentication | Swagger Docs https://swagger.io/docs/specification/v3_0/authentication/
[19] Configure the Worker for JWT validation - API Shield https://developers.cloudflare.com/api-shield/security/jwt-validation/jwt-worker/
[20] Multi-tenant SaaS authorization and API access control: Implementation options and best practices https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-api-access-authorization/introduction.html


## 6. Chatbot Conversation Workflow

### 6.1 Goals and Flow

1. **Contact Details:**  
   - Collects name, email, phone, and other identifiers.
2. **Case Details:**  
   - Gathers the reason for inquiry and case specifics.
3. **Conflict of Interest Check:**  
   - Checks contact details against firm’s conflict list in D1.
4. **Additional Details:**  
   - Uses Vectorize to determine and prompt for further details based on firm-uploaded requirements.

### 6.2 Durable Object Lifecycle

- Each conversation is a Durable Object, referenced in D1.
- Durable Object manages state transitions, data validation, and conversation history.
- Upon completion, conversation data is persisted and indexed.

## 7. Customization and Branding

- **Firm Customization:**  
  - Logo, colors, and custom labels/wording stored in `firms` table.
  - Chatbot UI loads and applies these settings dynamically.
- **Data Gathering Goals:**  
  - Firms define/edit goals per case type in the dashboard, stored in `goals` table.

## 8. Unique URLs — Detailed Design

### 8.1 Overview

Engage uses unique, secure URLs to facilitate both firm-specific chatbot access and seamless client (contact) experience. This approach supports multi-tenancy, branding, and privacy, while enabling contacts to resume their intake process at any time.

### 8.2 Firm Chatbot URL

**Purpose:**  
Provides each law firm with a dedicated, branded entry point for their AI chatbot, which can be shared, embedded, or linked from the firm’s website and communications.

**Structure:**  
- Format: `https://engage.lexara.app/{firm-slug}`
- `{firm-slug}` is a unique, URL-safe identifier for each firm (e.g., `smithlaw`, `johnson-partners`).
- The slug is generated during firm onboarding and stored in the `firms` table as `unique_url`.

**Features:**
- **Branding:** The chatbot UI loads firm-specific branding (logo, colors, labels) based on the slug.
- **Multi-Tenancy:** Ensures strict data isolation; only the requesting firm’s data and configuration are accessible.
- **Embeddability:** The URL can be used in iframes, pop-ups, or direct links from the firm’s website, email, or social media.
- **SEO and Analytics:** Firms can track engagement and usage via their unique URL.

**Security Considerations:**
- Only public, non-sensitive information is accessible at this URL until a conversation is initiated.
- All data collected is scoped to the firm identified by the slug.

### 8.3 Contact Resume URL

**Purpose:**  
Allows potential clients (contacts) to pause and later resume their chatbot conversation securely, without requiring an account or login.

**Structure:**  
- Format: `https://engage.lexara.app/{firm-slug}/resume/{resume-token}`
- `{resume-token}` is a cryptographically secure, unique token (e.g., UUIDv4 or similar), generated per conversation and stored in the `conversations` table as `resume_url` or `resume_token`.

**Features:**
- **Session Continuity:** Contacts can return to their conversation at any time using the resume URL, from any device.
- **No Authentication Required:** Contacts do not need to register or log in; possession of the unique URL is sufficient.
- **Privacy:** The resume token is unguessable and not derived from personal information, ensuring only the intended contact can access the conversation.
- **Expiration/Revocation:** Optionally, resume tokens can have expiration times or be revoked by the firm for added security.

**Security Considerations:**
- The backend validates the resume token and firm slug on every request to ensure the contact can only access their own conversation.
- Resume URLs are only shared with the contact (e.g., via email or on-screen prompt) and are not indexed or discoverable.

### 8.4 Implementation Details

| URL Type            | Example URL                                         | Generated/Stored In         | Access Control                | Notes                                  |
|---------------------|-----------------------------------------------------|-----------------------------|-------------------------------|----------------------------------------|
| Firm Chatbot URL    | `https://engage.lexara.app/smithlaw`                | `firms.unique_url`          | Public (firm-specific config) | Used for all new intakes               |
| Contact Resume URL  | `https://engage.lexara.app/smithlaw/resume/abc123`  | `conversations.resume_url`  | Token-based (unguessable)     | Only contact with token can access     |

### 8.5 Workflow

1. **Firm Onboarding:**  
   - Firm admin selects or is assigned a unique slug.
   - URL is generated and provided for embedding or sharing.

2. **Contact Intake:**  
   - Contact visits firm’s chatbot URL and begins a conversation.
   - Upon starting, a unique resume token is generated and stored.
   - Contact is shown the resume URL and optionally sent it via email/SMS.

3. **Resuming Conversation:**  
   - Contact accesses the resume URL.
   - Backend validates the token and loads the conversation state.

4. **Security and Expiry:**  
   - Resume tokens can be set to expire after a period of inactivity or upon conversation completion.
   - Firms can revoke tokens if needed (e.g., for privacy or compliance).

### 8.6 Best Practices

- **Token Generation:** Use cryptographically secure random generators for resume tokens.
- **URL Safety:** Ensure all slugs and tokens are URL-safe and validated.
- **User Guidance:** Clearly instruct contacts to save their resume URL and explain its importance.
- **Monitoring:** Log access to resume URLs for audit and security purposes.

This approach ensures a seamless, secure, and branded experience for both law firms and their potential clients, supporting Engage’s goals of usability, privacy, and multi-tenant scalability.

Sources

## ## 9. Admin Dashboard Features — Detailed Design

The Engage admin dashboard is the central control panel for law firm administrators and staff. It provides secure, role-based access to all firm-specific data and configuration, supporting efficient management, compliance, and customization. Below is an expanded breakdown of each core function.

### 9.1 Firm Management

**Purpose:**  
Enable firm admins to manage their organization’s identity, branding, and key settings.

**Key Features:**
- **Edit Firm Details:**  
  - Update firm name, address, contact information, and registration details.
- **Branding Customization:**  
  - Upload/change firm logo.
  - Select primary and secondary colors for the chatbot and dashboard UI.
  - Preview branding changes in real time.
- **Custom Labels and Wording:**  
  - Edit text for chatbot prompts, button labels, and notifications to match firm tone and terminology.
- **Unique URL Management:**  
  - View and copy the firm’s unique chatbot URL for sharing or embedding.

**Access Control:**  
Only users with the admin role can modify firm-wide settings and branding.

### 9.2 User Management

**Purpose:**  
Allow firm admins to control access, assign roles, and maintain user records.

**Key Features:**
- **Add Users:**  
  - Invite new users by email, assign initial roles (admin, staff, etc.).
- **Edit User Details:**  
  - Update user names, roles, and status (active/inactive).
- **Remove Users:**  
  - Deactivate or permanently remove users from the firm.
- **Role Assignment:**  
  - Change user roles to control access to sensitive features.
- **Audit User Activity:**  
  - View user activity logs for compliance and security monitoring.

**Access Control:**  
Admins can manage all users; staff may have limited visibility or self-service options.

### 9.3 Conversation Management

**Purpose:**  
Provide a comprehensive view and control over all client intake conversations.

**Key Features:**
- **List Conversations:**  
  - Filter and search by contact, date, status, or assigned user.
- **View Conversation Details:**  
  - Access full conversation transcripts, metadata, and status.
- **Export Conversations:**  
  - Download conversation data (e.g., PDF, CSV, JSON) for record-keeping or case management.
- **Delete Conversations:**  
  - Permanently remove conversations, with confirmation and audit logging.
- **Resume Links:**  
  - View and copy contact resume URLs for support or follow-up.

**Access Control:**  
Admins and authorized staff can view and manage conversations; export and delete actions may be restricted to admins.

### 9.4 Conflict Review

**Purpose:**  
Ensure ethical compliance by reviewing potential conflicts of interest identified during intake.

**Key Features:**
- **View Conflict Checks:**  
  - See all entities and parties checked for conflicts in each conversation.
- **Conflict Results:**  
  - Highlight matches or potential issues, with supporting notes and context.
- **Review History:**  
  - Track when and by whom conflict checks were performed.
- **Override/Resolve:**  
  - Allow authorized users to mark conflicts as resolved or add explanatory notes.

**Access Control:**  
Only users with appropriate permissions (typically admins or compliance officers) can review and resolve conflicts.

### 9.5 Vector Data Management

**Purpose:**  
Manage the documents and data that power dynamic, context-aware chatbot questioning.

**Key Features:**
- **Upload Documents:**  
  - Add new intake requirement documents (PDF, DOCX, text) for semantic search.
- **Update Meta**  
  - Edit document names, types, and associated case types.
- **Remove Documents:**  
  - Delete outdated or incorrect documents from the vector store.
- **Indexing Status:**  
  - View processing and indexing status for each document.

**Access Control:**  
Admins manage all vector data; staff may have upload or view-only permissions as configured.

### 9.6 Goal Customization

**Purpose:**  
Enable firms to tailor the chatbot’s data-gathering process for different case types and practice areas.

**Key Features:**
- **Edit Goals:**  
  - Modify the sequence and content of data-gathering goals (e.g., contact details, case details, custom questions).
- **Add New Goals:**  
  - Define new goals for emerging case types or firm-specific needs.
- **Preview and Test:**  
  - Simulate chatbot flows with updated goals before publishing.
- **Versioning:**  
  - Track changes and revert to previous goal configurations if needed.

**Access Control:**  
Admins and designated staff can customize goals; all changes are logged for audit purposes.

### 9.7 Usability and Security Considerations

- **Role-Based Access:**  
  All dashboard features are protected by strict role-based access control, ensuring users only see and modify what they are authorized to.
- **Audit Logging:**  
  All critical actions (user changes, data exports, deletions, conflict resolutions) are logged for compliance and traceability.
- **Responsive Design:**  
  The dashboard is accessible on desktop and mobile devices for flexibility.
- **Help and Support:**  
  Contextual help, tooltips, and support links are available throughout the dashboard.

**Summary Table: Admin Dashboard Features**

| Feature                | Key Actions                                      | Access Level      | Audit Logged |
|------------------------|--------------------------------------------------|-------------------|--------------|
| Firm Management        | Edit details, branding, labels, URL              | Admin             | Yes          |
| User Management        | Add/edit/remove users, assign roles              | Admin             | Yes          |
| Conversation Management| List/view/export/delete conversations            | Admin/Staff       | Yes          |
| Conflict Review        | View/resolve conflicts, add notes                | Admin/Compliance  | Yes          |
| Vector Data Management | Upload/update/remove documents                   | Admin/Staff*      | Yes          |
| Goal Customization     | Edit/add goals, preview/test, versioning         | Admin/Staff*      | Yes          |

*Staff permissions are configurable per firm.

This detailed breakdown ensures the Engage admin dashboard is both powerful and intuitive, supporting secure, compliant, and efficient firm operations.

Sources


## 10. Security and Compliance

- **Tenant Isolation:**  
  - All data access scoped by `firm_id`.
- **Data Protection:**  
  - Encryption in transit and at rest.
- **Access Control:**  
  - Only authorized users can access or modify firm data.
- **Audit Logs:**  
  - Track key actions (login, data export, conflict checks).
- **Compliance:**  
  - GDPR and regional privacy requirements are considered in data handling and user rights.

## ## 11. Testing and Quality Assurance (Expanded)

### 11.1 Testing Philosophy and Requirements

- **Comprehensive Coverage:**  
  Every function, method, and business logic branch in the codebase must have corresponding automated tests. No code should be considered complete or ready for deployment without proven, repeatable tests that verify its correctness.

- **Proof of Functionality:**  
  For every new feature or change, tests must demonstrate:
  - The new functionality works as intended.
  - All previously existing features continue to work (no regressions).
  - Edge cases, error conditions, and invalid inputs are handled gracefully.

- **Continuous Verification:**  
  The test suite must be run:
  - Locally by developers before submitting code.
  - Automatically on every commit and pull request via the CI/CD pipeline.
  - After any dependency or environment change.

- **Test-Driven Mindset:**  
  Writing tests is not optional or an afterthought. Tests should be written alongside or before implementation, serving as both documentation and a safety net.

### 11.2 Test Framework and Execution

- **Vitest** is the standard for all unit, integration, and regression tests.
- All tests are executed against `dev.console.lexara.app` to ensure real-world authentication and environment parity.
- **Unit Tests:**  
  - Mock external dependencies (e.g., Auth0, database).
  - Test every function in isolation, including all input variations and error paths.
- **Integration Tests:**  
  - Use real Auth0 tokens and live endpoints.
  - Test interactions between components (API, Durable Objects, D1).
  - Validate data flows and multi-step processes.
- **Regression Tests:**  
  - Automate full user journeys and critical workflows.
  - Ensure that new changes do not break existing features.

### 11.3 Test Organization and Structure

```
/tests
  /unit
    db_firm.test.ts           # CRUD and validation for firm data
    db_user.test.ts           # User management logic
    db_conversation.test.ts   # Conversation state and persistence
    utils_conflict.test.ts    # Conflict check algorithms
    ...                       # Additional utility and helper tests
  /integration
    firm_user_flow.test.ts    # End-to-end firm and user onboarding
    conversation_flow.test.ts # Full chatbot session lifecycle
    api_endpoints.test.ts     # All REST/GraphQL endpoints
    ...                       # Additional cross-component tests
  /regression
    regression_suite.test.ts  # Key user journeys, API contracts, and UI flows
```

- **Naming Conventions:**  
  Test files should clearly indicate the component or feature under test.
- **Test Coverage:**  
  Coverage reports must be generated and reviewed regularly. The goal is 100% coverage for all critical paths, with no untested code in production.

### 11.4 Execution and Reporting

- All tests are runnable via a single CLI command (e.g., `npx vitest`), producing:
  - Clear pass/fail output.
  - Detailed error messages and stack traces for failures.
  - Coverage summaries highlighting untested code.
- Test results are integrated into the CI/CD pipeline, blocking merges if any test fails or coverage drops below the required threshold.

### 11.5 Maintenance and Best Practices

- **Tests as Documentation:**  
  Well-written tests serve as living documentation for how each function and feature is expected to behave.
- **Refactoring with Confidence:**  
  Any code change must be accompanied by updated or new tests, ensuring that the system remains stable and reliable.
- **Regression Prevention:**  
  The regression suite must be updated with every new feature or bug fix to prevent reintroduction of old issues.
- **Peer Review:**  
  All test code is subject to the same code review standards as production code.

### 11.6 Summary Table: Test Types and Requirements

| Test Type   | Scope                    | Requirements                                     | Tool/Framework                        |
|-------------|--------------------------|--------------------------------------------------|---------------------------------------|
| Unit        | Individual functions     | 100% coverage, all branches and error paths      | Vitest                                |
| Integration | Component interactions   | Real tokens, live endpoints, data flow checks    | Vitest                                |
| Regression  | End-to-end user journeys | Full workflow automation, no regressions allowed | Vitest, Playwright (see section 11.7) |

**In summary:**  
Testing is a first-class requirement. Every function must be tested, every new feature must be proven to work, and the entire system must be continuously verified to ensure reliability, security, and maintainability as Engage evolves.

Sources
## 11.7 End-to-End Testing with Playwright and Auth0

### Overview

This section describes how Engage leverages Playwright for robust end-to-end (E2E) testing, including full automation of the Auth0 authentication flow. This ensures that all user-facing features, including those protected by OAuth2 authentication, are continuously verified in real-world scenarios.

### Why Playwright

- **Full Browser Automation:** Playwright can interact with the application as a real user would, including navigating through Auth0’s Universal Login, handling redirects, and filling out forms.
- **Cross-Browser Support:** Tests can be run across Chromium, Firefox, and WebKit for comprehensive coverage.
- **Session Management:** Playwright supports saving and reusing authenticated sessions, speeding up test execution and reducing redundant logins.

### Auth0 Login Automation

#### 1. Automating the Login Flow

- Playwright scripts navigate to the application’s login page and trigger the Auth0 login process.
- The script fills in the Auth0 login form with test credentials, handles any required multi-factor authentication, and waits for the application to confirm successful login.
- All redirects and security checks are handled automatically, ensuring the test environment matches real user behavior.

#### 2. Saving and Reusing Authenticated Sessions

- After a successful login, Playwright saves the browser’s authenticated state (cookies, local storage) to a file using the `storageState` feature.
- Subsequent tests can load this state, allowing them to start with an authenticated session and bypass the login UI for faster execution.
- This approach is especially useful for running large test suites or for CI environments.

#### 3. Global Setup for Authentication

- A global setup script performs the login once before the test suite runs, saving the session state for all tests.
- This ensures consistency and reduces the risk of rate limiting or test flakiness due to repeated logins.

#### 4. Handling Edge Cases

- Playwright can automate advanced authentication scenarios, such as two-factor authentication or passwordless login, by interacting with all necessary UI elements.
- For tests that do not require real authentication, session state or tokens can be mocked as needed.

### Example Workflow

1. **Login Automation:**
   - Navigate to the login page.
   - Click the login button to initiate Auth0 authentication.
   - Fill in the Auth0 form with test credentials.
   - Handle any additional authentication steps.
   - Wait for the application to confirm authentication.

2. **Save Authenticated State:**
   - Use Playwright’s `storageState` to save the session to a file (e.g., `auth.json`).

3. **Reuse State in Tests:**
   - Configure tests to load the saved state, ensuring all tests start with an authenticated context.

### Best Practices

- Use dedicated test accounts in Auth0 to avoid affecting production data.
- Store session state files securely and exclude them from version control.
- Automate login in a global setup script to keep tests fast and reliable.
- Combine UI-based login automation with session reuse for efficiency.
- Mock Auth0 only for unit or integration tests where full E2E coverage is not required.

### Sample Playwright Test Structure

```
/e2e
  global-setup.ts      # Handles Auth0 login and saves session state
  login.spec.ts        # Verifies login flow
  dashboard.spec.ts    # Tests dashboard features with authenticated session
  conversation.spec.ts # Tests chatbot and conversation flows
  ...
```

### Summary Table: Playwright Capabilities

| Capability                        | Supported | Notes                                      |
|------------------------------------|-----------|--------------------------------------------|
| Automate Auth0 login UI            | Yes       | Handles redirects, form fill, 2FA, etc.    |
| Save/reuse authenticated session   | Yes       | Use `storageState` for session management  |
| Test with real Auth0 tokens        | Yes       | Supports full E2E flows                    |
| Mock/bypass Auth0 for speed        | Yes       | Optional for non-E2E tests                 |

### Integration with CI/CD

- Playwright tests are integrated into the CI/CD pipeline.
- The global setup script ensures all tests run with a valid authenticated session.
- Test failures block deployments, ensuring only fully verified code is released.

### Security Considerations

- All test credentials and session state files must be managed securely.
- Never commit sensitive data to version control.
- Use environment variables for all secrets and test account credentials.

By adopting Playwright for E2E testing, Engage ensures that all critical user journeys—including those requiring Auth0 authentication—are continuously validated, providing confidence in both new and existing functionality.

Sources


## 12. Error Handling and Recovery

- **API and UI:**  
  - All errors return clear, actionable messages.
- **Durable Objects:**  
  - Handle network and state errors gracefully, with recovery or retry logic.
- **Database:**  
  - Enforce constraints and validate inputs to prevent corrupt data.
- **Logging:**  
  - All errors and exceptions are logged for monitoring and debugging.

## 13. Dependencies and Assumptions

- **Dependencies:**  
  - Cloudflare Workers, Durable Objects, D1, Vectorize, Auth0, Vitest, Wrangler.
- **Assumptions:**  
  - All firms and users are registered via the dashboard.
  - Contacts do not require authentication; security is via resume tokens.
  - All data is accessed via API; no direct database access.

## 14. Planned Changes and Version Control

- **Change Log:**  
  - Maintain a versioned change log with rationale for updates.
- **Future Enhancements:**  
  - Advanced analytics, more granular permission roles, expanded API for third-party integrations.

## 15. Appendices

- **References:**  
  - Cloudflare documentation, Auth0 integration guides, GDPR compliance resources.
- **Supporting Diagrams:**  
  - ERDs, flowcharts, UI wireframes (to be attached in project repository).

**This document serves as the single source of truth for the design and implementation of Engage by Lexara.**  
It should be updated as the project evolves and referenced throughout the build, test, and deployment lifecycle.

*Prepared for the Engage engineering team — July 3, 2025*

Sources
**Engage by Lexara — Final Software Design Document**  
*Version 1.0 — July 3, 2025*

## 
