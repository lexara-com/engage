# 🚀 Deploy UI Changes - Quick Guide

## What's Changed

I've updated the admin UI to use the real Admin API instead of mock data:

### Files Modified:
- `/src/pages/admin/conversations.astro` - Set `useMockData = false`
- `/src/pages/admin/conversations/[id].astro` - Set `useMockData = false`  
- `/src/pages/admin/index.astro` - Set `useMockData = false`

### New Features Added:
1. **Admin API Client** (`/src/utils/admin-api-client.ts`)
   - Complete TypeScript client for all Admin API endpoints
   - Automatic token management from cookies
   - Error handling with network fallback

2. **Authentication Middleware** (`/src/middleware/admin-auth.ts`)
   - JWT-based authentication
   - Auth0 integration ready
   - Login page with redirect handling

3. **Admin Pages**:
   - Dashboard with real-time stats
   - Conversations list with filtering and pagination
   - Conversation detail view with notes and status management
   - All connected to the Admin API

## Deploy Steps

### 1. Set Environment Variables (if needed)
```bash
# Set your Admin API URL if different from default
export PUBLIC_ADMIN_API_URL=https://engage-admin-api.YOUR_SUBDOMAIN.workers.dev/v1/admin
```

### 2. Deploy to Cloudflare

#### Option A: Deploy from your local machine
```bash
# Login to Cloudflare
wrangler login

# Deploy to production
npm run deploy:production
```

#### Option B: Deploy via CI/CD
If you have a CI/CD pipeline set up, push these changes to trigger deployment.

### 3. Verify Deployment

After deployment, test the admin portal:

1. Navigate to `https://your-domain.com/admin`
2. You should see the login page
3. In development mode, use:
   - Email: `admin@lawfirm.com`
   - Password: `password`
4. Check that the dashboard loads
5. Navigate to Conversations page
6. Try viewing a conversation detail

### Important Notes

1. **API Availability**: The UI will automatically fall back to mock data if the Admin API is unavailable. Check the browser console for messages like "API unavailable, falling back to mock data".

2. **CORS**: Make sure your Admin API has CORS configured to allow requests from your UI domain.

3. **Authentication**: The current setup uses a test token for development. Configure Auth0 properly for production.

## Troubleshooting

### If you see mock data instead of real data:
1. Check browser console for errors
2. Verify the Admin API URL is correct in the environment
3. Ensure the Admin API is deployed and accessible
4. Check CORS settings on the Admin API

### If authentication fails:
1. Verify Auth0 configuration
2. Check JWT token in browser cookies
3. Ensure middleware is properly configured

## Next Steps

Once deployed, you can:
1. Create the remaining admin pages (conflicts, documents, settings)
2. Configure Auth0 for production authentication
3. Add more features like real-time updates, advanced search, etc.