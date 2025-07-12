# Cloudflare D1 Remote Database Deployment Guide

## Prerequisites
- Cloudflare account with D1 access
- Logged in to Wrangler CLI (`npx wrangler login`)

## Step 1: Create the D1 Database on Cloudflare

Run this command in your terminal:
```bash
npx wrangler d1 create lexara-firm-portal
```

You'll see output like:
```
✅ Successfully created DB 'lexara-firm-portal' in region WNAM
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "lexara-firm-portal"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## Step 2: Update wrangler.toml

Copy the `database_id` from the output above and update your `wrangler.toml`:

```toml
# D1 Database bindings
[[d1_databases]]
binding = "DB"
database_name = "lexara-firm-portal"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # <- Replace with your actual ID
```

## Step 3: Deploy the Database Schema

Execute the schema on the remote database:
```bash
npx wrangler d1 execute lexara-firm-portal --file=./schema.sql --remote
```

## Step 4: Verify the Deployment

Check that tables were created:
```bash
npx wrangler d1 execute lexara-firm-portal --command="SELECT name FROM sqlite_master WHERE type='table';" --remote
```

You should see:
- firms
- firm_users
- user_invitations

## Step 5: Deploy the Application

Now deploy your application with the D1 database:
```bash
npm run deploy
```

## Testing the Live System

1. **View the test firm**:
   ```bash
   npx wrangler d1 execute lexara-firm-portal --command="SELECT * FROM firms;" --remote
   ```

2. **Monitor invitations**:
   ```bash
   npx wrangler d1 execute lexara-firm-portal --command="SELECT * FROM user_invitations;" --remote
   ```

3. **Check user accounts**:
   ```bash
   npx wrangler d1 execute lexara-firm-portal --command="SELECT * FROM firm_users;" --remote
   ```

## Troubleshooting

### "Authentication error"
- Run `npx wrangler logout` then `npx wrangler login`
- Ensure your account has D1 permissions

### "Database not found"
- Make sure the database_id in wrangler.toml matches the one from creation
- The database name must match exactly

### "Table not found"
- Re-run the schema deployment: `npx wrangler d1 execute lexara-firm-portal --file=./schema.sql --remote`

## Production Considerations

1. **Backups**: Set up regular D1 backups in the Cloudflare dashboard
2. **Monitoring**: Use Cloudflare Analytics to monitor D1 usage
3. **Rate Limits**: Be aware of D1 rate limits for your plan
4. **Data Retention**: Implement cleanup for expired invitations

## Next Steps

After deployment:
1. Test the invitation system on the live URL
2. Monitor the database for any issues
3. Set up proper Auth0 roles and permissions
4. Implement email notifications for invitations