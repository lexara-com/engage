# API Migration Guide: Secure Endpoints

**Date**: January 3, 2025  
**Status**: ✅ New Secure APIs Implemented

## Overview

We've implemented new secure API endpoints that use database-backed operations with proper multi-tenant isolation. All user operations are now automatically scoped to the authenticated user's firm, preventing cross-firm data access.

## Migration Summary

### Old Endpoints (Auth0-based) → New Endpoints (Database-backed)

| Operation | Old Endpoint | New Endpoint | Key Changes |
|-----------|--------------|--------------|-------------|
| List Users | `GET /api/v1/firm/users?firmId={id}` | `GET /api/v1/secure/users` | No firmId param needed |
| Get User | `GET /api/v1/firm/users/{userId}?firmId={id}` | `GET /api/v1/secure/users/{userId}` | Automatic firm scoping |
| Create User | `POST /api/v1/firm/users` | `POST /api/v1/secure/users` | Returns DB user ID |
| Update User | `PATCH /api/v1/firm/users/{userId}` | `PATCH /api/v1/secure/users/{userId}` | Enforces firm ownership |
| Delete User | `DELETE /api/v1/firm/users/{userId}` | `DELETE /api/v1/secure/users/{userId}` | Prevents last admin removal |
| Get Session | `GET /api/v1/user/permissions` | `GET /api/v1/secure/session` | Enhanced session info |
| Get Firm | `GET /api/v1/firm/settings` | `GET /api/v1/secure/firm` | Includes user stats |
| Update Firm | `PATCH /api/v1/firm/settings` | `PATCH /api/v1/secure/firm` | Domain validation |

## Key Improvements

### 1. Automatic Firm Scoping
- No need to pass `firmId` in requests
- FirmId extracted from authenticated user context
- All operations automatically scoped to user's firm

### 2. Enhanced Security
- Multi-tenant isolation at database level
- Firm ownership verified on every operation
- Audit logging for all modifications

### 3. Better Validation
- Last admin protection
- Domain uniqueness checks
- Email format validation
- Role validation

## Frontend Code Changes

