# Auth0 User Invitation Implementation Guide

## Overview
This guide explains how to implement user invitations using Auth0's Management API for the Lexara firm portal.

## Prerequisites

### 1. Auth0 Management API Setup
1. Go to Auth0 Dashboard → APIs
2. Find "Auth0 Management API"
3. Go to "Machine to Machine Applications" tab
4. Authorize your application
5. Select scopes:
   - `create:users`
   - `create:user_tickets`
   - `update:users`
   - `read:users`
   - `create:organization_members`
   - `create:organization_member_roles`

### 2. Environment Variables
Add to your `.env` file:
```env
AUTH0_DOMAIN=dev-sv0pf6cz2530xz0o.us.auth0.com
AUTH0_CLIENT_ID=OjsR6To3nDqYDLVHtRjDFpk7wRcCfrfi
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_MGMT_CLIENT_ID=your-management-api-client-id
AUTH0_MGMT_CLIENT_SECRET=your-management-api-client-secret
```

## Implementation Steps

### 1. Create Auth0 Management Client

```typescript
// src/auth/management-client.ts
import { ManagementClient } from 'auth0';

export function getManagementClient(env: Env) {
  return new ManagementClient({
    domain: env.AUTH0_DOMAIN,
    clientId: env.AUTH0_MGMT_CLIENT_ID,
    clientSecret: env.AUTH0_MGMT_CLIENT_SECRET,
    scope: 'create:users create:user_tickets update:users read:users create:organization_members'
  });
}
```

### 2. Update the Invitation API Endpoint

```typescript
// src/pages/api/firm/users/invite.ts
import { getManagementClient } from '@/auth/management-client';
import { getOrganizationName } from '@/auth/auth0-config';

export const POST: APIRoute = async ({ request, locals }) => {
  // ... existing validation code ...

  const management = getManagementClient(locals.runtime.env);
  const firmId = locals.user.firmId;
  const orgName = getOrganizationName('firm', firmId);

  try {
    // Step 1: Create user in Auth0
    const newUser = await management.createUser({
      email: email,
      email_verified: false,
      given_name: firstName,
      family_name: lastName,
      name: `${firstName} ${lastName}`,
      connection: 'Username-Password-Authentication',
      // Generate random password (user will reset it)
      password: generateSecurePassword(),
      user_metadata: {
        firmId: firmId,
        invitedBy: locals.user.email,
        invitedAt: new Date().toISOString(),
        practiceAreas: practiceAreas
      },
      app_metadata: {
        firmId: firmId,
        role: role,
        userType: 'firm_user'
      }
    });

    // Step 2: Add user to firm organization
    await management.organizations.addMembers(
      { id: orgName },
      { members: [newUser.user_id] }
    );

    // Step 3: Assign role in organization
    await management.organizations.addMemberRoles(
      { id: orgName, user_id: newUser.user_id },
      { roles: [role] }
    );

    // Step 4: Create password reset ticket
    const resetTicket = await management.createPasswordChangeTicket({
      user_id: newUser.user_id,
      ttl_sec: 432000, // 5 days
      mark_email_as_verified: true,
      includeEmailInRedirect: false,
      result_url: `${locals.url.origin}/firm/welcome`
    });

    // Step 5: Send invitation email
    await sendInvitationEmail({
      to: email,
      inviterName: locals.user.name,
      firmName: locals.user.firmName,
      resetLink: resetTicket.ticket,
      personalMessage: message
    });

    // Step 6: Store invitation in database
    // TODO: Implement database storage

    return new Response(JSON.stringify({
      success: true,
      message: 'Invitation sent successfully',
      userId: newUser.user_id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Auth0 invitation error:', error);
    // Handle specific Auth0 errors
    if (error.statusCode === 409) {
      return new Response(JSON.stringify({ 
        error: 'User with this email already exists' 
      }), { status: 409 });
    }
    throw error;
  }
};
```

### 3. Password Generation Helper

```typescript
// src/utils/password.ts
export function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const crypto = globalThis.crypto || require('crypto');
  
  for (let i = 0; i < 16; i++) {
    const randomIndex = crypto.getRandomValues(new Uint8Array(1))[0] % chars.length;
    password += chars[randomIndex];
  }
  
  return password;
}
```

### 4. Email Service Integration

```typescript
// src/services/email.ts
interface InvitationEmailData {
  to: string;
  inviterName: string;
  firmName: string;
  resetLink: string;
  personalMessage?: string;
}

export async function sendInvitationEmail(data: InvitationEmailData) {
  // Option 1: Use Auth0's email service
  // (configured in Auth0 Dashboard → Branding → Email Templates)
  
  // Option 2: Use your own email service (SendGrid, AWS SES, etc.)
  // Example with SendGrid:
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: data.to }]
      }],
      from: { 
        email: 'invitations@lexara.app',
        name: 'Lexara Legal AI'
      },
      subject: `You've been invited to join ${data.firmName} on Lexara`,
      content: [{
        type: 'text/html',
        value: generateInvitationHTML(data)
      }]
    })
  });

  if (!response.ok) {
    throw new Error('Failed to send invitation email');
  }
}
```

### 5. Database Schema for Invitations

```sql
CREATE TABLE user_invitations (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  practice_areas TEXT, -- JSON array
  invited_by TEXT NOT NULL,
  invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME,
  auth0_user_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, accepted, expired
  FOREIGN KEY (firm_id) REFERENCES firms(id)
);

CREATE INDEX idx_invitations_firm ON user_invitations(firm_id);
CREATE INDEX idx_invitations_email ON user_invitations(email);
```

## Security Considerations

1. **Rate Limiting**: Implement rate limiting on invitation endpoint
2. **Email Validation**: Verify email domains against firm's allowed domains
3. **Duplicate Prevention**: Check if user already exists before creating
4. **Expiration**: Set invitation expiration (e.g., 7 days)
5. **Audit Trail**: Log all invitation activities

## Testing

### Manual Testing
1. Create test firm account
2. Send invitation to test email
3. Verify email received with correct reset link
4. Complete password reset flow
5. Verify user can login with assigned role

### Automated Tests
```typescript
// tests/api/invite-user.test.ts
import { describe, it, expect } from 'vitest';

describe('User Invitation API', () => {
  it('should create user invitation successfully', async () => {
    const response = await fetch('/api/firm/users/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'firm_session=...'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'firm:lawyer'
      })
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

## Error Handling

### Common Errors
1. **409 Conflict**: User already exists
   - Solution: Check if user is already in organization
   
2. **429 Too Many Requests**: Rate limit exceeded
   - Solution: Implement client-side throttling
   
3. **403 Forbidden**: Insufficient scopes
   - Solution: Update Management API permissions

## Next Steps

1. Implement database storage for invitations
2. Add invitation resend functionality
3. Create invitation revocation endpoint
4. Add bulk invitation feature
5. Implement invitation analytics dashboard