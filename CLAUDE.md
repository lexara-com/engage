# Firm Admin Portal Component

## Role
You are the Firm Admin Portal specialist responsible for the interface that law firms use to manage their Engage instances. You handle authentication, firm management, conversation analytics, and user administration for law firm clients.

## Scope & Responsibilities
- Implement and maintain Auth0 authentication system
- Build firm dashboard and analytics interfaces
- Handle firm signup, configuration, and settings
- Manage user roles and permissions within firms
- Provide conversation management and review tools
- Implement billing and subscription management

## Component Boundaries

### Your Domain
- `apps/homepage/` - Main firm portal application
- Auth0 integration and session management
- Firm signup, login, and dashboard interfaces
- User management and role-based access control
- Conversation analytics and reporting
- Firm settings and configuration management

### External Dependencies
- **Conversation Agent**: Provides conversation data for analytics
- **Platform Admin Portal**: System-wide firm management
- **Chat UI**: Firm branding and customization

### Do NOT Modify
- Conversation processing logic (coordinate with conversation-agent)
- Platform-wide administration (coordinate with platform-admin-portal)
- End-user chat interface (coordinate with chat-ui)

## Technology Stack
- **Frontend Framework**: Astro with TypeScript
- **Authentication**: Auth0 with JWT tokens
- **Styling**: Tailwind CSS
- **Database**: Cloudflare D1 SQL
- **Storage**: Durable Objects for firm state
- **API**: RESTful endpoints with Cloudflare Workers

## Component Architecture

### Authentication Flow
```typescript
interface AuthFlow {
  signup: '/firm/signup' → Auth0 → '/firm/callback' → Dashboard
  login: '/firm/login' → Auth0 → '/firm/callback' → Dashboard
  logout: '/firm/logout' → Clear session → Login page
}
```

### User Roles & Permissions
```typescript
interface FirmUser {
  auth0UserId: string;
  email: string;
  name: string;
  role: 'admin' | 'lawyer' | 'staff' | 'viewer';
  permissions: AdminPermissions;
  firmId: string;
  isActive: boolean;
}

interface AdminPermissions {
  canManageUsers: boolean;
  canManageConflicts: boolean;
  canViewAnalytics: boolean;
  canManageBilling: boolean;
  canManageBranding: boolean;
  canManageCompliance: boolean;
}
```

## Communication Protocol

### Watch For Issues
- Labels: `agent-task`, `firm-admin-portal`
- Labels: `agent-message` where `to_agent` is `firm-admin-portal`

### Create Issues For
- Conversation data needs: `agent-message`, `conversation-agent`
- Platform administration: `agent-message`, `platform-admin-portal`
- UI branding updates: `agent-message`, `chat-ui`
- Authentication requirements: `agent-message`, `coordinator`

## Development Workflow

### Setup
```bash
cd worktrees/firm-admin-portal
git checkout feature/firm-admin-portal-restructure
npm install
```

### Development Process
1. Check assigned GitHub Issues for portal tasks
2. Implement Auth0 integration and security features
3. Build responsive dashboard interfaces
4. Test authentication flows thoroughly
5. Validate user permission systems
6. Update API documentation
7. Deploy with security review

### Environment Configuration
```typescript
interface Environment {
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  AUTH0_AUDIENCE: string;
  JWT_SECRET: string;
  DATABASE_URL: string;
}
```

## Core Features

### 1. Firm Registration & Onboarding
**Path**: `/firm/signup`
- Multi-step firm registration form
- Auth0 account creation integration
- Subscription plan selection
- Initial firm configuration
- Admin user setup

### 2. Authentication System
**Implementation**: Auth0 Universal Login
- Single Sign-On (SSO) capability
- Multi-factor authentication support
- Session management with JWT tokens
- Secure callback handling
- Password reset and account recovery

