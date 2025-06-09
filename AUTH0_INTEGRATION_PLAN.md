# Auth0 Integration Plan for Engage Legal AI

## Overview

This plan covers implementing Auth0 authentication across all Engage environments using the stable lexara.app domains.

## Auth0 Architecture

### Multi-Tenant Setup
We'll use separate Auth0 tenants for environment isolation:

- **Development**: `lexara-dev.us.auth0.com`
- **Test**: `lexara-test.us.auth0.com`  
- **Production**: `lexara.us.auth0.com`

### Application Structure
Each tenant will have two applications:

1. **Admin Dashboard** - SPA for law firm administration
2. **Client Intake** - Universal Login for potential clients

## Implementation Phases

### Phase 1: Auth0 Tenant Setup

#### 1.1 Create Auth0 Tenants
```bash
# Development tenant: lexara-dev
Domain: lexara-dev.us.auth0.com
Region: US West (for performance)
Environment: Development

# Test tenant: lexara-test  
Domain: lexara-test.us.auth0.com
Region: US West
Environment: Staging

# Production tenant: lexara
Domain: lexara.us.auth0.com
Region: US West  
Environment: Production
```

#### 1.2 Configure Applications

**Admin Dashboard Application (SPA)**
```json
{
  "name": "Engage Admin Dashboard",
  "application_type": "spa",
  "callbacks": [
    "https://admin.dev.lexara.app/callback",
    "https://admin.test.lexara.app/callback", 
    "https://admin.lexara.app/callback"
  ],
  "logout_urls": [
    "https://admin.dev.lexara.app/logout",
    "https://admin.test.lexara.app/logout",
    "https://admin.lexara.app/logout"
  ],
  "allowed_origins": [
    "https://admin.dev.lexara.app",
    "https://admin.test.lexara.app", 
    "https://admin.lexara.app"
  ],
  "web_origins": [
    "https://admin.dev.lexara.app",
    "https://admin.test.lexara.app",
    "https://admin.lexara.app"
  ]
}
```

**Client Intake Application (Regular Web App)**
```json
{
  "name": "Engage Client Intake",
  "application_type": "regular_web",
  "callbacks": [
    "https://dev.lexara.app/auth/callback",
    "https://test.lexara.app/auth/callback",
    "https://lexara.app/auth/callback"
  ],
  "logout_urls": [
    "https://dev.lexara.app/auth/logout", 
    "https://test.lexara.app/auth/logout",
    "https://lexara.app/auth/logout"
  ]
}
```

### Phase 2: Worker Authentication Middleware

