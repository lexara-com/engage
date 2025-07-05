# Firm Registration API Documentation

**Last Updated**: January 3, 2025  
**Status**: ✅ Implemented, 🚧 Security Updates Needed

## Overview

The Firm Registration API enables law firms to sign up for Lexara Engage. It handles the complete registration flow including Auth0 user creation, D1 database records, and Durable Object initialization.

## API Endpoint

### POST `/api/v1/firm/register`

Creates a new law firm account with an admin user.

#### Request Body

```typescript
{
  // Firm Information
  "plan": "starter" | "professional" | "enterprise",
  "firmName": "Smith & Associates",
  "firmSize": "1-5" | "6-10" | "11-50" | "50+",
  "practiceAreas": ["personal_injury", "family_law"],
  
  // Admin User Information
  "firstName": "John",
  "lastName": "Smith",
  "email": "john@smithlaw.com",
  "password": "SecurePass123!",
  
  // Legal Agreement
  "agreedToTerms": true
}
```

#### Field Validation

- **firmName**: Required, 2-100 characters
- **email**: Required, valid email format
- **password**: Required, minimum 8 characters, must include uppercase, number, and special character
- **firstName**: Required, 1-50 characters
- **lastName**: Required, 1-50 characters
- **agreedToTerms**: Required, must be true
- **plan**: Optional, defaults to "starter"
- **firmSize**: Optional, defaults to "1-5"
- **practiceAreas**: Optional, array of strings

#### Success Response (201 Created)

```json
{
  "success": true,
  "data": {
    "firmId": "01HK123ABC",
    "userId": "01HK456DEF",
    "auth0UserId": "auth0|67890",
    "message": "Welcome to Lexara! Please check your email to verify your account."
  }
}
```

#### Error Responses

##### Validation Error (400)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required fields: email, password"
  }
}
```

##### Password Too Weak (400)
```json
{
  "success": false,
  "error": {
    "code": "PASSWORD_TOO_WEAK",
    "message": "Password must be at least 8 characters with uppercase, number, and special character"
  }
}
```

##### Terms Not Accepted (400)
```json
{
  "success": false,
  "error": {
    "code": "TERMS_NOT_ACCEPTED",
    "message": "You must agree to the terms and conditions"
  }
}
```

##### User Already Exists (409)
```json
{
  "success": false,
  "error": {
    "code": "USER_EXISTS",
    "message": "A user with this email already exists"
  }
}
```

##### Registration Failed (500)
```json
{
  "success": false,
  "error": {
    "code": "REGISTRATION_FAILED",
    "message": "Failed to create account. Please try again."
  }
}
```

## Registration Flow

### 1. Input Validation
- Validates all required fields are present
- Checks email format
- Validates password strength
- Ensures terms are accepted

### 2. Auth0 User Creation
```typescript
// Get Auth0 management token
const token = await getAuth0ManagementToken();

// Create user in Auth0
const auth0User = await createAuth0User({
  email,
  password,
  connection: 'Username-Password-Authentication',
  app_metadata: {
    firmId, // Will be set after firm creation
    permissions: ['firm:admin']
  },
  user_metadata: {
    firstName,
    lastName,
    role: 'admin'
  }
});
```

### 3. Database Records

#### Firm Record (D1)
```sql
INSERT INTO firms (
  id,
  name,
  plan,
  settings,
  status,
  created_at,
  updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?)
```

Settings JSON structure:
```json
{
  "size": "1-5",
  "practiceAreas": ["personal_injury", "family_law"]
}
```

#### User Record (D1)
```sql
INSERT INTO users (
  id,
  firm_id,
  auth0_id,
  email,
  first_name,
  last_name,
  role,
  permissions,
  status,
  created_at,
  updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

Permissions JSON structure:
```json
{
  "firm:admin": true,
  "firm:manage_users": true,
  "firm:manage_settings": true
}
```

### 4. Durable Object Notification

The FirmRegistry Durable Object is notified of the new firm:

```typescript
const firmRegistry = env.FIRM_REGISTRY.get(
  env.FIRM_REGISTRY.idFromName('global')
);

await firmRegistry.fetch('/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'registerFirm',
    firmId,
    domain: firmData.domain
  })
});
```

### 5. Audit Logging

An audit log entry is created:

```sql
INSERT INTO audit_log (
  id,
  firm_id,
  user_id,
  action,
  details,
  ip_address,
  user_agent,
  created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

## Implementation Details

### Environment Variables Required

```bash
# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_AUDIENCE=https://api.lexara.app
```

### Database Bindings Required

```toml
# wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "lexara-auth"
database_id = "your-database-id"

[[durable_objects.bindings]]
name = "FIRM_REGISTRY"
class_name = "FirmRegistry"
```

## Security Considerations

### Current Implementation
- ✅ Password strength validation
- ✅ Input sanitization
- ✅ Auth0 integration for secure authentication
- ✅ Audit logging of all registrations
- ⚠️ No rate limiting (needs implementation)
- ⚠️ No CAPTCHA (needs implementation)

### Recommended Improvements

1. **Rate Limiting**
```typescript
const rateLimiter = new RateLimiter({
  limit: 5, // 5 registrations
  window: 3600 // per hour
});

if (!await rateLimiter.check(request.headers.get('CF-Connecting-IP'))) {
  return new Response('Too many registration attempts', { status: 429 });
}
```

2. **Email Verification**
- Currently relies on Auth0's email verification
- Consider adding double opt-in for extra security

3. **Duplicate Detection**
- Check if firm name already exists
- Prevent multiple registrations from same domain

## Testing

### Unit Tests
Located in `tests/integration/api/firm_registration.test.ts`

Currently testing:
- ✅ Valid registration flow
- ✅ Field validation
- ✅ Password strength
- ✅ Terms acceptance
- ✅ Auth0 error handling
- ✅ Database error handling
- ✅ Audit logging
- ✅ Durable Object integration

### Manual Testing

```bash
# Test registration
curl -X POST https://www.lexara.app/api/v1/firm/register \
  -H "Content-Type: application/json" \
  -d '{
    "firmName": "Test Law Firm",
    "email": "test@testfirm.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User",
    "agreedToTerms": true
  }'
```

## Common Issues

### Auth0 Token Errors
- Ensure AUTH0_CLIENT_SECRET is correctly set
- Check Auth0 application has proper grants
- Verify Machine-to-Machine application is authorized

### Database Connection Errors
- Verify D1 database binding in wrangler.toml
- Check database migrations have been run
- Ensure database ID is correct

### Durable Object Errors
- Verify FIRM_REGISTRY binding exists
- Check Durable Object class is deployed
- Ensure proper namespace configuration