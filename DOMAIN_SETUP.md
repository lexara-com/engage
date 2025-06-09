# lexara.app Domain Setup Guide

## Overview

This guide covers setting up the lexara.app domain with Cloudflare for the Engage legal AI platform.

## Domain Architecture

### Primary Domains
- `lexara.app` - Production (main site + client intake)
- `test.lexara.app` - Lexara team testing/staging  
- `dev.lexara.app` - Active development

### Service Subdomains
- `admin.lexara.app` - Admin dashboard (production)
- `admin.test.lexara.app` - Admin dashboard (test)
- `admin.dev.lexara.app` - Admin dashboard (dev)
- `api.lexara.app` - API endpoints (future)

## Cloudflare Setup Steps

### 1. Add Domain to Cloudflare

1. **Log into Cloudflare Dashboard**
2. **Add Site**: Add `lexara.app` to your Cloudflare account
3. **Choose Plan**: Select appropriate plan (Pro recommended for production)
4. **Update Nameservers**: Point your domain registrar to Cloudflare nameservers

### 2. DNS Configuration

Add the following DNS records in Cloudflare:

```
# Root domain (A record pointing to a placeholder IP, will be overridden by Workers)
Type: A
Name: lexara.app
Content: 192.0.2.1
Proxy: Enabled (Orange Cloud)

# Development subdomain
Type: A  
Name: dev.lexara.app
Content: 192.0.2.1
Proxy: Enabled (Orange Cloud)

# Test subdomain
Type: A
Name: test.lexara.app  
Content: 192.0.2.1
Proxy: Enabled (Orange Cloud)

# Admin subdomains
Type: A
Name: admin.lexara.app
Content: 192.0.2.1
Proxy: Enabled (Orange Cloud)

Type: A
Name: admin.test.lexara.app
Content: 192.0.2.1  
Proxy: Enabled (Orange Cloud)

Type: A
Name: admin.dev.lexara.app
Content: 192.0.2.1
Proxy: Enabled (Orange Cloud)
```

### 3. SSL/TLS Configuration

1. **SSL/TLS Mode**: Set to "Full (Strict)" in Cloudflare
2. **Always Use HTTPS**: Enable redirect
3. **HSTS**: Enable HTTP Strict Transport Security
4. **Min TLS Version**: Set to 1.2 or higher

### 4. Security Settings

1. **Security Level**: Set to "Medium" or "High"
2. **Browser Integrity Check**: Enable
3. **Challenge Passage**: Set to appropriate level
4. **WAF Rules**: Configure as needed for legal industry

## Worker Deployment

Once DNS is configured, deploy the workers:

### Development Environment
```bash
# Deploy main worker to dev.lexara.app
npm run deploy:dev

# Deploy admin worker to admin.dev.lexara.app  
npm run deploy:admin:dev
```

### Test Environment
```bash
# Deploy main worker to test.lexara.app
npm run deploy:test

# Deploy admin worker to admin.test.lexara.app
npm run deploy:admin:test
```

### Production Environment
```bash
# Deploy main worker to lexara.app
npm run deploy:production

# Deploy admin worker to admin.lexara.app
npm run deploy:admin:production
```

## Verification Steps

### 1. DNS Propagation
Check that DNS has propagated:
```bash
dig lexara.app
dig dev.lexara.app
dig test.lexara.app
dig admin.lexara.app
```

### 2. SSL Certificate
Verify SSL certificates are working:
```bash
curl -I https://lexara.app
curl -I https://dev.lexara.app
curl -I https://test.lexara.app
curl -I https://admin.lexara.app
```

### 3. Worker Deployment
Test each environment:
```bash
# Development
curl https://dev.lexara.app/health
curl https://admin.dev.lexara.app/health

# Test  
curl https://test.lexara.app/health
curl https://admin.test.lexara.app/health

# Production
curl https://lexara.app/health
curl https://admin.lexara.app/health
```

## Environment-Specific Configuration

### Development (dev.lexara.app)
- **Purpose**: Active development and testing
- **Auth0**: lexara-dev.us.auth0.com
- **Vectorize**: Separate dev indexes
- **Logging**: Debug level

### Test (test.lexara.app)
- **Purpose**: Lexara team testing and staging
- **Auth0**: lexara-test.us.auth0.com  
- **Vectorize**: Separate test indexes
- **Logging**: Info level

### Production (lexara.app)
- **Purpose**: Live law firm usage
- **Auth0**: lexara.us.auth0.com
- **Vectorize**: Production indexes
- **Logging**: Warn level

## Next Steps

After domain setup is complete:

1. **Auth0 Configuration**: Set up Auth0 tenants for each environment
2. **Vectorize Indexes**: Create environment-specific indexes
3. **Monitoring**: Set up Cloudflare Analytics and alerts
4. **Performance**: Configure caching and optimization rules
5. **Legal Compliance**: Review and configure security settings

## Troubleshooting

### Common Issues

**DNS Not Propagating**
- Check nameservers at registrar
- Wait up to 24 hours for global propagation
- Use different DNS checker tools

**SSL Certificate Issues**  
- Ensure proxy is enabled (orange cloud)
- Check SSL/TLS mode is "Full (Strict)"
- Wait for certificate provisioning (up to 15 minutes)

**Worker Routing Issues**
- Verify route patterns in wrangler.toml
- Check zone_name matches domain
- Ensure worker is deployed to correct environment

**CORS Issues**
- Verify CORS_ORIGINS environment variable
- Check admin worker CORS configuration
- Test with proper Origin headers

## Support

For domain setup issues:
- Cloudflare Community: https://community.cloudflare.com
- Cloudflare Support: https://support.cloudflare.com  
- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler/