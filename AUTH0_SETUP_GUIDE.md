# Auth0 Setup Guide for Engage Legal AI

This guide walks through setting up Auth0 tenants and applications for Engage's multi-environment architecture.

## Prerequisites

- Auth0 account with access to create tenants
- Access to lexara.app domain configuration
- Understanding of OAuth 2.0 and JWT tokens

## Step 1: Create Auth0 Tenants

### Development Tenant
1. **Create Tenant**
   - Name: `lexara-dev`
   - Domain: `lexara-dev.us.auth0.com`
   - Region: US West (or closest to your users)
   - Environment: Development

2. **Configure Tenant Settings**
   - Go to Settings > Advanced
   - Set default directory to `Username-Password-Authentication`
   - Enable "Passwordless" (email) for easier testing
   - Configure session timeout: 30 minutes
   - Set logout URLs: `https://admin-dev.lexara.app/`

### Test Tenant
1. **Create Tenant**
   - Name: `lexara-test`
   - Domain: `lexara-test.us.auth0.com`
   - Region: US West
   - Environment: Staging

2. **Configure similar to dev but with test URLs**

### Production Tenant
1. **Create Tenant**
   - Name: `lexara`
   - Domain: `lexara.us.auth0.com`
   - Region: US West
   - Environment: Production

2. **Production hardening**
   - Enable MFA for admin users
   - Configure stronger password policies
   - Set up monitoring and alerts

## Step 2: Create Applications

For each tenant, create these two applications:

### Application 1: Admin Dashboard (SPA)

**Basic Settings:**
- Name: `Engage Admin Dashboard`
- Application Type: `Single Page Application`
- Token Endpoint Authentication Method: `None`

**URLs:**
```
# Development
Allowed Callback URLs: https://admin-dev.lexara.app/auth/callback
Allowed Logout URLs: https://admin-dev.lexara.app/auth/logout
Allowed Web Origins: https://admin-dev.lexara.app
Allowed Origins (CORS): https://admin-dev.lexara.app

# Test (adjust domain)
Allowed Callback URLs: https://admin-test.lexara.app/auth/callback
Allowed Logout URLs: https://admin-test.lexara.app/auth/logout
Allowed Web Origins: https://admin-test.lexara.app
Allowed Origins (CORS): https://admin-test.lexara.app

# Production (adjust domain)
Allowed Callback URLs: https://admin.lexara.app/auth/callback
Allowed Logout URLs: https://admin.lexara.app/auth/logout
Allowed Web Origins: https://admin.lexara.app
Allowed Origins (CORS): https://admin.lexara.app
```

**Advanced Settings:**
- JWT Expiration: 3600 seconds (1 hour)
- JWT Signature Algorithm: RS256
- OIDC Conformant: Enabled

### Application 2: Client Intake (Regular Web App)

**Basic Settings:**
- Name: `Engage Client Intake`
- Application Type: `Regular Web Application`
- Token Endpoint Authentication Method: `Client Secret Basic`

**URLs:**
```
# Development
Allowed Callback URLs: https://dev.lexara.app/auth/callback
Allowed Logout URLs: https://dev.lexara.app/auth/logout

# Test
Allowed Callback URLs: https://test.lexara.app/auth/callback
Allowed Logout URLs: https://test.lexara.app/auth/logout

# Production
Allowed Callback URLs: https://lexara.app/auth/callback
Allowed Logout URLs: https://lexara.app/auth/logout
```

## Step 3: Configure APIs (Optional but Recommended)

### Create Custom API for Enhanced Security

1. **Go to APIs > Create API**
   - Name: `Engage Admin API`
   - Identifier: `https://api.dev.lexara.app` (adjust for env)
   - Signing Algorithm: RS256

2. **Configure Scopes**
   ```
   admin:read         # View admin data
   admin:write        # Modify admin data
   firm:manage        # Manage firm settings
   users:manage       # Manage firm users
   conversations:view # View conversations
   conversations:delete # Delete conversations
   conflicts:manage   # Manage conflict lists
   documents:manage   # Manage supporting documents
   analytics:view     # View analytics
   billing:manage     # Manage billing/subscription
   ```

3. **Update Application Settings**
   - In each Admin Dashboard app, go to APIs tab
   - Authorize the custom API
   - Set default scopes based on user role

## Step 4: Configure User Roles and Permissions

### Create Custom Claims for Firm Context

