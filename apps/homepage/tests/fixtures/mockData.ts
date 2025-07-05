/**
 * Test Fixtures and Mock Data
 * 
 * Provides consistent test data across all test suites
 */

import type { Firm, User, UserSession, AuditLogEntry } from '@/db/types';

// Mock Firms
export const mockFirms = {
  starterFirm: {
    id: 'firm_starter_123',
    name: 'Smith & Associates',
    domain: 'smithlaw.com',
    plan: 'starter',
    settings: {
      size: '1-5',
      practiceAreas: ['personal_injury', 'family_law'],
      primaryColor: '#1E2B3B',
      secondaryColor: '#3B576C',
      logo: 'https://example.com/logo.png',
    },
    status: 'active',
    createdAt: 1234567890,
    updatedAt: 1234567890,
  } as Firm,

  professionalFirm: {
    id: 'firm_pro_456',
    name: 'Johnson Legal Partners',
    domain: 'johnsonlegal.com',
    plan: 'professional',
    settings: {
      size: '10-50',
      practiceAreas: ['corporate', 'tax', 'employment'],
      primaryColor: '#2563eb',
      secondaryColor: '#3b82f6',
    },
    status: 'active',
    createdAt: 1234567890,
    updatedAt: 1234567890,
  } as Firm,

  suspendedFirm: {
    id: 'firm_suspended_789',
    name: 'Inactive Law Firm',
    plan: 'starter',
    settings: {},
    status: 'suspended',
    createdAt: 1234567890,
    updatedAt: 1234567890,
  } as Firm,
};

// Mock Users
export const mockUsers = {
  adminUser: {
    id: 'user_admin_123',
    firmId: 'firm_starter_123',
    auth0UserId: 'auth0|admin123',
    email: 'admin@smithlaw.com',
    firstName: 'John',
    lastName: 'Smith',
    role: 'admin',
    permissions: ['firm:admin', 'firm:manage_users', 'firm:manage_settings'],
    status: 'active',
    lastLogin: 1234567890,
    createdAt: 1234567890,
    updatedAt: 1234567890,
  } as User,

  staffUser: {
    id: 'user_staff_456',
    firmId: 'firm_starter_123',
    auth0UserId: 'auth0|staff456',
    email: 'staff@smithlaw.com',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'staff',
    permissions: ['firm:view_conversations', 'firm:export_data'],
    status: 'active',
    lastLogin: 1234567890,
    createdAt: 1234567890,
    updatedAt: 1234567890,
  } as User,

  inactiveUser: {
    id: 'user_inactive_789',
    firmId: 'firm_starter_123',
    auth0UserId: 'auth0|inactive789',
    email: 'inactive@smithlaw.com',
    firstName: 'Bob',
    lastName: 'Wilson',
    role: 'staff',
    permissions: [],
    status: 'inactive',
    createdAt: 1234567890,
    updatedAt: 1234567890,
  } as User,
};

// Mock Sessions
export const mockSessions = {
  activeSession: {
    id: 'session_active_123',
    userId: 'user_admin_123',
    token: 'mock-session-token-123',
    expiresAt: Date.now() + 86400000, // 24 hours from now
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    createdAt: 1234567890,
    lastActivity: Date.now(),
  } as UserSession,

  expiredSession: {
    id: 'session_expired_456',
    userId: 'user_staff_456',
    token: 'mock-expired-token-456',
    expiresAt: Date.now() - 3600000, // 1 hour ago
    ipAddress: '192.168.1.2',
    userAgent: 'Mozilla/5.0 Test Browser',
    createdAt: 1234567890,
    lastActivity: 1234567890,
  } as UserSession,
};

// Mock Audit Logs
export const mockAuditLogs = {
  firmCreated: {
    id: 'audit_123',
    firmId: 'firm_starter_123',
    userId: 'user_admin_123',
    action: 'firm.created',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    details: {
      firmName: 'Smith & Associates',
      plan: 'starter',
    },
    createdAt: 1234567890,
  } as AuditLogEntry,

  userAdded: {
    id: 'audit_456',
    firmId: 'firm_starter_123',
    userId: 'user_admin_123',
    action: 'user.added',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    details: {
      newUserId: 'user_staff_456',
      newUserEmail: 'staff@smithlaw.com',
      role: 'staff',
    },
    createdAt: 1234567890,
  } as AuditLogEntry,

  loginAttempt: {
    id: 'audit_789',
    firmId: 'firm_starter_123',
    userId: 'user_admin_123',
    action: 'auth.login',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    details: {
      success: true,
      method: 'password',
    },
    createdAt: 1234567890,
  } as AuditLogEntry,
};

// Mock Registration Data
export const mockRegistrationData = {
  valid: {
    plan: 'starter',
    firmName: 'Test Law Firm',
    firmSize: '1-5',
    practiceAreas: ['personal_injury', 'family_law'],
    firstName: 'Test',
    lastName: 'User',
    email: 'test@testfirm.com',
    password: 'SecurePass123!',
    agreedToTerms: true,
  },

  minimal: {
    firmName: 'Minimal Firm',
    firstName: 'Min',
    lastName: 'User',
    email: 'min@minimal.com',
    password: 'Password123!',
    agreedToTerms: true,
  },

  invalid: {
    missingEmail: {
      firmName: 'Test Firm',
      firstName: 'Test',
      lastName: 'User',
      password: 'Password123!',
      agreedToTerms: true,
    },
    weakPassword: {
      firmName: 'Test Firm',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@test.com',
      password: 'weak',
      agreedToTerms: true,
    },
    noTerms: {
      firmName: 'Test Firm',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@test.com',
      password: 'Password123!',
      agreedToTerms: false,
    },
  },
};

// Mock Auth0 Responses
export const mockAuth0Responses = {
  tokenSuccess: {
    access_token: 'mock-access-token',
    token_type: 'Bearer',
    expires_in: 86400,
    scope: 'create:users read:users update:users',
  },

  userCreated: {
    user_id: 'auth0|123456789',
    email: 'test@example.com',
    name: 'Test User',
    email_verified: false,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    identities: [
      {
        connection: 'Username-Password-Authentication',
        user_id: '123456789',
        provider: 'auth0',
        isSocial: false,
      },
    ],
    app_metadata: {
      firmId: 'firm_123',
      permissions: ['firm:admin'],
    },
    user_metadata: {
      firstName: 'Test',
      lastName: 'User',
      role: 'admin',
    },
  },

  tokenError: {
    error: 'access_denied',
    error_description: 'Unauthorized client',
  },

  userError: {
    statusCode: 400,
    error: 'Bad Request',
    message: 'The user already exists',
    errorCode: 'auth0_idp_error',
  },
};

// Helper functions
export const generateMockFirm = (overrides: Partial<Firm> = {}): Firm => {
  return {
    ...mockFirms.starterFirm,
    id: `firm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
};

export const generateMockUser = (firmId: string, overrides: Partial<User> = {}): User => {
  return {
    ...mockUsers.staffUser,
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    firmId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
};

export const generateMockSession = (userId: string): UserSession => {
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    token: `token_${Math.random().toString(36).substr(2, 20)}`,
    expiresAt: Date.now() + 86400000, // 24 hours
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
};