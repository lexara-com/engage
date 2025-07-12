# D1 Database Setup for Firm Portal

This guide explains how to set up the Cloudflare D1 database for storing user invitations and other firm data.

## Quick Setup Scripts

We've provided setup scripts to simplify the process:

### For Production/Remote Database:
```bash
./setup-d1-remote.sh
```
This script will:
1. Create the D1 database on Cloudflare
2. Guide you to update wrangler.toml with the database ID
3. Deploy the schema to the remote database
4. Verify the setup

### For Local Development:
```bash
./setup-d1-local.sh
```
This script will:
1. Create the local database schema
2. Verify the tables are created
3. Show the test firm data

## Manual Setup

1. **Create the D1 database**:
   ```bash
   npx wrangler d1 create lexara-firm-portal --experimental-backend
   ```

2. **Update wrangler.toml**:
   Copy the database ID from the output and update the `database_id` field in `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "lexara-firm-portal"
   database_id = "YOUR_ACTUAL_DATABASE_ID_HERE"
   ```

3. **Initialize the database schema**:
   ```bash
   # For local development
   npx wrangler d1 execute lexara-firm-portal --file=./schema.sql --local
   
   # For remote database
   npx wrangler d1 execute lexara-firm-portal --file=./schema.sql --remote
   ```

## Database Schema

The database includes the following tables:

### firms
- Stores law firm information
- Fields: id, name, email, domain, subscription details

### firm_users
- Stores users associated with each firm
- Links to Auth0 user IDs
- Tracks roles and permissions

### user_invitations
- Stores pending user invitations
- Tracks invitation status (pending, accepted, expired)
- Automatically expires after 7 days

## Using the Database

The invitation system now uses D1 for persistence:

1. **Creating invitations**: When you send an invitation through `/firm/users/invite`, it's stored in D1
2. **Viewing invitations**: The recent invitations list pulls data from D1
3. **Status updates**: Invitations automatically expire after 7 days

## Local Development

For local development, D1 uses a SQLite database stored in `.wrangler/state/v3/d1/`.

To view local database contents:
```bash
# List tables
npx wrangler d1 execute lexara-firm-portal --command="SELECT name FROM sqlite_master WHERE type='table';" --local

# View invitations
npx wrangler d1 execute lexara-firm-portal --command="SELECT * FROM user_invitations;" --local

# View firms
npx wrangler d1 execute lexara-firm-portal --command="SELECT * FROM firms;" --local
```

## Troubleshooting

1. **"Database not configured" error**: Make sure the database ID is set in wrangler.toml
2. **No data showing**: Check if the schema was executed properly
3. **Permission errors**: Ensure your Cloudflare account has D1 access

## Next Steps

1. Implement email service integration to actually send invitation emails
2. Add Auth0 Management API integration to create users when invitations are accepted
3. Implement user deletion and role updates
4. Add audit logging for all user management actions