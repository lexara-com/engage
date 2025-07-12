# Deploy D1 Database to Cloudflare

## Step-by-Step Guide for Development Environment

### 1. Login to Cloudflare
```bash
npx wrangler login
```

### 2. Create the Development Database
```bash
npx wrangler d1 create dev-lexara-firm-portal
```

**Expected output:**
```
✅ Successfully created DB 'dev-lexara-firm-portal' in region WNAM
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "dev-lexara-firm-portal"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 3. Update wrangler.toml

Copy the `database_id` from the output and update the dev section in `wrangler.toml`:

```toml
# D1 Database for development
[[env.dev.d1_databases]]
binding = "DB"
database_name = "dev-lexara-firm-portal"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # <- Paste your actual ID here
```

### 4. Deploy the Schema
```bash
npx wrangler d1 execute dev-lexara-firm-portal --file=./schema.sql --remote
```

### 5. Verify the Deployment
```bash
# Check tables were created
npx wrangler d1 execute dev-lexara-firm-portal --command="SELECT name FROM sqlite_master WHERE type='table';" --remote

# Verify test firm exists
npx wrangler d1 execute dev-lexara-firm-portal --command="SELECT * FROM firms;" --remote
```

### 6. Deploy the Application
```bash
npm run deploy:dev
```

## For Other Environments

### Staging Setup
```bash
# Create staging database
npx wrangler d1 create staging-lexara-firm-portal

# Update staging section in wrangler.toml with the database ID

# Deploy schema
npx wrangler d1 execute staging-lexara-firm-portal --file=./schema.sql --remote

# Deploy application
npm run deploy:staging
```

### Production Setup
```bash
# Create production database (be careful!)
npx wrangler d1 create prod-lexara-firm-portal

# Update production section in wrangler.toml with the database ID

# Deploy schema
npx wrangler d1 execute prod-lexara-firm-portal --file=./schema.sql --remote

# Deploy application
npm run deploy:production
```

## Useful Commands

### Monitor Invitations
```bash
# Development
npx wrangler d1 execute dev-lexara-firm-portal --command="SELECT * FROM user_invitations ORDER BY created_at DESC;" --remote

# Count invitations by status
npx wrangler d1 execute dev-lexara-firm-portal --command="SELECT status, COUNT(*) as count FROM user_invitations GROUP BY status;" --remote
```

### Database Maintenance
```bash
# Clean up expired invitations older than 30 days (dev only)
npx wrangler d1 execute dev-lexara-firm-portal --command="DELETE FROM user_invitations WHERE status='expired' AND expires_at < datetime('now', '-30 days');" --remote

# View database size
npx wrangler d1 execute dev-lexara-firm-portal --command="SELECT page_count * page_size as size_in_bytes FROM pragma_page_count(), pragma_page_size();" --remote
```

## Troubleshooting

### "Authentication error"
```bash
npx wrangler logout
npx wrangler login
```

### "Database not found"
- Make sure you're using the exact database name
- Verify the database was created: `npx wrangler d1 list`

### "No such table"
- Re-run the schema deployment
- Check if you're using the correct environment

### Testing After Deployment
1. Visit your dev URL
2. Login with your test account
3. Navigate to `/firm/users/invite`
4. Create a test invitation
5. Verify it appears in the database:
   ```bash
   npx wrangler d1 execute dev-lexara-firm-portal --command="SELECT * FROM user_invitations;" --remote
   ```