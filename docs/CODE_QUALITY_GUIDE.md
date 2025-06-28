# Code Quality Guide

## Overview

This guide outlines the code quality standards, tools, and practices for the Engage Legal AI Platform. We use automated tools to maintain consistent, high-quality code across the entire codebase.

## Tools and Configuration

### ESLint Configuration
- **File**: `.eslintrc.js`
- **Purpose**: Enforces TypeScript and JavaScript code quality standards
- **Rules**: Strict linting with security, performance, and style checks

### Prettier Configuration  
- **File**: `.prettierrc.js`
- **Purpose**: Automatic code formatting for consistent style
- **Coverage**: TypeScript, JavaScript, JSON, Markdown

### Pre-commit Hooks (Husky)
- **File**: `.husky/pre-commit`
- **Purpose**: Automated quality checks before each commit
- **Checks**: Linting, formatting, type checking, unit tests

### Lint-staged Configuration
- **File**: `.lintstagedrc.js`  
- **Purpose**: Only run quality tools on staged files for performance
- **Actions**: ESLint fixes, Prettier formatting, automatic staging

## Code Quality Scripts

### Available Commands
```bash
# Basic linting and fixing
npm run lint                # Check code quality issues
npm run lint:fix           # Automatically fix linting issues

# Code formatting
npm run format             # Format all code files
npm run format:check       # Check if code is properly formatted

# Comprehensive quality checks
npm run code:check         # Run all quality checks (typecheck + lint + format)
npm run code:fix          # Fix all auto-fixable issues (lint + format)

# Type checking
npm run typecheck          # Verify TypeScript types
```

### Recommended Workflow
```bash
# Before committing changes
npm run code:fix           # Fix all auto-fixable issues
npm run code:check         # Verify everything passes

# Or use the comprehensive check
npm run typecheck && npm run lint && npm run format:check
```

## Code Standards

### TypeScript Standards

#### 1. Type Safety
```typescript
// ✅ Good: Explicit types and null checking
function processUser(user: User | null): string | null {
  if (!user) {
    return null;
  }
  return user.name;
}

// ❌ Bad: Using any and non-null assertions
function processUser(user: any): string {
  return user!.name;
}
```

#### 2. Import Organization
```typescript
// ✅ Good: Type imports and organized imports
import type { User, Firm } from '@/types/shared';
import { createLogger } from '@/utils/logger';
import { validateAuth } from '@/auth/middleware';

// ❌ Bad: Mixed type and value imports
import { User, Firm, createLogger, validateAuth } from '@/mixed/imports';
```

#### 3. Error Handling
```typescript
// ✅ Good: Structured error handling
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', { 
    errorMessage: error instanceof Error ? error.message : String(error),
    operation: 'riskyOperation'
  });
  return { success: false, error: 'Operation failed' };
}

// ❌ Bad: Unhandled promises and loose error handling  
const result = riskyOperation(); // Missing await and error handling
```

#### 4. Function Return Types
```typescript
// ✅ Good: Explicit return types
async function fetchUser(id: string): Promise<User | null> {
  // Implementation
}

// ⚠️ Acceptable: Simple functions with obvious return types
const isValid = (value: string): boolean => value.length > 0;
```

### Code Style Standards

#### 1. Naming Conventions
```typescript
// ✅ Good: Clear, descriptive names
const platformAuthManager = new PlatformAuthManager(env);
const isUserAuthenticated = await checkAuthentication(request);

// ❌ Bad: Abbreviated or unclear names
const pam = new PlatformAuthManager(env);
const isAuth = await checkAuth(request);
```

#### 2. Function Length and Complexity
```typescript
// ✅ Good: Short, focused functions
async function validateSession(sessionToken: string): Promise<boolean> {
  if (!sessionToken) {
    return false;
  }
  
  const session = await getSession(sessionToken);
  return session?.isValid ?? false;
}

// ❌ Bad: Long, complex functions (split into smaller functions)
```

#### 3. Comment Guidelines
```typescript
// ✅ Good: Explain WHY, not WHAT
// Validate state parameter to prevent CSRF attacks
const stateData = validateState(state);

// ✅ Good: Complex business logic explanation
// Check conflict of interest by comparing client identifiers 
// against firm's existing client and opposing party lists
const hasConflict = await checkConflictOfInterest(clientData, firmId);

// ❌ Bad: Obvious comments
// Get the user name
const userName = user.name;
```

## Security Standards

### 1. Input Validation
```typescript
// ✅ Good: Validate all inputs
function processCallback(code: string, state: string): void {
  if (!code || typeof code !== 'string') {
    throw new ValidationError('Invalid authorization code');
  }
  
  if (!state || typeof state !== 'string') {
    throw new ValidationError('Invalid state parameter');
  }
  
  // Process with validated inputs
}
```

