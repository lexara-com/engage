# Database Client API Reference

**Last Updated**: January 3, 2025  
**Status**: ✅ Implemented, 🚧 Security Updates Needed

## Overview

The `AuthorizationDatabaseClient` provides a clean interface for interacting with Cloudflare D1 database for enterprise-grade user management. This document describes the actual implementation, not the test expectations.

## Important Notes

### ⚠️ Security Gap Identified

The current implementation does **not** enforce multi-tenant isolation at the method level. This is a critical security issue that needs immediate attention.

**Current**: Methods like `getUser(id)` can access any user regardless of firm  
**Required**: Methods should be `getUser(firmId, id)` to enforce isolation

### Field Naming Convention

The database uses **snake_case** for all fields:
- `firm_id` (not `firmId`)
- `auth0_id` (not `auth0UserId`)
- `first_name` (not `firstName`)
- `last_name` (not `lastName`)
- `created_at` / `updated_at` (timestamps)

## Constructor

```typescript
constructor(database: D1Database)
```

Creates a new database client instance.

## Firm Operations

### createFirm

```typescript
async createFirm(firmData: CreateEntity<Firm>): Promise<Firm>
```

Creates a new firm with auto-generated UUID.

**Parameters:**
- `firmData`: Object containing name, domain, plan, settings, status

**Returns:** Created firm object with id and timestamps

**Example:**
```typescript
const firm = await dbClient.createFirm({
  name: 'Smith & Associates',
  plan: 'starter',
  settings: { size: '1-5', practiceAreas: ['personal_injury'] },
  status: 'active'
});
```

### getFirm

```typescript
async getFirm(id: string): Promise<Firm | null>
```

Retrieves a firm by ID.

**Note:** Method is named `getFirm`, not `getFirmById`

### getFirmByDomain

```typescript
async getFirmByDomain(domain: string): Promise<Firm | null>
```

Retrieves a firm by domain name.

### updateFirm

```typescript
async updateFirm(id: string, updates: UpdateEntity<Firm>): Promise<Firm>
```

Updates firm fields. Automatically updates `updated_at` timestamp.

### ❌ Missing Methods

The following methods are expected by tests but not implemented:
- `deleteFirm(id: string): Promise<boolean>`
- `listFirms(options): Promise<Firm[]>`

## User Operations

### createUser

```typescript
async createUser(userData: CreateEntity<User>): Promise<User>
```

Creates a new user with auto-generated UUID.

**Required Fields:**
- `firm_id`: The firm this user belongs to
- `email`: User's email address
- `role`: User role (e.g., 'admin', 'staff')

**Optional Fields:**
- `auth0_id`: Auth0 user identifier
- `first_name`, `last_name`: User's name
- `permissions`: Object with permission flags
- `status`: User status (defaults to 'active')

### getUser

```typescript
async getUser(id: string): Promise<User | null>
```

**⚠️ Security Issue**: This method does not check firm_id, allowing cross-tenant access.

**Current Implementation:**
```typescript
const user = await dbClient.getUser('user_123');
// Returns user regardless of firm!
```

**Required Implementation:**
```typescript
const user = await dbClient.getUser('firm_123', 'user_123');
// Should only return if user belongs to firm_123
```

### getUserByAuth0Id

```typescript
async getUserByAuth0Id(auth0Id: string): Promise<User | null>
```

Retrieves a user by their Auth0 identifier.

**SQL Query**: `SELECT * FROM users WHERE auth0_id = ?`

### getUserByEmail

```typescript
async getUserByEmail(email: string, firmId: string): Promise<User | null>
```

Retrieves a user by email within a specific firm.

**Note:** This method correctly includes firmId for isolation.

### updateUser

```typescript
async updateUser(id: string, updates: UpdateEntity<User>): Promise<User>
```

**⚠️ Security Issue**: Does not verify firm ownership before updating.

### deleteUser

```typescript
async deleteUser(id: string): Promise<void>
```

**⚠️ Security Issue**: Can delete any user regardless of firm.

### listFirmUsers

```typescript
async listFirmUsers(firmId: string): Promise<User[]>
```

Lists all users for a specific firm.

**Note:** Method is named `listFirmUsers`, not `listUsers`

### ❌ Missing Methods

- `updateUserLastLogin(id: string): Promise<void>`
- `listUsers(firmId: string, options): Promise<User[]>` with filtering

## Session Operations

### createSession

```typescript
async createSession(sessionData: Omit<UserSession, 'id' | 'created_at'>): Promise<UserSession>
```

Creates a new user session with auto-generated ID.

### getSession

```typescript
async getSession(id: string): Promise<UserSession | null>
```

### getSessionByTokenHash

```typescript
async getSessionByTokenHash(tokenHash: string): Promise<UserSession | null>
```

Retrieves active session by token hash (checks expiration).

### deleteSession

```typescript
async deleteSession(id: string): Promise<void>
```

### deleteExpiredSessions

```typescript
async deleteExpiredSessions(): Promise<number>
```

Returns number of deleted sessions.

## Audit Operations

### logAudit

```typescript
async logAudit(auditData: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<AuditLogEntry>
```

Creates an audit log entry.

### getAuditLog

```typescript
async getAuditLog(firmId: string, limit: number = 100): Promise<AuditLogEntry[]>
```

Retrieves audit logs for a firm, ordered by most recent.

## Utility Methods

### runMigration

```typescript
async runMigration(migrationSql: string): Promise<void>
```

Executes database migration SQL.

### healthCheck

```typescript
async healthCheck(): Promise<boolean>
```

Tests database connectivity.

## Migration Requirements

To fix the security issues, the following changes are needed:

### 1. Update Method Signatures

```typescript
// Before (insecure)
async getUser(id: string): Promise<User | null>

// After (secure)
async getUser(firmId: string, id: string): Promise<User | null>
```

### 2. Update SQL Queries

```sql
-- Before
SELECT * FROM users WHERE id = ?

-- After  
SELECT * FROM users WHERE firm_id = ? AND id = ?
```

### 3. Add Missing Methods

```typescript
async deleteFirm(id: string): Promise<boolean> {
  const result = await this.db.prepare(
    'DELETE FROM firms WHERE id = ?'
  ).bind(id).run();
  return result.meta.changes > 0;
}

async updateUserLastLogin(id: string): Promise<void> {
  const now = this.now();
  await this.db.prepare(
    'UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?'
  ).bind(now, now, id).run();
}
```

## Usage Examples

### Secure Pattern (Recommended)

```typescript
// Always pass firmId for user operations
const user = await dbClient.getUserByEmail('user@example.com', firmId);
if (user && user.firm_id === firmId) {
  // Safe to use
}

// Validate firm ownership
const session = await dbClient.getSession(sessionId);
if (session && session.firm_id === currentFirmId) {
  // Authorized access
}
```

### Current Pattern (Insecure)

```typescript
// ❌ No firm validation
const user = await dbClient.getUser(userId);
// Could be from any firm!

// ❌ No ownership check
await dbClient.deleteUser(userId);
// Could delete users from other firms!
```

## Testing Considerations

When updating tests to match this API:

1. Change method names (e.g., `getFirmById` → `getFirm`)
2. Update field names to snake_case
3. Add security tests for multi-tenant isolation
4. Test missing method implementations