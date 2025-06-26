# AWS SES Email Setup Documentation

## Current Status: ✅ CONFIGURED

- Auth0 → AWS SES integration is configured
- `read:email_provider` scope added to Management API
- API shows: `{"configured": true, "provider": "ses"}`

## Remaining SES Configuration Steps

### 1. Verify Email Delivery

**Test the invitation flow:**

```bash
# Go to: https://dev-www.lexara.app/firm/settings
# Click "Add User" and invite a test user
# Check if emails arrive (including spam folder)
```

### 2. AWS SES Sandbox Mode (if applicable)

If your AWS SES is in sandbox mode:

- ✅ You can only send to verified email addresses
- 📧 Add test email addresses to SES verified identities
- 🚀 Request production access to send to any email

**To check sandbox status:**

```bash
# In AWS SES Console → Sending statistics
# Look for "Sending quota" and sandbox notification
```

### 3. Email Deliverability Issues to Check

**Common issues:**

- **Spam folder**: Check recipient spam/junk folders
- **From email**: Must match verified domain in SES
- **DNS records**: SPF/DKIM records for domain reputation
- **Rate limits**: SES has sending limits (200 emails/day in sandbox)

**Debug commands:**

```bash
# Test API configuration
curl -s "https://dev-www.lexara.app/api/v1/debug/auth0-test" | jq '.data.emailProvider'

# Should return: {"configured": true, "provider": "ses"}
```

### 4. Production Readiness

**Before going live:**

1. **Request SES production access** in AWS Console
2. **Configure SPF/DKIM records** for your domain
3. **Set up bounce/complaint handling**
4. **Monitor sending statistics**

**Auth0 email template customization:**

- Go to Auth0 Dashboard → Branding → Email Templates
- Customize "Change Password" template for invitations
- Add company branding and messaging

### 5. Fallback Strategy

If SES emails continue to fail, the system has built-in fallbacks:

- **Secure links**: Manual copy/paste invitation URLs
- **Temporary passwords**: Admin-provided credentials
- **Manual setup**: "Forgot password" flow instructions

## Technical Implementation Details

**Files modified:**

- `src/utils/auth0-management.ts`: Enhanced ticket creation with SES integration
- `src/pages/api/v1/firm/users.ts`: User invitation API with email handling
- `src/pages/firm/settings.astro`: Frontend modals for different invitation types

**Auth0 Management API scopes required:**

```
read:users update:users create:users create:user_tickets read:email_provider
```

**Invitation flow:**

1. Create user with random password
2. Generate Auth0 password change ticket
3. AWS SES sends password setup email automatically
4. User clicks link, sets password, gains access

## Next Steps

After SES is working:

1. Test with real email addresses
2. Verify email deliverability
3. Complete user management features (edit/remove users)
4. Production deployment