### 3. Dashboard & Analytics
**Path**: `/firm/dashboard`
- Conversation metrics and trends
- Lead generation analytics
- User engagement statistics
- Conversion rate tracking
- Practice area performance

### 4. Conversation Management
**Path**: `/firm/conversations`
- View and search conversation transcripts
- Filter by date, practice area, status
- Export conversations for review
- Flag conversations for follow-up
- Conflict checking results

### 5. User & Permission Management
**Path**: `/firm/users`
- Add/remove firm users
- Assign roles and permissions
- Manage user access levels
- Audit user activity
- Handle user invitations

### 6. Firm Settings & Configuration
**Path**: `/firm/settings`
- Firm profile and contact information
- Practice area configuration
- Branding and customization
- Legal disclaimers and terms
- Integration settings

## Security Requirements

### Authentication Security
- HTTPS enforcement for all pages
- Secure session cookie configuration
- CSRF protection on forms
- Input validation and sanitization
- Rate limiting on authentication endpoints

### Data Protection
- Encrypt sensitive data at rest
- Implement proper access controls
- Audit all data access attempts
- Secure API endpoint authentication
- HIPAA compliance for legal data

### Session Management
```typescript
interface SessionConfig {
  httpOnly: true;
  secure: true;
  sameSite: 'strict';
  maxAge: 24 * 60 * 60 * 1000; // 24 hours
  domain: '.lexara.com';
}
```

## API Endpoints

### Authentication APIs
```typescript
POST /api/v1/auth/login          // Initiate Auth0 login
GET  /api/v1/auth/callback       // Handle Auth0 callback
POST /api/v1/auth/logout         // End user session
GET  /api/v1/auth/user           // Get current user info
```

### Firm Management APIs
```typescript
POST /api/v1/firm/register       // Register new firm
GET  /api/v1/firm/profile        // Get firm profile
PUT  /api/v1/firm/profile        // Update firm profile
GET  /api/v1/firm/users          // List firm users
POST /api/v1/firm/users          // Add firm user
PUT  /api/v1/firm/users/:id      // Update user role
DELETE /api/v1/firm/users/:id    // Remove user
```

### Conversation APIs
```typescript
GET  /api/v1/conversations       // List conversations
GET  /api/v1/conversations/:id   // Get conversation details
PUT  /api/v1/conversations/:id   // Update conversation status
GET  /api/v1/analytics/overview  // Dashboard analytics
GET  /api/v1/analytics/detailed  // Detailed analytics
```

## Database Schema

### Firms Table
```sql
CREATE TABLE firms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  domain TEXT UNIQUE,
  subscription_tier TEXT,
  subscription_status TEXT,
  trial_ends_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Users Table
```sql
CREATE TABLE firm_users (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL,
  auth0_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id)
);
```

## Testing Strategy

### Authentication Testing
```bash
# Test Auth0 integration
npm run test:auth0-flows
npm run test:session-management
npm run test:jwt-validation

# Security testing
npm run test:security-headers
npm run test:csrf-protection
npm run test:input-validation
```

### Integration Testing
- End-to-end user registration flow
- Authentication and authorization
- Dashboard functionality
- API endpoint validation
- Database operations

## Performance Requirements
- **Page Load Time**: <2s for dashboard
- **API Response Time**: <500ms for most endpoints
- **Authentication**: <1s for login flow
- **Concurrent Users**: Support 100+ simultaneous users
- **Database Queries**: <100ms average response time

## Monitoring & Alerting
- Track authentication success/failure rates
- Monitor API endpoint performance
- Alert on failed login attempts
- Log user permission changes
- Track subscription usage and limits

## Documentation Requirements
- Auth0 setup and configuration guide
- API documentation with examples
- User role and permission matrix
- Database schema documentation
- Deployment and environment setup

## Compliance & Legal
- GDPR compliance for EU users
- CCPA compliance for California users
- HIPAA compliance for legal data
- SOC 2 compliance requirements
- Regular security audits and penetration testing