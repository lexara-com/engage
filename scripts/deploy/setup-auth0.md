# Auth0 Setup Guide for Engage Admin Portal

This guide will walk you through setting up Auth0 authentication for the Engage admin portal.

## Prerequisites

1. Auth0 account (free tier is sufficient for development)
2. Access to Cloudflare Workers dashboard
3. Access to DNS management for lexara.app domain

## Step 1: Create Auth0 Applications

### Development Environment

1. **Login to Auth0 Dashboard** at https://manage.auth0.com
2. **Create new Application**:
   - Name: `Engage Admin - Development`
   - Type: `Single Page Application` (SPA)
   - Technology: `JavaScript`

3. **Configure Application Settings**:
   ```
   Allowed Callback URLs:
   https://admin-dev.lexara.app/admin/auth/callback
   
   Allowed Logout URLs:
   https://admin-dev.lexara.app/admin/auth/logout
   
   Allowed Web Origins:
   https://admin-dev.lexara.app
   
   Allowed Origins (CORS):
   https://admin-dev.lexara.app
   ```

4. **Note the following values**:
   - Domain: `lexara-dev.us.auth0.com` (or your custom domain)
   - Client ID: (save this value)
   - Client Secret: (save this value)

### Test Environment

Repeat the same steps with:
- Name: `Engage Admin - Test`
- URLs using `admin-test.lexara.app`

### Production Environment

Repeat the same steps with:
- Name: `Engage Admin - Production`
- URLs using `admin.lexara.app`

## Step 2: Configure Auth0 API

1. **Create API** in Auth0:
   - Name: `Engage Admin API - Development`
   - Identifier: `https://api.dev.lexara.app`
   - Signing Algorithm: `RS256`

2. **Configure Scopes**:
   ```
   read:admin_dashboard
   manage:firms
   manage:conversations
   manage:conflicts
   manage:users
   view:analytics
   admin:settings
   ```

3. **Repeat for Test and Production** with appropriate identifiers

## Step 3: Configure User Roles and Permissions

### Create Roles

1. Go to **User Management > Roles**
2. Create the following roles:

**Super Admin**
- Description: Full system access across all firms
- Permissions: All scopes from Step 2

**Firm Admin**  
- Description: Full access to specific firm data
- Permissions: All scopes except `admin:settings`

**Firm User**
- Description: Read-only access to firm data
- Permissions: `read:admin_dashboard`, `view:analytics`

### Add Custom Claims (Rules/Actions)

Create an Auth0 Action to add custom claims:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://engage.lexara.app/';
  
  // Get user's roles (you'll need to set these via Auth0 Management API)
  const roles = event.authorization?.roles || [];
  
  // Get user's firm ID (store this in user metadata)
  const firmId = event.user.user_metadata?.firm_id;
  
  // Set custom claims
  api.idToken.setCustomClaim(`${namespace}roles`, roles);
  api.accessToken.setCustomClaim(`${namespace}roles`, roles);
  
  if (firmId) {
    api.idToken.setCustomClaim(`${namespace}firm_id`, firmId);
    api.accessToken.setCustomClaim(`${namespace}firm_id`, firmId);
  }
  
  // Set permissions based on roles
  const permissions = [];
  if (roles.includes('super_admin')) {
    permissions.push('read:admin_dashboard', 'manage:firms', 'manage:conversations', 'manage:conflicts', 'manage:users', 'view:analytics', 'admin:settings');
  } else if (roles.includes('firm_admin')) {
    permissions.push('read:admin_dashboard', 'manage:firms', 'manage:conversations', 'manage:conflicts', 'manage:users', 'view:analytics');
  } else if (roles.includes('firm_user')) {
    permissions.push('read:admin_dashboard', 'view:analytics');
  }
  
  api.idToken.setCustomClaim(`${namespace}permissions`, permissions);
  api.accessToken.setCustomClaim(`${namespace}permissions`, permissions);
};
```

## Step 4: Configure Cloudflare Workers Secrets

For each environment, set these secrets:

### Development
```bash
npx wrangler secret put AUTH0_CLIENT_SECRET --env dev --config wrangler-admin.toml
# Enter the client secret from Step 1

npx wrangler secret put AUTH0_CLIENT_ID --env dev --config wrangler-admin.toml  
# Enter the client ID from Step 1
```

### Test
```bash
npx wrangler secret put AUTH0_CLIENT_SECRET --env test --config wrangler-admin.toml
npx wrangler secret put AUTH0_CLIENT_ID --env test --config wrangler-admin.toml
```

### Production
```bash
npx wrangler secret put AUTH0_CLIENT_SECRET --env production --config wrangler-admin.toml
npx wrangler secret put AUTH0_CLIENT_ID --env production --config wrangler-admin.toml
```

## Step 5: Update Wrangler Configuration

Update the placeholder values in `wrangler-admin.toml`:

```toml
[env.dev.vars]
AUTH0_DOMAIN = "YOUR_AUTH0_DOMAIN"  # e.g., "lexara-dev.us.auth0.com"
AUTH0_CLIENT_ID = "YOUR_CLIENT_ID"   # Will be set via secrets
AUTH0_AUDIENCE = "https://api.dev.lexara.app"
```

## Step 6: Deploy Admin Worker

```bash
# Deploy to development
npx wrangler deploy --env dev --config wrangler-admin.toml

# Deploy to test
npx wrangler deploy --env test --config wrangler-admin.toml

# Deploy to production  
npx wrangler deploy --env production --config wrangler-admin.toml
```

## Step 7: Test Authentication

1. Visit `https://admin-dev.lexara.app`
2. Click "Login with Auth0"
3. Complete Auth0 login flow
4. Verify redirect back to admin dashboard

## Step 8: Create Test Users

1. In Auth0 Dashboard, go to **User Management > Users**
2. Create test users with different roles:
   - super_admin@test.com (Super Admin role)
   - firm_admin@test.com (Firm Admin role, set firm_id in user_metadata)
   - firm_user@test.com (Firm User role, set firm_id in user_metadata)

## Troubleshooting

### Common Issues

1. **Redirect URI Mismatch**: Ensure exact match between Auth0 config and actual URLs
2. **CORS Errors**: Check Allowed Origins in Auth0 application settings
3. **Token Validation Fails**: Verify API identifier matches audience claim
4. **Custom Claims Missing**: Check Auth0 Action is properly configured and deployed

### Testing Commands

```bash
# Test auth endpoints
curl https://admin-dev.lexara.app/admin/auth/login
curl https://admin-dev.lexara.app/admin/api/dashboard

# Check worker logs
npx wrangler tail --env dev --config wrangler-admin.toml
```

## Next Steps

1. Implement user role assignment interface
2. Add firm-specific data filtering
3. Set up user invitation workflow
4. Configure session management and refresh tokens
5. Add audit logging for admin actions

## Security Considerations

- Use HTTPS for all environments
- Set appropriate token expiration times
- Implement proper session management
- Add audit logging for sensitive operations
- Use principle of least privilege for role assignments
- Regularly review and rotate secrets