### 2. Error Information Disclosure
```typescript
// ✅ Good: Generic error messages to users, detailed logs
try {
  await sensitiveOperation();
} catch (error) {
  logger.error('Sensitive operation failed', { 
    errorMessage: error.message,
    userId: context.userId 
  });
  
  // Generic message to user
  return { error: 'Operation failed. Please try again.' };
}

// ❌ Bad: Exposing internal error details
catch (error) {
  return { error: error.message }; // May expose sensitive info
}
```

### 3. Authentication Context
```typescript
// ✅ Good: Always validate authentication context
async function protectedOperation(request: Request, env: Env): Promise<Response> {
  const authContext = await validateAuthentication(request, env);
  if (!authContext.isValid) {
    return unauthorizedResponse();
  }
  
  // Proceed with authenticated context
}
```

## Performance Standards

### 1. Async/Await Usage
```typescript
// ✅ Good: Proper async handling
async function fetchMultipleResources(): Promise<UserData> {
  const [user, permissions, settings] = await Promise.all([
    fetchUser(),
    fetchPermissions(),
    fetchSettings()
  ]);
  
  return combineUserData(user, permissions, settings);
}

// ❌ Bad: Sequential awaits when parallel is possible
async function fetchMultipleResources(): Promise<UserData> {
  const user = await fetchUser();
  const permissions = await fetchPermissions(); // Could be parallel
  const settings = await fetchSettings();
  
  return combineUserData(user, permissions, settings);
}
```

### 2. Error Boundaries
```typescript
// ✅ Good: Graceful degradation
async function enhanceWithOptionalData(baseData: BaseData): Promise<EnhancedData> {
  try {
    const enhancementData = await fetchEnhancementData();
    return { ...baseData, ...enhancementData };
  } catch (error) {
    logger.warn('Enhancement data unavailable', { error: error.message });
    return baseData; // Graceful fallback
  }
}
```

## Legal Industry Specific Standards

### 1. Client Data Handling
```typescript
// ✅ Good: Explicit PII handling
interface ClientMessage {
  id: string;
  role: 'user' | 'agent';
  content?: string;           // Plain text (if not sensitive)
  encryptedContent?: {        // Encrypted PII
    encryptedData: string;
    iv: string;
    authTag: string;
  };
  isPII: boolean;             // Explicit PII marking
}
```

### 2. Audit Logging
```typescript
// ✅ Good: Comprehensive audit trails
logger.audit('client_data_access', {
  userId: context.userId,
  firmId: context.firmId,
  dataType: 'conversation',
  operation: 'read',
  recordId: conversationId,
  timestamp: new Date().toISOString()
});
```

### 3. Access Control
```typescript
// ✅ Good: Firm-level data isolation
async function getConversations(firmId: string, userId: string): Promise<Conversation[]> {
  // Verify user belongs to firm
  await validateUserFirmAccess(userId, firmId);
  
  // Only return conversations for this firm
  return await fetchConversationsByFirm(firmId);
}
```

## Pre-commit Hook Details

### What Gets Checked
1. **Lint-staged**: Only staged files are checked for performance
2. **ESLint**: Code quality, security, and style issues
3. **Prettier**: Automatic code formatting
4. **TypeScript**: Type checking across entire codebase
5. **Unit Tests**: Critical functionality tests

### Commit Message Format
```bash
# Required format: type(scope): description
feat(auth): add JWT validation for platform admin
fix(sessions): resolve session persistence issue
docs(readme): update deployment instructions
refactor(errors): consolidate error handling patterns
test(auth): add integration tests for Auth0 flow
chore(deps): update TypeScript to latest version
```

### Bypassing Hooks (Emergency Only)
```bash
# Skip pre-commit hooks (use sparingly)
git commit --no-verify -m "emergency fix"

# Skip specific checks during development
HUSKY=0 git commit -m "work in progress"
```

## Continuous Quality Improvement

### Regular Maintenance
- **Weekly**: Review and address ESLint warnings
- **Monthly**: Update dependencies and review new linting rules  
- **Quarterly**: Review and update code quality standards

### Metrics to Track
- ESLint error/warning count over time
- TypeScript error count reduction
- Test coverage percentage
- Code review feedback patterns

### Team Practices
- All PRs must pass quality checks
- Code review focuses on logic, not style (automated)
- Regular team discussion of code quality improvements
- Documentation updates when patterns change

---

For questions about code quality standards or tool configuration, refer to this guide or contact the development team.