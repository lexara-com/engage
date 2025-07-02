# 🚀 Deploy Admin API - Quick Start

## Prerequisites
1. **Cloudflare Account**: Sign up at https://cloudflare.com
2. **Wrangler CLI**: Install with `npm install -g wrangler`
3. **Auth0 Account**: For JWT authentication

## Quick Deploy (5 minutes)

### 1. Login to Cloudflare
```bash
wrangler login
```

### 2. Run Deployment
```bash
npm run deploy:admin-api
```

This script will:
- ✅ Create D1 database
- ✅ Set up queues and storage
- ✅ Deploy the API worker
- ✅ Run health checks

### 3. Set Auth0 Secrets
When prompted, enter:
- **AUTH0_DOMAIN**: Your Auth0 domain (e.g., `your-app.auth0.com`)
- **AUTH0_AUDIENCE**: Your API identifier (e.g., `https://api.engage.lexara.com`)

## Verify Deployment

### Health Check
```bash
# Replace YOUR_SUBDOMAIN with your Cloudflare subdomain
curl https://engage-admin-api.YOUR_SUBDOMAIN.workers.dev/v1/admin/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "engage-admin-api",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Development Commands

```bash
# Run locally
npm run dev:admin-api

# View logs
npm run tail:admin-api

# Deploy updates
npm run deploy:admin-api
```

## API Endpoints

Base URL: `https://engage-admin-api.YOUR_SUBDOMAIN.workers.dev/v1/admin`

### Available Endpoints
- `GET /health` - Health check (no auth)
- `GET /firms/{firmId}/conversations` - List conversations
- `GET /firms/{firmId}/conversations/{id}` - Get conversation details
- `PUT /firms/{firmId}/conversations/{id}` - Update metadata
- `POST /firms/{firmId}/conversations/{id}/notes` - Add note
- `POST /firms/{firmId}/conversations/{id}/actions` - Perform action
- `DELETE /firms/{firmId}/conversations/{id}` - Delete conversation

## Next Steps

1. **Configure Auth0**:
   - Create API in Auth0 Dashboard
   - Set up permissions
   - Create test application

2. **Test with Token**:
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://engage-admin-api.YOUR_SUBDOMAIN.workers.dev/v1/admin/firms/YOUR_FIRM_ID/conversations
   ```

3. **Production Setup**:
   - Configure custom domain
   - Update CORS origins
   - Set up monitoring

## Troubleshooting

### D1 Database Issues
```bash
# List databases
wrangler d1 list

# Create manually
wrangler d1 create engage-db

# Apply schema
wrangler d1 execute engage-db --file=src/api/admin/database/schema.sql
```

### View Logs
```bash
wrangler tail engage-admin-api
```

### Common Errors
- **401 Unauthorized**: Check Auth0 configuration
- **403 Forbidden**: Verify firm access permissions
- **500 Server Error**: Check logs for details

## Support

See full documentation in:
- `src/api/admin/README.md` - API overview
- `src/api/admin/DEPLOYMENT_GUIDE.md` - Detailed deployment
- `src/api/admin/openapi.yaml` - API specification