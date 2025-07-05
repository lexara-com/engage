# Priority Fixes Plan

## 🚨 Critical Issues (Must Fix First)

### 1. Multi-Tenant Security Gap
**Issue**: Database methods don't enforce firm isolation at the method level
**Impact**: Users could potentially access data from other firms
**Example**: `getUser(id)` should be `getUser(firmId, id)`

### 2. Missing Database Methods
**Issue**: Tests expect methods that don't exist
**Missing**:
- `deleteFirm(id)`
- `listFirms(options)`
- `updateUserLastLogin(id)`

### 3. Field Name Inconsistency
**Issue**: Tests use camelCase, database uses snake_case
**Examples**:
- `firmId` → `firm_id`
- `auth0UserId` → `auth0_id`
- `firstName` → `first_name`

## 📋 Priority Order

### Priority 1: Security Fixes (Day 1)
1. **Add firm isolation to user methods**
   - Update `getUser()` to check firm_id
   - Update `deleteUser()` to check firm_id
   - Update `updateUser()` to check firm_id
   - Add `getUserById(firmId, userId)` method

2. **Fix SQL injection vulnerabilities**
   - Ensure all queries use parameterized statements
   - Validate firm_id in all operations

### Priority 2: Missing Methods (Day 1-2)
1. **Add firm management methods**
   ```typescript
   async deleteFirm(id: string): Promise<boolean>
   async listFirms(options): Promise<Firm[]>
   ```

2. **Add user utility methods**
   ```typescript
   async updateUserLastLogin(id: string): Promise<void>
   async listUsers(firmId: string, options): Promise<User[]>
   ```

### Priority 3: API Consistency (Day 2)
1. **Standardize method signatures**
   - All methods that operate on firm data should include firmId
   - Return types should be consistent

2. **Field name standardization**
   - Create a mapping layer or
   - Update all fields to use consistent naming

### Priority 4: Test Fixes (Day 2-3)
1. **Update integration tests**
   - Fix API endpoint test to match actual implementation
   - Add tests for multi-tenant isolation

2. **Fix unit test expectations**
   - Update method names
   - Fix field names
   - Adjust assertions

## 🔧 Implementation Plan

### Phase 1: Security (4 hours)
```typescript
// Before (insecure)
async getUser(id: string): Promise<User | null>

// After (secure)
async getUser(firmId: string, id: string): Promise<User | null> {
  const query = 'SELECT * FROM users WHERE firm_id = ? AND id = ?';
  // ...
}
```

### Phase 2: Missing Methods (4 hours)
```typescript
async deleteFirm(id: string): Promise<boolean> {
  const result = await this.db.prepare(
    'DELETE FROM firms WHERE id = ?'
  ).bind(id).run();
  return result.meta.changes > 0;
}

async listFirms(options: { 
  status?: string; 
  limit?: number; 
  offset?: number 
} = {}): Promise<Firm[]> {
  // Implementation
}
```

### Phase 3: Field Mapping (2 hours)
```typescript
// Option 1: Add translation layer
const toSnakeCase = (obj: any) => {
  // Convert camelCase to snake_case
};

// Option 2: Update database schema
// Migrate to use camelCase fields
```

### Phase 4: Test Updates (2 hours)
- Update all test files to match new method signatures
- Add new tests for multi-tenant isolation
- Verify 100% test coverage

## 📊 Success Metrics

1. **All 32 tests passing**
2. **No security vulnerabilities**
3. **100% multi-tenant isolation**
4. **Consistent API across all methods**
5. **Clear documentation**

## 🚀 Expected Outcome

After these fixes:
- Firm data is completely isolated
- All tests pass
- API is consistent and predictable
- Security is enforced at every level
- Ready for production deployment