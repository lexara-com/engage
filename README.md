# Lexara Firm Admin Portal (Console)

The Lexara Firm Admin Portal provides law firms with a comprehensive dashboard to manage their Engage AI assistant instances, view conversation analytics, and administer user access.

## URLs

- **Production**: https://console.lexara.app
- **Staging**: https://staging.console.lexara.app
- **Development**: https://dev.console.lexara.app

## Features

- **Auth0 Authentication**: Secure single sign-on for law firm users
- **Dashboard Analytics**: Real-time conversation metrics and insights
- **User Management**: Role-based access control for firm members
- **Conversation Review**: Browse and analyze client conversations
- **Firm Settings**: Configure practice areas, branding, and preferences
- **Conflict Checking**: Review potential conflict alerts

## Tech Stack

- **Framework**: Astro with TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Auth0
- **Deployment**: Cloudflare Pages
- **API**: Cloudflare Workers (api-dev.lexara.app)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=lexara-firm-portal-dev
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── layouts/        # Page layouts
├── pages/          # Astro pages and API routes
│   ├── api/        # Server-side API endpoints
│   └── firm/       # Firm portal pages
├── styles/         # Global styles
├── types/          # TypeScript type definitions
└── utils/          # Utility functions and API client
```

## Environment Variables

Required environment variables for deployment:

- `AUTH0_DOMAIN`: Auth0 tenant domain
- `AUTH0_CLIENT_ID`: Auth0 application client ID
- `AUTH0_CLIENT_SECRET`: Auth0 application client secret
- `AUTH0_AUDIENCE`: Auth0 API audience
- `API_URL`: Backend API URL (e.g., https://api-dev.lexara.app)

## Auth0 Configuration

Configure Auth0 with the following URLs:

- **Allowed Callback URLs**: `https://[domain]/firm/callback`
- **Allowed Logout URLs**: `https://[domain]`
- **Allowed Web Origins**: `https://[domain]`

Replace `[domain]` with the appropriate environment domain.

## API Integration

The portal integrates with the Lexara API Worker at:
- Development: `https://api-dev.lexara.app`
- Production: `https://api.lexara.app`

All API calls are proxied through server-side endpoints in `/src/pages/api/` for security.

## Deployment

The portal is deployed using Cloudflare Pages:

1. Build the project: `npm run build`
2. Deploy to Pages: `npx wrangler pages deploy dist --project-name=lexara-firm-portal-[env]`
3. Configure custom domain in Cloudflare dashboard
4. Update DNS records to point to Pages deployment

## Contributing

See CLAUDE.md for detailed development guidelines and architectural decisions.