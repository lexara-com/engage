# Firm Registration Setup Guide

## Overview

This guide explains how to set up and fix the firm registration functionality for Lexara Engage. The registration flow creates a law firm account with Auth0 integration and D1 database storage.

## Architecture

The firm registration flow involves:
1. **Astro Frontend** - Registration form at `/firm/signup`
2. **API Endpoint** - `/api/v1/firm/register` handles registration
3. **D1 Database** - Stores firm and user records
4. **Durable Objects** - FirmRegistry for real-time firm management
5. **Auth0** - User authentication and authorization

## Setup Steps

### 1. D1 Database Setup ✅

The D1 database has been created and configured:
- **Database Name**: lexara-auth
- **Database ID**: 39dd504c-9bf8-44ff-86b0-d5c2c2b860a9
- **Tables Created**: firms, users, user_sessions, audit_log

To recreate or verify:
```bash
cd apps/homepage
./scripts/setup-d1-database.sh
```

### 2. Durable Objects Configuration ✅

The `wrangler.toml` has been updated with:
```toml
[[durable_objects.bindings]]
name = "FIRM_REGISTRY"
class_name = "FirmRegistry"
script_name = "lexara-homepage"
```

### 3. Auth0 Configuration 🔧

You need to configure Auth0 credentials:

```bash
cd apps/homepage
./scripts/configure-auth0.sh
```

Or manually set the secrets:
```bash
wrangler secret put AUTH0_DOMAIN --env dev
wrangler secret put AUTH0_CLIENT_ID --env dev
wrangler secret put AUTH0_CLIENT_SECRET --env dev
```

#### Auth0 Dashboard Setup:
1. Create a Machine-to-Machine application
2. Enable Management API with scopes:
   - `create:users`
   - `read:users`
   - `update:users`
   - `create:users_app_metadata`
3. Note the domain, client ID, and client secret

### 4. Deploy the Worker

```bash
cd apps/homepage
wrangler deploy --env dev
```

## Testing the Registration Flow

### Manual Testing

1. Visit: https://dev-www.lexara.app/firm/signup
2. Fill out the registration form
3. Submit and check for success

### API Testing

```bash
cd apps/homepage
./scripts/test-registration.sh
```

Or test directly:
```bash
curl -X POST https://dev-www.lexara.app/api/v1/firm/register \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "starter",
    "firmName": "Test Law Firm",
    "firmSize": "1-5",
    "practiceAreas": ["personal_injury"],
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@testfirm.com",
    "password": "SecurePass123!",
    "agreedToTerms": true
  }'
```

## Common Issues and Solutions

### Issue: "Auth0 configuration missing"
**Solution**: Configure Auth0 environment variables (see step 3)

### Issue: "Failed to create firm in Durable Object"
**Solution**: 
1. Ensure Durable Objects are configured in wrangler.toml
2. Deploy with migrations: `wrangler deploy --env dev`

### Issue: "Database error"
**Solution**:
1. Verify D1 database ID in wrangler.toml
2. Run migrations: `wrangler d1 execute lexara-auth --file=./src/db/migrations/001_initial_schema.sql`

### Issue: "CORS error from frontend"
**Solution**: The API is same-origin, so this shouldn't happen. Check the API URL matches the frontend domain.

## Data Model

### Firms Table
```sql
CREATE TABLE firms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  plan TEXT DEFAULT 'starter',
  settings TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  firmId TEXT NOT NULL,
  auth0UserId TEXT UNIQUE,
  email TEXT NOT NULL,
  firstName TEXT,
  lastName TEXT,
  role TEXT DEFAULT 'member',
  permissions TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active',
  lastLogin INTEGER,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (firmId) REFERENCES firms(id)
);
```

## Security Considerations

1. **Password Requirements**: Minimum 8 characters
2. **Email Verification**: Users must verify email via Auth0
3. **Firm Isolation**: All queries scoped by firmId
4. **Audit Logging**: All actions logged to audit_log table
5. **HTTPS Only**: All endpoints require secure connections

## Next Steps

After successful setup:
1. Test the full registration flow
2. Monitor Auth0 logs for any issues
3. Check D1 database for created records
4. Implement additional firm management features