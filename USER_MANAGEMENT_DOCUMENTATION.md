# User Management System Documentation

## Overview
The user management system provides comprehensive functionality for law firms to manage their team members, including viewing users, editing roles, sending password resets, and deleting users. It integrates with Auth0 for authentication and user lifecycle management.

## Architecture

### Components
1. **Auth0 Management Client** (`src/utils/auth0-management-client.ts`)
   - Handles all Auth0 Management API operations
   - Manages M2M authentication tokens
   - Provides methods for user CRUD operations

2. **User Management Storage** (`src/utils/user-management-storage.ts`)
   - D1 database operations for user data
   - Audit logging
   - User statistics

3. **User Management Service** (`src/services/user-management-service.ts`)
   - Orchestrates Auth0 and database operations
   - Business logic for user management
   - Synchronization between Auth0 and local database

4. **UI Components**
   - User list page (`src/pages/firm/users/index.astro`)
   - Edit user modal (`src/components/EditUserModal.astro`)
   - User invitation page (existing)

## Database Schema

### Updated Tables

#### firm_users
```sql
- id (TEXT PRIMARY KEY)
- firm_id (TEXT)
- auth0_user_id (TEXT UNIQUE)
- email (TEXT)
- name (TEXT)
- role (TEXT) - 'firm:admin', 'firm:lawyer', 'firm:staff', 'firm:viewer'
- is_active (BOOLEAN)
- last_synced_at (DATETIME) - NEW
- deleted_at (DATETIME) - NEW
- deletion_reason (TEXT) - NEW
- created_at (DATETIME)
- updated_at (DATETIME)
```

#### user_audit_logs (NEW)
```sql
- id (TEXT PRIMARY KEY)
- firm_id (TEXT)
- user_id (TEXT)
- performed_by (TEXT)
- action (TEXT) - 'created', 'updated', 'deleted', 'blocked', 'unblocked', 'role_changed', 'password_reset'
- details (TEXT) - JSON string
- ip_address (TEXT)
- user_agent (TEXT)
- created_at (DATETIME)
```

## API Endpoints

### User Management APIs
- `GET /api/firm/users` - List users with pagination and filters
- `GET /api/firm/users/[id]` - Get single user details
- `PATCH /api/firm/users/[id]` - Update user role/status
- `DELETE /api/firm/users/[id]` - Delete user
- `POST /api/firm/users/[id]/reset-password` - Send password reset
- `GET /api/firm/users/stats` - Get user statistics
- `POST /api/firm/invitations/[id]/accept` - Accept invitation and create user

### Request/Response Examples

#### List Users
```http
GET /api/firm/users?page=0&pageSize=50&search=john&role=firm:lawyer&status=active

Response:
{
  "success": true,
  "users": [...],
  "total": 25,
  "page": 0,
  "pageSize": 50,
  "hasMore": false
}
```

#### Update User
```http
PATCH /api/firm/users/usr_123
{
  "role": "firm:admin",
  "isActive": true
}

Response:
{
  "success": true,
  "user": { ... }
}
```

## Features

### 1. User List Page
- **Path**: `/firm/users`
- **Features**:
  - Paginated table view
  - Search by name/email
  - Filter by role and status
  - Quick actions (View, Edit, Delete)
  - User statistics cards

### 2. Edit User Modal
- Change user role
- Activate/deactivate user
- Syncs changes with Auth0

### 3. User Details Modal
- View complete user profile
- See audit history
- Send password reset
- View permissions

### 4. Delete User
- Soft delete with reason
- Prevents deleting last admin
- Creates audit log
- Removes from Auth0

### 5. Password Reset
- Sends reset email via Auth0
- Creates audit log
- Shows success/error feedback

## Security & Permissions

### Role-Based Access
- Only `firm:admin` users can:
  - View user management page
  - Edit user roles
  - Delete users
  - Send password resets

### Audit Logging
- All user management actions are logged
- Includes IP address and user agent
- Tracks who performed each action

### Data Protection
- Soft delete preserves data integrity
- Cannot delete last administrator
- Auth0 sync ensures consistency

## Auth0 Integration

### Required Auth0 Configuration
1. Create Management API application
2. Grant required scopes:
   - `read:users`
   - `update:users`
   - `delete:users`
   - `create:user_tickets`

### Environment Variables
```env
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_MGMT_CLIENT_ID=your-mgmt-client-id
AUTH0_MGMT_CLIENT_SECRET=your-mgmt-client-secret
```

### Wrangler Secrets
```bash
wrangler secret put AUTH0_CLIENT_SECRET --env dev
wrangler secret put AUTH0_MGMT_CLIENT_ID --env dev
wrangler secret put AUTH0_MGMT_CLIENT_SECRET --env dev
wrangler secret put JWT_SECRET --env dev
```

## Testing

### Unit Tests
- `tests/user-management.test.ts` - Storage and service tests
- Uses mocked D1 database
- Tests all CRUD operations

### Integration Tests
- Tests with real D1 database
- Verifies Auth0 API integration
- End-to-end user workflows

### Running Tests
```bash
# Run unit tests
npm run test tests/user-management.test.ts

# Run all tests
npm run test:run
```

## Future Enhancements

### Email Service Integration
- Send invitation emails
- Password reset notifications
- Role change notifications

### Bulk Operations
- Select multiple users
- Bulk activate/deactivate
- Bulk role changes

### Advanced Filtering
- Date range filters
- Multiple role selection
- Export user list

### Auth0 Webhooks
- Real-time sync from Auth0
- Login event tracking
- Security alerts

## Troubleshooting

### Common Issues

1. **D1 Binding Not Found**
   - Ensure `context.locals.runtime.env.DB` is used
   - Check wrangler.toml configuration

2. **Auth0 API Errors**
   - Verify Management API credentials
   - Check granted scopes
   - Monitor rate limits

3. **User Not Syncing**
   - Check `last_synced_at` timestamp
   - Verify Auth0 user exists
   - Check network connectivity

### Debug Mode
Enable debug logging:
```javascript
console.log('D1 binding:', context.locals.runtime);
console.log('Auth0 response:', response);
```

## Migration Guide

### From Existing System
1. Run database migration: `migrations/002_user_management_updates.sql`
2. Set up Auth0 Management API application
3. Configure environment variables
4. Deploy and test

### Rollback Procedure
1. Restore firm_users table from backup
2. Remove user_audit_logs table
3. Revert to previous code version

## Performance Considerations

### Caching
- Auth0 tokens cached for 55 minutes
- User data synced hourly
- Consider Redis for production

### Rate Limits
- Auth0: 1000 requests/minute
- Implement request queuing
- Use bulk operations where possible

### Database Optimization
- Indexes on firm_id, email, role
- Soft delete preserves performance
- Regular cleanup of old audit logs