### Before (Old API)
```typescript
// List users - manual firm ID
const response = await fetch('/api/v1/firm/users?firmId=' + currentFirmId, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Update user - complex permission logic
const response = await fetch(`/api/v1/firm/users/${userId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ 
    userId, 
    role, 
    firmId: currentFirmId 
  })
});
```

### After (New API)
```typescript
// List users - automatic firm scoping
const response = await fetch('/api/v1/secure/users', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Update user - simplified
const response = await fetch(`/api/v1/secure/users/${userId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ role }) // No firmId needed!
});
```

## Response Format Changes

### User Object
```typescript
// Old format (Auth0)
{
  user_id: "auth0|123",
  email: "user@example.com",
  user_metadata: {
    firstName: "John",
    lastName: "Doe",
    role: "admin",
    firmId: "firm_123"
  }
}

// New format (Database)
{
  id: "user_123",
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  role: "admin",
  status: "active",
  lastLogin: "2025-01-03T10:00:00Z",
  createdAt: "2024-12-01T08:00:00Z",
  permissions: {
    "firm:admin": true,
    "firm:manage_users": true
  }
}
```

### Error Responses
```typescript
// Consistent error format
{
  success: false,
  error: {
    code: "USER_NOT_FOUND",
    message: "User not found or access denied"
  }
}

// Common error codes:
// - AUTHENTICATION_REQUIRED
// - PERMISSION_DENIED
// - USER_NOT_FOUND
// - EMAIL_EXISTS
// - VALIDATION_ERROR
// - CANNOT_REMOVE_SELF
// - LAST_ADMIN_ERROR
```

## Migration Steps

### 1. Update API Client
```typescript
// api-client.ts
export class SecureApiClient {
  private baseUrl = '/api/v1/secure';
  
  async listUsers() {
    return this.fetch('/users');
  }
  
  async getUser(userId: string) {
    return this.fetch(`/users/${userId}`);
  }
  
  async createUser(data: CreateUserDto) {
    return this.fetch('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async updateUser(userId: string, data: UpdateUserDto) {
    return this.fetch(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
  
  async deleteUser(userId: string) {
    return this.fetch(`/users/${userId}`, {
      method: 'DELETE'
    });
  }
  
  private async fetch(path: string, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new ApiError(data.error.code, data.error.message);
    }
    
    return data.data;
  }
}
```

### 2. Update Components
```typescript
// UserList.tsx
const UserList = () => {
  const [users, setUsers] = useState([]);
  const api = new SecureApiClient();
  
  useEffect(() => {
    // No need to pass firmId anymore!
    api.listUsers().then(data => {
      setUsers(data.users);
    });
  }, []);
  
  const handleRoleChange = async (userId, newRole) => {
    try {
      // Simplified - no firmId needed
      await api.updateUser(userId, { role: newRole });
      // Refresh users
      const data = await api.listUsers();
      setUsers(data.users);
    } catch (error) {
      if (error.code === 'LAST_ADMIN_ERROR') {
        alert('Cannot change role - this is the last admin');
      }
    }
  };
  
  return (
    <div>
      {users.map(user => (
        <UserCard 
          key={user.id}
          user={user}
          onRoleChange={handleRoleChange}
        />
      ))}
    </div>
  );
};
```

### 3. Update Permission Checks
```typescript
// Old way - complex client-side logic
const canRemoveUser = (currentUser, targetUser, allUsers) => {
  if (currentUser.role !== 'admin') return false;
  if (currentUser.id === targetUser.id) return false;
  if (targetUser.role === 'admin') {
    const adminCount = allUsers.filter(u => u.role === 'admin').length;
    return adminCount > 1;
  }
  return true;
};

// New way - server handles validation
const handleRemoveUser = async (userId) => {
  try {
    await api.deleteUser(userId);
    // Success - refresh list
  } catch (error) {
    // Server returns specific error codes
    switch (error.code) {
      case 'PERMISSION_DENIED':
        alert('You do not have permission');
        break;
      case 'CANNOT_REMOVE_SELF':
        alert('You cannot remove yourself');
        break;
      case 'LAST_ADMIN_ERROR':
        alert('Cannot remove the last admin');
        break;
    }
  }
};
```

## Testing the Migration

### 1. Test Multi-Tenant Isolation
```typescript
// This should fail with 404
try {
  // Try to access user from different firm
  await api.getUser('user_from_different_firm');
} catch (error) {
  expect(error.code).toBe('USER_NOT_FOUND');
}
```

### 2. Test Permission Enforcement
```typescript
// Login as non-admin
const api = new SecureApiClient(staffUserToken);

try {
  await api.createUser({ email: 'test@example.com', role: 'admin' });
} catch (error) {
  expect(error.code).toBe('PERMISSION_DENIED');
}
```

### 3. Test Business Rules
```typescript
// Test last admin protection
const users = await api.listUsers();
const lastAdmin = users.users.find(u => u.role === 'admin');

try {
  await api.updateUser(lastAdmin.id, { role: 'staff' });
} catch (error) {
  expect(error.message).toContain('last admin');
}
```

## Rollback Plan

If issues arise during migration:

1. **Feature Flag**: Use environment variable to switch between old/new APIs
```typescript
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';
const useSecureApi = API_VERSION === 'v2';

const apiClient = useSecureApi 
  ? new SecureApiClient() 
  : new LegacyApiClient();
```

2. **Gradual Migration**: Migrate one feature at a time
- Phase 1: User listing (read-only)
- Phase 2: User creation
- Phase 3: User updates/deletion
- Phase 4: Firm settings

3. **Monitoring**: Track API usage and errors
```typescript
// Add telemetry
const api = new SecureApiClient({
  onError: (error) => {
    console.error('API Error:', error);
    // Send to monitoring service
    telemetry.trackError('api_error', {
      endpoint: error.endpoint,
      code: error.code,
      message: error.message
    });
  }
});
```

## Benefits Summary

1. **Security**: Automatic firm isolation prevents data leaks
2. **Simplicity**: No need to pass firmId everywhere
3. **Consistency**: Uniform response format and error handling
4. **Performance**: Direct database queries instead of Auth0 API calls
5. **Auditability**: All changes logged with user/IP/timestamp

## Next Steps

1. Update frontend components to use new endpoints
2. Add comprehensive error handling
3. Update user documentation
4. Monitor API performance
5. Deprecate old endpoints after successful migration