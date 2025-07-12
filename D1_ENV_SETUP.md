# Environment-Specific D1 Database Setup

This guide explains the multi-environment D1 database setup for the Firm Portal.

## Database Naming Convention

Each environment has its own D1 database:
- **Development**: `dev-lexara-firm-portal`
- **Staging**: `staging-lexara-firm-portal`
- **Production**: `prod-lexara-firm-portal`

## Quick Setup

Use the environment-specific setup script:

```bash
# For development
./setup-d1-env.sh dev

# For staging
./setup-d1-env.sh staging

# For production (requires confirmation)
./setup-d1-env.sh production
```

## Manual Setup Steps

### 1. Create Environment-Specific Database

```bash
# Development
npx wrangler d1 create dev-lexara-firm-portal

# Staging
npx wrangler d1 create staging-lexara-firm-portal

# Production
npx wrangler d1 create prod-lexara-firm-portal
```

### 2. Update wrangler.toml

Each environment has its own D1 configuration section:

```toml
# Development
[[env.dev.d1_databases]]
binding = "DB"
database_name = "dev-lexara-firm-portal"
database_id = "your-dev-database-id"

# Staging
[[env.staging.d1_databases]]
binding = "DB"
database_name = "staging-lexara-firm-portal"
database_id = "your-staging-database-id"

# Production
[[env.production.d1_databases]]
binding = "DB"
database_name = "prod-lexara-firm-portal"
database_id = "your-prod-database-id"
```

### 3. Deploy Schema to Each Environment

```bash
# Development
npx wrangler d1 execute dev-lexara-firm-portal --file=./schema.sql --remote

# Staging
npx wrangler d1 execute staging-lexara-firm-portal --file=./schema.sql --remote

# Production
npx wrangler d1 execute prod-lexara-firm-portal --file=./schema.sql --remote
```

## Local Development

For local development, use the dev environment configuration:

```bash
# Set up local dev database
./setup-d1-local.sh

# Run commands against local dev database
npx wrangler d1 execute dev-lexara-firm-portal --command="SELECT * FROM user_invitations;" --local --env dev
```

## Deployment Commands

Deploy to specific environments:

```bash
# Deploy to development
npm run deploy:dev
# or
npx wrangler deploy --env dev

# Deploy to staging
npm run deploy:staging
# or
npx wrangler deploy --env staging

# Deploy to production
npm run deploy:production
# or
npx wrangler deploy --env production
```

## Environment-Specific Database Management

### View Invitations
```bash
# Development
npx wrangler d1 execute dev-lexara-firm-portal --command="SELECT * FROM user_invitations;" --remote

# Staging
npx wrangler d1 execute staging-lexara-firm-portal --command="SELECT * FROM user_invitations;" --remote

# Production
npx wrangler d1 execute prod-lexara-firm-portal --command="SELECT * FROM user_invitations;" --remote
```

### Clear Test Data (Dev Only!)
```bash
# Clear all invitations in dev
npx wrangler d1 execute dev-lexara-firm-portal --command="DELETE FROM user_invitations;" --remote

# Reset auto-increment (if needed)
npx wrangler d1 execute dev-lexara-firm-portal --command="DELETE FROM sqlite_sequence WHERE name='user_invitations';" --remote
```

## Best Practices

1. **Never share database IDs** between environments
2. **Test in dev first**, then staging, then production
3. **Backup production data** before schema changes
4. **Use environment-specific API tokens** for CI/CD
5. **Monitor each environment separately** in Cloudflare dashboard

## Troubleshooting

### "Database not found"
- Ensure you're using the correct database name for the environment
- Check that the database ID in wrangler.toml matches the created database

### "Permission denied"
- Verify you have D1 permissions for your Cloudflare account
- Check that you're logged in: `npx wrangler whoami`

### Local vs Remote Confusion
- Always use `--env dev` for local development
- Use `--remote` flag to operate on Cloudflare's servers
- Omit `--remote` to work with local SQLite database