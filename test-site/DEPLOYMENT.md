# Test Site - Deployment Instructions

## Overview
This is a minimal Astro test site with a landing page and dashboard page. It's designed to verify that basic Astro functionality works with Cloudflare Pages deployment.

## Pages
- **Landing Page** (`/`) - Simple welcome page with navigation to dashboard
- **Dashboard** (`/dashboard`) - Mock dashboard with stats and navigation

## Local Development
```bash
# Install dependencies
pnpm install

# Start dev server
pnpm run dev

# Build for production
pnpm run build
```

## Cloudflare Pages Deployment

### Option 1: Connect Git Repository
1. Go to [Cloudflare Pages](https://dash.cloudflare.com/pages)
2. Click "Create a project"
3. Connect your Git repository
4. Set build settings:
   - **Build command**: `pnpm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `test-site` (if deploying from monorepo)

### Option 2: Direct Upload
1. Build the site locally: `pnpm run build`
2. Go to [Cloudflare Pages](https://dash.cloudflare.com/pages)
3. Click "Upload assets"
4. Upload the contents of the `dist/` folder

### Build Settings
- **Framework**: Astro
- **Build command**: `pnpm run build`
- **Build output directory**: `dist`
- **Node.js version**: 18+ (set in environment variables if needed)

## Project Structure
```
test-site/
├── src/
│   └── pages/
│       ├── index.astro      # Landing page
│       └── dashboard.astro  # Dashboard page
├── public/
│   └── favicon.svg
├── astro.config.mjs         # Astro configuration (static build)
├── package.json
└── dist/                    # Built files (after running build)
    ├── index.html
    ├── dashboard/
    │   └── index.html
    └── favicon.svg
```

## Features Tested
- ✅ Basic Astro page rendering
- ✅ Route-based navigation between pages
- ✅ Static asset handling (favicon)
- ✅ CSS styling and responsive design
- ✅ Static build generation
- ✅ Ready for Cloudflare Pages deployment

## ✅ Deployment Status: LIVE

### Production URLs:
- **Custom Domain**: https://test.lexara.app
- **Primary**: https://lexara-test-site.pages.dev  
- **Latest**: https://9683606c.lexara-test-site.pages.dev

### Verified Working:
- ✅ Landing page: https://test.lexara.app
- ✅ Dashboard page: https://test.lexara.app/dashboard
- ✅ Static assets and favicon
- ✅ Responsive design and styling
- ✅ Navigation between pages

## ✅ Authentication Flow: READY FOR TESTING

### Auth0 Configuration:
- **Domain**: `dev-sv0pf6cz2530xz0o.us.auth0.com`
- **Client ID**: `nI1qZf7RIHMfJTTrQQoosfWu9d204apX`
- **Callback URL**: `https://test.lexara.app/callback`
- **Application Type**: Single Page Application (SPA)

### Authentication Pages:
- ✅ **Login**: https://test.lexara.app/login
- ✅ **Callback**: https://test.lexara.app/callback
- ✅ **Protected Dashboard**: https://test.lexara.app/dashboard (requires auth)

### How It Works:
1. User visits `/dashboard` → Redirected to `/login?returnTo=%2Fdashboard`
2. Login page redirects to Auth0 with `state` parameter preserving deep link
3. Auth0 redirects back to `/callback` with authorization code
4. Callback page processes Auth0 response and creates session
5. User redirected to original destination (`/dashboard`)

### Test the Flow:
```bash
# 1. Visit protected page (should redirect to login)
curl -I https://test.lexara.app/dashboard

# 2. Visit login page (should load Auth0 login flow)
open https://test.lexara.app/login

# 3. Complete login and verify dashboard access
```

### Ready for Production:
This isolated test environment demonstrates the complete Auth0 authentication flow that can now be applied to fix the main application's authentication issues.