#### 2.1 JWT Validation Service
```typescript
// src/auth/jwt-validator.ts
import { Env } from '@/types/shared';

export class JWTValidator {
  private jwksCache: Map<string, any> = new Map();
  
  async validateToken(token: string, env: Env): Promise<AuthContext | null> {
    try {
      // Get JWKS from Auth0
      const jwks = await this.getJWKS(env.AUTH0_DOMAIN!);
      
      // Decode and verify JWT
      const payload = await this.verifyJWT(token, jwks);
      
      // Extract user context
      return this.extractAuthContext(payload, env);
    } catch (error) {
      return null;
    }
  }
  
  private async getJWKS(domain: string): Promise<any> {
    const cacheKey = `jwks:${domain}`;
    
    if (this.jwksCache.has(cacheKey)) {
      return this.jwksCache.get(cacheKey);
    }
    
    const response = await fetch(`https://${domain}/.well-known/jwks.json`);
    const jwks = await response.json();
    
    // Cache for 1 hour
    this.jwksCache.set(cacheKey, jwks);
    setTimeout(() => this.jwksCache.delete(cacheKey), 3600000);
    
    return jwks;
  }
}
```

#### 2.2 Auth Middleware
```typescript
// src/auth/middleware.ts
export async function authMiddleware(
  request: Request, 
  env: Env
): Promise<{ valid: boolean; context?: AuthContext; error?: string }> {
  
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing authorization header' };
  }

  const token = authHeader.substring(7);
  const validator = new JWTValidator();
  const context = await validator.validateToken(token, env);
  
  if (!context) {
    return { valid: false, error: 'Invalid token' };
  }
  
  return { valid: true, context };
}
```

### Phase 3: Admin Dashboard Integration

#### 3.1 Admin Authentication Flow
```typescript
// Admin worker authentication enhancement
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Extract path and method
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Skip auth for health checks and login endpoints
    if (path === '/health' || path.startsWith('/auth/')) {
      return this.handlePublicRequest(request, env);
    }
    
    // Validate authentication
    const authResult = await authMiddleware(request, env);
    if (!authResult.valid) {
      return new Response(JSON.stringify({
        error: 'AUTHENTICATION_REQUIRED',
        message: authResult.error,
        loginUrl: `https://${env.AUTH0_DOMAIN}/authorize?...`
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Continue with authenticated request
    return this.handleAuthenticatedRequest(request, env, authResult.context!);
  }
}
```

#### 3.2 User Context Enhancement
```typescript
interface AuthContext {
  // Auth0 user info
  auth0UserId: string;      // "auth0|507f1f77bcf86cd799439011"
  email: string;            // "john@smithlaw.com"
  name: string;             // "John Smith"
  
  // Firm context (from firm lookup)
  firmId: string;           // ULID from firm registry
  role: FirmRole;           // "admin" | "lawyer" | "staff" | "viewer"
  permissions: AdminPermissions;
  
  // Token metadata
  issuedAt: number;
  expiresAt: number;
  scope: string[];
}
```

### Phase 4: Client Intake Authentication

#### 4.1 Conversation Security Flow
```typescript
// Enhanced conversation flow with Auth0
class ConversationFlow {
  async startConversation(firmId: string): Promise<ConversationResponse> {
    // Start anonymous conversation
    const session = await this.createAnonymousSession(firmId);
    
    return {
      sessionId: session.sessionId,
      resumeUrl: session.resumeUrl,
      phase: 'pre_login',
      // Include Auth0 login URL for later use
      authConfig: {
        domain: process.env.AUTH0_DOMAIN,
        clientId: process.env.AUTH0_CLIENT_ID,
        loginUrl: this.generateLoginUrl(firmId, session.sessionId)
      }
    };
  }
  
  async suggestLogin(sessionId: string): Promise<LoginSuggestion> {
    const session = await this.getSession(sessionId);
    
    if (!session.preLoginGoalsComplete()) {
      throw new Error('Pre-login goals not completed');
    }
    
    const loginUrl = this.generateLoginUrl(session.firmId, sessionId);
    
    return {
      loginUrl,
      message: "To continue with sensitive information, please log in securely.",
      benefits: [
        "Secure data handling",
        "Resume conversation anytime", 
        "Direct attorney contact"
      ]
    };
  }
}
```

#### 4.2 Secure Data Handling
```typescript
// Post-login data encryption
class SecureConversationHandler {
  async handleAuthenticatedMessage(
    sessionId: string,
    message: string,
    authContext: AuthContext
  ): Promise<MessageResponse> {
    
    const session = await this.getSession(sessionId);
    
    // Lock session to authenticated user
    if (!session.isSecured) {
      session.secureWithAuth0(authContext.auth0UserId);
    }
    
    // Validate user access
    if (!session.canAccess(authContext.auth0UserId)) {
      throw new UnauthorizedError('Invalid session access');
    }
    
    // Classify and encrypt sensitive data
    const classification = this.classifyMessage(message);
    if (classification.requiresEncryption) {
      message = await this.encryptMessage(message, session.encryptionKey);
    }
    
    // Continue conversation with secured context
    return this.processSecuredMessage(session, message, authContext);
  }
}
```

### Phase 5: User Management Integration

#### 5.1 Firm User Sync
```typescript
// Sync Auth0 users with firm registry
class FirmUserSync {
  async syncAuth0User(auth0User: Auth0User, firmId: string): Promise<void> {
    const firmRegistry = await this.getFirmRegistry();
    
    // Check if user exists in firm
    const existingUser = await firmRegistry.findUserByAuth0Id(
      auth0User.user_id, 
      firmId
    );
    
    if (existingUser) {
      // Update existing user info
      await firmRegistry.updateUser(firmId, {
        auth0UserId: auth0User.user_id,
        email: auth0User.email,
        name: auth0User.name,
        lastLogin: new Date()
      });
    } else {
      // Handle new user (invitation flow)
      await this.handleNewUserLogin(auth0User, firmId);
    }
  }
}
```

#### 5.2 Invitation System
```typescript
// User invitation flow
class UserInvitationSystem {
  async inviteUser(
    firmId: string, 
    email: string, 
    role: FirmRole,
    invitedBy: string
  ): Promise<InvitationResult> {
    
    // Create Auth0 invitation
    const auth0Invitation = await this.createAuth0Invitation({
      email,
      connection: 'Username-Password-Authentication',
      app_metadata: {
        firmId,
        role,
        invitedBy,
        invitedAt: new Date().toISOString()
      }
    });
    
    // Store invitation in firm registry
    await this.storeInvitation(firmId, {
      email,
      role,
      auth0InvitationId: auth0Invitation.id,
      invitedBy,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
    
    return {
      invitationId: auth0Invitation.id,
      invitationUrl: auth0Invitation.invitation_url,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
  }
}
```

## Deployment Plan

### Step 1: Domain Configuration
✅ Configure lexara.app domains in Cloudflare  
✅ Update worker configurations for stable URLs

### Step 2: Auth0 Setup
🔄 Create Auth0 tenants (dev, test, prod)
⏳ Configure applications with callback URLs
⏳ Set up user roles and permissions

### Step 3: Authentication Implementation  
⏳ Build JWT validation service
⏳ Implement auth middleware
⏳ Update admin worker with auth

### Step 4: Integration Testing
⏳ Test admin authentication flow
⏳ Test client intake authentication  
⏳ Validate user management features

### Step 5: Production Deployment
⏳ Deploy to test environment
⏳ Lexara team testing
⏳ Production deployment

## Security Considerations

### JWT Security
- **Short-lived tokens**: 1 hour expiry with refresh
- **Secure transmission**: HTTPS only
- **Token validation**: Verify signature, issuer, audience
- **Scope enforcement**: Limit token permissions

### HIPAA Compliance
- **Encrypted sessions**: All authenticated sessions encrypted
- **Access logging**: Comprehensive audit trails
- **Session timeouts**: 15-minute inactivity timeout
- **User consent**: Clear data handling disclosures

### Legal Industry Requirements
- **Client confidentiality**: Attorney-client privilege protection
- **Conflict checking**: Prevent unauthorized data access
- **Data retention**: Configurable retention policies
- **Professional responsibility**: Role-based access controls

## Testing Strategy

### Unit Tests
- JWT validation logic
- Auth middleware functionality
- User permission checking
- Session security controls

### Integration Tests  
- Complete authentication flows
- Cross-environment token validation
- User invitation workflows
- Session resumption after login

### Security Tests
- Token manipulation attempts
- Unauthorized access prevention
- Session hijacking protection
- Cross-tenant data isolation

This comprehensive Auth0 integration will provide enterprise-grade authentication while maintaining the flexibility needed for legal industry compliance and user experience requirements.