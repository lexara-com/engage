# Multi-Tenant Security Fix Implementation

## Critical Security Issue
User data can be accessed across firms. This MUST be fixed before any production deployment.

## Files to Update
1. `/src/db/client.ts` - Update all user-related methods
2. `/src/pages/api/v1/user/*.ts` - Update API endpoints to pass firmId
3. `/src/middleware/authMiddleware.ts` - Ensure firmId is always available

## Method Updates Required

### 1. getUser
```typescript
// BEFORE (Insecure)
async getUser(id: string): Promise<User | null>

// AFTER (Secure)
async getUser(firmId: string, id: string): Promise<User | null> {
  const query = 'SELECT * FROM users WHERE firm_id = ? AND id = ?';
  const result = await this.db.prepare(query).bind(firmId, id).first();
  if (!result) return null;
  return {
    ...result,
    permissions: this.parseJSON(result.permissions as string, {})
  } as User;
}
```

### 2. updateUser
```typescript
// AFTER (Secure)
async updateUser(firmId: string, id: string, updates: UpdateEntity<User>): Promise<User> {
  // First verify the user belongs to this firm
  const user = await this.getUser(firmId, id);
  if (!user) throw new Error('User not found or access denied');
  
  // Then proceed with update...
  const query = `UPDATE users SET ${setParts.join(', ')} WHERE firm_id = ? AND id = ?`;
  // ... rest of implementation
}
```

### 3. deleteUser
```typescript
// AFTER (Secure)
async deleteUser(firmId: string, id: string): Promise<boolean> {
  const query = 'DELETE FROM users WHERE firm_id = ? AND id = ?';
  const result = await this.db.prepare(query).bind(firmId, id).run();
  return result.meta.changes > 0;
}
```

### 4. getUserByEmail (Already secure but needs consistency)
```typescript
// This one is already correct - it includes firmId
async getUserByEmail(email: string, firmId: string): Promise<User | null>
```

## New Security Helper Methods

### Add ownership verification
```typescript
async verifyUserOwnership(firmId: string, userId: string): Promise<boolean> {
  const query = 'SELECT 1 FROM users WHERE firm_id = ? AND id = ? LIMIT 1';
  const result = await this.db.prepare(query).bind(firmId, userId).first();
  return !!result;
}
```

## API Endpoint Updates

All API endpoints need to extract and pass firmId:

```typescript
// Example: /api/v1/user/[userId].ts
export const GET: APIRoute = async (context) => {
  const { userId } = context.params;
  const firmId = context.locals.user?.firmId; // From auth middleware
  
  if (!firmId) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const user = await db.getUser(firmId, userId);
  if (!user) {
    return new Response('User not found', { status: 404 });
  }
  
  return new Response(JSON.stringify(user), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

## Testing the Fix

Create new test file: `tests/unit/db/multi_tenant_isolation.test.ts`

```typescript
describe('Multi-Tenant Isolation', () => {
  it('should not allow cross-firm user access', async () => {
    // Create users in different firms
    const user1 = await db.createUser({
      firm_id: 'firm_123',
      email: 'user@firm123.com'
    });
    
    const user2 = await db.createUser({
      firm_id: 'firm_456',
      email: 'user@firm456.com'
    });
    
    // Try to access user from wrong firm
    const wrongAccess = await db.getUser('firm_456', user1.id);
    expect(wrongAccess).toBeNull();
    
    // Verify correct access still works
    const correctAccess = await db.getUser('firm_123', user1.id);
    expect(correctAccess).not.toBeNull();
    expect(correctAccess.id).toBe(user1.id);
  });
});
```