1. **Go to Actions > Flows > Login**
2. **Create Custom Action:**

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://lexara.app/';
  
  // Get user's firm association (you'll need to implement this lookup)
  // This could be stored in user app_metadata or fetched from your Firm Registry
  const firmId = event.user.app_metadata?.firmId;
  const role = event.user.app_metadata?.role || 'viewer';
  
  if (firmId) {
    api.idToken.setCustomClaim(`${namespace}firmId`, firmId);
    api.accessToken.setCustomClaim(`${namespace}firmId`, firmId);
  }
  
  if (role) {
    api.idToken.setCustomClaim(`${namespace}role`, role);
    api.accessToken.setCustomClaim(`${namespace}role`, role);
  }
  
  // Add permissions based on role
  const permissions = getRolePermissions(role);
  api.accessToken.setCustomClaim(`${namespace}permissions`, permissions);
};

function getRolePermissions(role) {
  switch (role) {
    case 'admin':
      return [
        'admin:read', 'admin:write', 'firm:manage', 'users:manage',
        'conversations:view', 'conversations:delete', 'conflicts:manage',
        'documents:manage', 'analytics:view', 'billing:manage'
      ];
    case 'lawyer':
      return [
        'conversations:view', 'conversations:delete', 'conflicts:manage',
        'documents:manage', 'analytics:view'
      ];
    case 'staff':
      return ['conversations:view', 'documents:manage'];
    case 'viewer':
      return ['conversations:view'];
    default:
      return [];
  }
}
```

## Step 5: Configure Cloudflare Secrets

After creating the Auth0 applications, update your Cloudflare secrets:

### Development Environment
```bash
# Set Auth0 secrets for dev environment
wrangler secret put AUTH0_CLIENT_SECRET --env dev --config wrangler-admin.toml
# Enter your dev tenant admin app client secret

# Update client ID in wrangler-admin.toml dev vars
# Replace "TO_BE_SET" with actual client ID
```

### Test Environment
```bash
wrangler secret put AUTH0_CLIENT_SECRET --env test --config wrangler-admin.toml
# Enter your test tenant admin app client secret
```

### Production Environment
```bash
wrangler secret put AUTH0_CLIENT_SECRET --env production --config wrangler-admin.toml
# Enter your production tenant admin app client secret
```

## Step 6: Test Authentication Flow

### 1. Deploy Updated Admin Worker
```bash
npm run deploy:admin:dev
```

### 2. Test Login Flow
1. Visit: `https://admin-dev.lexara.app/health` (should work)
2. Visit: `https://admin-dev.lexara.app/api/admin/firms` (should return 401 with login URL)
3. Follow the login URL to test Auth0 flow
4. After callback, test protected endpoints

### 3. Test JWT Validation
```bash
# Test with a valid JWT token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://admin-dev.lexara.app/api/admin/firms
```

## Step 7: User Invitation Workflow

### Option A: Manual User Addition
1. **Create users in Auth0 Dashboard**
   - Go to User Management > Users
   - Click "Create User"
   - Set app_metadata with firmId and role:
     ```json
     {
       "firmId": "01HXXXXXXXXXXXXXXXXXXXXX",
       "role": "admin"
     }
     ```

### Option B: Invitation API (Future Enhancement)
- Implement user invitation API
- Use Auth0 Management API to create invitations
- Send invitation emails with firm context

## Security Considerations

### JWT Security
- **Short Token Expiry**: 1 hour max for access tokens
- **Refresh Token Rotation**: Enable for production
- **Secure Storage**: Store tokens in httpOnly cookies for web apps
- **Token Validation**: Always validate signature, issuer, audience, expiry

### HIPAA Compliance
- **Audit Logging**: Log all authentication events
- **Session Management**: 15-minute inactivity timeout
- **Access Controls**: Role-based permissions strictly enforced
- **Data Encryption**: Encrypt sensitive conversation data

### Multi-Tenant Security
- **Firm Isolation**: Strict validation of firmId in all requests
- **Cross-Tenant Prevention**: Never allow users to access different firm data
- **Admin Permissions**: Carefully control who can manage users and firm settings

## Troubleshooting

### Common Issues

1. **"Invalid State Parameter" / Error 1101**
   - **Symptoms**: Error 1101, redirect to `/login?error=auth_failed`
   - **Causes**: State parameter tampering, expired state (>10 minutes), missing state in callback URL
   - **Debug**: Check state generation and validation in browser DevTools
   - **Solution**: Verify state timestamp validation and base64 encoding/decoding

