# Auth0 Localhost Setup Guide

## Problem
The current Auth0 configuration only allows callbacks to the production domains (dev.console.lexara.app), which prevents testing on deployment-specific URLs or localhost.

## Solution
You need to add allowed callback URLs to your Auth0 application.

## Steps to Configure Auth0 for Localhost

### 1. Log into Auth0 Dashboard
- Go to https://manage.auth0.com
- Select your tenant: `<YOUR_AUTH0_TENANT>`

### 2. Navigate to Your Application
- Go to Applications → Applications
- Find your application: `<YOUR_AUTH0_CLIENT_ID>`
- Click on the application name

### 3. Add Allowed Callback URLs
In the "Allowed Callback URLs" field, add these URLs (one per line):

```
https://dev.console.lexara.app/firm/callback
http://localhost:4321/firm/callback
http://localhost:3000/firm/callback
http://localhost:8788/firm/callback
https://*.lexara-firm-portal-dev.pages.dev/firm/callback
```

### 4. Add Allowed Logout URLs
In the "Allowed Logout URLs" field, add:

```
https://dev.console.lexara.app/firm/login
http://localhost:4321/firm/login
http://localhost:3000/firm/login
http://localhost:8788/firm/login
https://*.lexara-firm-portal-dev.pages.dev/firm/login
```

### 5. Add Allowed Web Origins
In the "Allowed Web Origins" field, add:

```
https://dev.console.lexara.app
http://localhost:4321
http://localhost:3000
http://localhost:8788
https://*.lexara-firm-portal-dev.pages.dev
```

### 6. Save Changes
Click "Save Changes" at the bottom of the page.

## Testing Locally

### 1. Start Local Development Server
```bash
cd worktrees/firm-admin-portal
npm run dev
```

### 2. Access Login
Go to: http://localhost:4321/firm/login

### 3. Test Authentication Flow
- You should be redirected to Auth0
- After login, you'll be redirected back to http://localhost:4321/firm/callback
- The callback handler will create a session and redirect to the dashboard

## Testing Deployment URLs

Once Auth0 is configured with the wildcard domain, you can test any deployment URL:
- https://56e0cd67.lexara-firm-portal-dev.pages.dev/firm/login
- https://da4a8324.lexara-firm-portal-dev.pages.dev/firm/login
- etc.

## Environment Variables for Local Development

Create a `.env` file in the project root:

```env
# Auth0 Configuration
AUTH0_DOMAIN=<YOUR_AUTH0_DOMAIN>
AUTH0_CLIENT_ID=<YOUR_AUTH0_CLIENT_ID>
AUTH0_CLIENT_SECRET=<YOUR_AUTH0_CLIENT_SECRET>
AUTH0_AUDIENCE=https://api.lexara.app

# JWT Secret for session cookies
JWT_SECRET=your-jwt-secret-here

# Environment
NODE_ENV=development
```

## Troubleshooting

### "Callback URL mismatch" Error
- Ensure the exact URL is added to Auth0 allowed callbacks
- Check for trailing slashes
- Verify the protocol (http vs https)

### Session Not Persisting
- Check cookie domain settings in middleware
- For localhost, cookies should not have a domain set
- Ensure secure flag is false for http://localhost

### CORS Issues
- Add origins to Auth0 allowed web origins
- Check browser console for specific CORS errors

## Security Notes

1. **Never commit `.env` files** with real secrets
2. **Use different Auth0 applications** for dev/staging/production
3. **Rotate secrets regularly**
4. **Remove localhost URLs** from production Auth0 apps

## Alternative: Auth0 Development Mode

For quick testing without configuration:

1. Create a separate Auth0 application for development
2. Set it to "Development" mode in Auth0
3. This allows any callback URL temporarily
4. ⚠️ Never use development mode for production apps