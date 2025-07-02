# Admin API Deployment Guide

## Pre-Deployment Checklist

### 1. Prerequisites
- [ ] Cloudflare account with Workers plan
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Auth0 account and API configured
- [ ] Git repository with latest code

### 2. Auth0 Setup
1. Create a new API in Auth0 Dashboard:
   - Name: "Engage Admin API"
   - Identifier: `https://api.engage.lexara.com`
   - Signing Algorithm: RS256

2. Configure API Permissions:
   ```
   conversations:read
   conversations:write
   conversations:delete
   firms:read
   firms:write
   system:admin
   ```

3. Create Machine-to-Machine Application:
   - For testing the API
   - Grant necessary permissions

### 3. Environment Variables
Update these in the Cloudflare dashboard after deployment:

```bash
# Production Environment Variables
ENVIRONMENT=production
LOG_LEVEL=info
ALLOWED_ORIGINS=https://admin.engage.lexara.com,https://engage.lexara.com
```

## Deployment Steps

### Step 1: Login to Cloudflare
```bash
wrangler login
```

### Step 2: Run Deployment Script
```bash
cd /home/shawn/code/engage
./scripts/deploy-admin-api.sh
```

The script will:
1. Create D1 database if needed
2. Run database migrations
3. Create queues and R2 buckets
4. Set Auth0 secrets
5. Deploy the worker
6. Run health checks

### Step 3: Manual Configuration

#### Update D1 Database ID
After the D1 database is created, update `wrangler.admin-api.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "engage-db"
database_id = "YOUR_ACTUAL_D1_ID"  # Replace with actual ID
```

#### Configure Custom Domain (Optional)
In Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select "engage-admin-api"
3. Settings → Triggers → Custom Domains
4. Add: `api.engage.lexara.com`

### Step 4: Post-Deployment Verification

#### Test Health Endpoint
```bash
curl https://engage-admin-api.YOUR_SUBDOMAIN.workers.dev/v1/admin/health
```

#### Test with Auth Token
```bash
# Get token from Auth0
TOKEN="your-jwt-token"

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://engage-admin-api.YOUR_SUBDOMAIN.workers.dev/v1/admin/firms
```

## Troubleshooting

### Common Issues

1. **D1 Database Not Found**
   ```bash
   # List databases
   wrangler d1 list
   
   # Create manually if needed
   wrangler d1 create engage-db
   ```

2. **Queue Creation Failed**
   ```bash
   # Create queue manually
   wrangler queues create conversation-sync
   ```

3. **Auth0 Token Validation Failed**
   - Verify AUTH0_DOMAIN secret is set correctly (without https://)
   - Check AUTH0_AUDIENCE matches your API identifier
   - Ensure token has correct permissions

4. **CORS Issues**
   - Update ALLOWED_ORIGINS environment variable
   - Include your frontend URL

### Viewing Logs
```bash
# Real-time logs
wrangler tail engage-admin-api

# In Cloudflare Dashboard
Workers & Pages → engage-admin-api → Logs
```

## Production Considerations

### 1. Rate Limiting
The API includes built-in rate limiting. Configure limits in `middleware/rate-limit.ts`:
- Default: 100 requests/minute
- Strict: 20 requests/minute for sensitive operations
- Bulk: 10 operations/5 minutes

### 2. Monitoring
Set up alerts in Cloudflare Dashboard:
- Error rate > 1%
- Response time > 2s
- CPU time > 50ms

### 3. Backup Strategy
- D1 automatic backups (Enterprise plan)
- Export critical data regularly
- Document recovery procedures

### 4. Security
- Rotate Auth0 signing keys regularly
- Monitor failed authentication attempts
- Review audit logs weekly

## Rollback Procedure

If issues occur:

1. **Quick Rollback**
   ```bash
   # List deployments
   wrangler deployments list -c wrangler.admin-api.toml
   
   # Rollback to previous version
   wrangler rollback [deployment-id] -c wrangler.admin-api.toml
   ```

2. **Database Rollback**
   - D1 doesn't support automatic rollback
   - Keep migration scripts reversible
   - Test migrations in development first

## Next Steps

1. **Integration Testing**
   - Test all endpoints with real Auth0 tokens
   - Verify D1 queries perform well
   - Check DO→D1 sync reliability

2. **Frontend Integration**
   - Update frontend with API base URL
   - Configure Auth0 in frontend
   - Test end-to-end flows

3. **Documentation**
   - Generate API client from OpenAPI spec
   - Create integration guides
   - Document common use cases

## Support

For deployment issues:
1. Check Cloudflare Workers Discord
2. Review error logs in dashboard
3. Contact Cloudflare support (if on paid plan)

For application issues:
1. Check GitHub issues
2. Review CLAUDE.md for architecture
3. Contact development team