2. **"Invalid Redirect URI"**
   - **Symptoms**: Auth0 error during login redirect
   - **Causes**: Mismatch between configured callback URLs and actual request URLs
   - **Solution**: Ensure exact match in Auth0 Dashboard > Applications > Settings
   - **Note**: Check for trailing slashes, HTTP vs HTTPS, subdomain differences

3. **"Token Exchange Failed" (403/401)**
   - **Symptoms**: Error after successful Auth0 authentication
   - **Causes**: Invalid client credentials, mismatched redirect_uri, expired authorization code
   - **Debug**: Check Auth0 logs in Dashboard > Monitoring > Logs
   - **Solution**: Verify CLIENT_SECRET matches, redirect_uri is identical in auth and token requests

4. **JWT Validation Fails**
   - **Symptoms**: Authentication fails despite valid Auth0 response
   - **Causes**: Missing custom claims, expired tokens, invalid signature verification
   - **Debug**: Decode JWT at https://jwt.io to inspect claims
   - **Solution**: Verify Auth0 Action is setting custom claims correctly

5. **Session Persistence Issues**
   - **Symptoms**: User logged out on page refresh
   - **Causes**: Missing secure cookie attributes, Durable Object storage issues
   - **Debug**: Check cookies in browser DevTools (Application > Cookies)
   - **Solution**: Verify HttpOnly, Secure, SameSite attributes are set

6. **CORS Errors**
   - **Symptoms**: Browser blocks Auth0 requests
   - **Causes**: Missing allowed origins in Auth0 application settings
   - **Solution**: Update allowed origins in Auth0 application settings
   - **Note**: Check admin worker CORS configuration for API endpoints

### Debug Commands
```bash
# Test Auth0 JWKS endpoint
curl https://dev-sv0pf6cz2530xz0o.us.auth0.com/.well-known/jwks.json

# Test platform admin health endpoint
curl https://platform-dev.lexara.app/health

# Test authentication requirement (should redirect)
curl -v https://platform-dev.lexara.app/dashboard 2>&1 | grep Location

# Enable debug logging in Cloudflare
wrangler tail --env dev --config wrangler-platform.toml

# Generate manual auth URL for testing
node -e "
const state = btoa(JSON.stringify({returnTo: '/dashboard', timestamp: Date.now(), nonce: 'test'}));
console.log('Auth URL:', \`https://dev-sv0pf6cz2530xz0o.us.auth0.com/authorize?client_id=QHexH0yTPx1xBZDIWrzltOjwGX86Bcx3&redirect_uri=https://platform-dev.lexara.app/callback&scope=openid+profile+email&response_type=code&state=\${state}\`);
"
```

### Current Implementation Status (Development)

#### Active Configuration
- **Domain**: `dev-sv0pf6cz2530xz0o.us.auth0.com`
- **Client ID**: `QHexH0yTPx1xBZDIWrzltOjwGX86Bcx3`  
- **Platform Admin URL**: `https://platform-dev.lexara.app`
- **Main Agent URL**: `https://dev.lexara.app`

#### Test Accounts
```bash
# Test login flow manually:
# 1. Visit: https://platform-dev.lexara.app/login
# 2. Should redirect to Auth0 with proper parameters
# 3. Use any Auth0-configured identity provider
# 4. Should redirect back to /dashboard on success
```

#### Authentication Flow
1. User accesses protected route (e.g., `/dashboard`)
2. Platform worker detects missing session
3. Redirects to `/login` with Auth0 authorization URL
4. User authenticates via Auth0
5. Auth0 redirects to `/callback` with authorization code
6. Platform worker exchanges code for JWT token
7. JWT validated and session created in Durable Object
8. User redirected to originally requested page

#### Integration Tests
```bash
# Run Auth0 integration test suite
npm test tests/integration/auth0-flows.test.ts
npm test tests/integration/auth0-callback-simulation.test.ts  
npm test tests/integration/auth0-session-management.test.ts

# Run unit tests for Auth0 components
npm test tests/unit/auth/platform-auth-manager.test.ts
```

## Next Steps

1. **Complete Auth0 Setup**: Follow this guide to create tenants and applications
2. **Test Authentication**: Verify login flow works end-to-end
3. **Implement User Management**: Build invitation and user management features
4. **Add Client Intake Auth**: Extend authentication to main client intake flow
5. **Production Deployment**: Deploy to test and production environments

This setup provides a robust, scalable authentication foundation for Engage's multi-tenant architecture while maintaining legal industry security requirements.