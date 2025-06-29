# Firm Admin Portal

Interface for law firms to manage their Lexara Engage instances, including Auth0 authentication, dashboard analytics, and user management.

## Overview

The Firm Admin Portal provides law firms with comprehensive tools to manage their Engage deployment:

- **Auth0 Authentication**: Secure login and user management
- **Dashboard Analytics**: Conversation metrics and lead tracking  
- **User Management**: Role-based access control for firm employees
- **Firm Settings**: Configuration and customization options
- **Conversation Review**: Access to client interaction history

## Architecture

```
src/
├── auth/                 # Authentication utilities (legacy)
├── layouts/              # Page layouts
├── middleware.ts         # Auth0 route protection  
├── pages/                # Route pages
│   ├── firm/             # Firm-specific pages
│   │   ├── login.astro   # Auth0 login
│   │   ├── callback.astro # Auth0 callback handler
│   │   ├── signup.astro  # Firm registration
│   │   ├── dashboard.astro # Main dashboard
│   │   └── conversations.astro # Conversation management
│   └── index.astro       # Marketing homepage
├── types/                # TypeScript definitions
└── utils/                # Utility functions
    ├── auth.ts           # Auth0 integration
    └── api-client.ts     # API client utilities
```

## Key Features

### Auth0 Authentication
- Universal Login with secure session management
- Role-based access (admin, lawyer, staff, viewer)
- Multi-factor authentication support
- JWT token handling and validation

### Dashboard Analytics
- Conversation metrics and completion rates
- Lead generation and conversion tracking
- Practice area performance analytics
- User engagement statistics

### Firm Management
- User administration with role assignment
- Branding customization (colors, logos, disclaimers)
- Practice area configuration
- Billing and subscription management

## Development

### Setup
```bash
npm install
```

### Environment Variables
```bash
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_CLIENT_SECRET=your-auth0-client-secret
```

### Development Server
```bash
npm run dev
```

### Deployment
```bash
npm run deploy:dev      # Development
npm run deploy:staging  # Staging
npm run deploy:production # Production
```

## Integration

This component integrates with:
- **Conversation Agent**: Conversation data and analytics
- **Platform Admin Portal**: System-wide firm management
- **Chat UI**: Firm branding and customization

For detailed development information, see the component's CLAUDE.md file.