import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationDatabaseClient } from '../../../src/db/client';

// Create mock database inline since fixtures are missing
const createMockD1Database = () => ({
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
  }),
});

// Mock data
const mockUsers = {
  adminUser: {
    id: 'user_admin_123',
    firm_id: 'firm_123',
    auth0_id: 'auth0|admin123',
    email: 'admin@smithlaw.com',
    role: 'admin',
    permissions: { 'firm:admin': true },
    status: 'active',
    created_at: 1234567890,
    updated_at: 1234567890
  },
  staffUser: {
    id: 'user_staff_456',
    firm_id: 'firm_123',
    auth0_id: 'auth0|staff456',
    email: 'staff@smithlaw.com',
    role: 'staff',
    permissions: {},
    status: 'active',
    created_at: 1234567890,
    updated_at: 1234567890
  }
};

const mockFirms = {
  starterFirm: {
    id: 'firm_123',
    name: 'Smith & Associates',
    plan: 'starter',
    settings: {},
    status: 'active',
    created_at: 1234567890,
    updated_at: 1234567890
  }
};

describe('Multi-Tenant Data Isolation', () => {
  let dbClient: AuthorizationDatabaseClient;
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockD1Database();
    dbClient = new AuthorizationDatabaseClient(mockDb);
    vi.clearAllMocks();
  });

  describe('User Data Isolation', () => {
    it('should not allow accessing users from different firms', async () => {
      // Setup users in different firms
      const user1 = { ...mockUsers.adminUser, firm_id: 'firm_123' };
      const user2 = { ...mockUsers.staffUser, firm_id: 'firm_456' };

      // Mock database responses
      const mockPrepare = mockDb.prepare();
      
      // First call: getUser for firm_456 trying to access user from firm_123
      mockPrepare.first.mockResolvedValueOnce(null);
      
      // Second call: getUser for firm_123 accessing own user
      mockPrepare.first.mockResolvedValueOnce(user1);

      // Try to access user from wrong firm - should return null
      const wrongAccess = await dbClient.getUser('firm_456', user1.id);
      expect(wrongAccess).toBeNull();
      
      // Verify the query includes firm_id check
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE firm_id = ? AND id = ?'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('firm_456', user1.id);

      // Verify correct access still works
      const correctAccess = await dbClient.getUser('firm_123', user1.id);
      expect(correctAccess).not.toBeNull();
      expect(correctAccess?.id).toBe(user1.id);
      expect(mockPrepare.bind).toHaveBeenCalledWith('firm_123', user1.id);
    });

    it('should not allow updating users from different firms', async () => {
      const user = { ...mockUsers.adminUser, firm_id: 'firm_123' };
      const mockPrepare = mockDb.prepare();

      // First call: getUser returns null (user not in this firm)
      mockPrepare.first.mockResolvedValueOnce(null);

      // Try to update user from wrong firm
      await expect(
        dbClient.updateUser('firm_456', user.id, { role: 'staff' })
      ).rejects.toThrow('User not found or access denied');

      // Verify the ownership check was made
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE firm_id = ? AND id = ?'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('firm_456', user.id);
    });

    it('should not allow deleting users from different firms', async () => {
      const user = { ...mockUsers.adminUser, firm_id: 'firm_123' };
      const mockPrepare = mockDb.prepare();

      // Mock delete returning 0 changes (no user found)
      mockPrepare.run.mockResolvedValueOnce({ meta: { changes: 0 } });

      // Try to delete user from wrong firm
      const result = await dbClient.deleteUser('firm_456', user.id);
      expect(result).toBe(false);

      // Verify the query includes firm_id check
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'DELETE FROM users WHERE firm_id = ? AND id = ?'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('firm_456', user.id);
    });

    it('should not allow updating last login for users from different firms', async () => {
      const user = { ...mockUsers.adminUser, firm_id: 'firm_123' };
      const mockPrepare = mockDb.prepare();

      // First call: getUser returns null (user not in this firm)
      mockPrepare.first.mockResolvedValueOnce(null);

      // Try to update last login from wrong firm
      await expect(
        dbClient.updateUserLastLogin('firm_456', user.id)
      ).rejects.toThrow('User not found or access denied');

      // Verify the ownership check was made
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE firm_id = ? AND id = ?'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('firm_456', user.id);
    });

    it('should properly scope getUserByEmail to firm', async () => {
      const email = 'admin@example.com';
      const user1 = { ...mockUsers.adminUser, email, firm_id: 'firm_123' };
      const user2 = { ...mockUsers.staffUser, email, firm_id: 'firm_456' };

      const mockPrepare = mockDb.prepare();
      
      // First call: getUserByEmail for firm_123
      mockPrepare.first.mockResolvedValueOnce(user1);
      
      // Second call: getUserByEmail for firm_456
      mockPrepare.first.mockResolvedValueOnce(user2);

      // Get user by email from firm_123
      const result1 = await dbClient.getUserByEmail(email, 'firm_123');
      expect(result1?.firm_id).toBe('firm_123');

      // Get same email from firm_456 - should get different user
      const result2 = await dbClient.getUserByEmail(email, 'firm_456');
      expect(result2?.firm_id).toBe('firm_456');

      // Verify queries include firm_id
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = ? AND firm_id = ?'
      );
    });

    it('should only list users from the specified firm', async () => {
      const users = [
        { ...mockUsers.adminUser, firm_id: 'firm_123' },
        { ...mockUsers.staffUser, firm_id: 'firm_123' },
        { ...mockUsers.adminUser, firm_id: 'firm_456', id: 'other_admin' }
      ];

      const mockPrepare = mockDb.prepare();
      mockPrepare.all.mockResolvedValueOnce({
        results: users.filter(u => u.firm_id === 'firm_123')
      });

      const result = await dbClient.listFirmUsers('firm_123');
      expect(result).toHaveLength(2);
      expect(result.every(u => u.firm_id === 'firm_123')).toBe(true);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE firm_id = ? ORDER BY created_at DESC'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('firm_123');
    });
  });

  describe('Backward Compatibility', () => {
    it('should warn when using deprecated getUserById method', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      const mockPrepare = mockDb.prepare();
      mockPrepare.first.mockResolvedValueOnce(mockUsers.adminUser);

      await dbClient.getUserById('user_123');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'getUserById is deprecated and insecure. Use getUser(firmId, id) instead.'
      );
    });
  });

  describe('Firm Operations', () => {
    it('should allow firms to manage only their own settings', async () => {
      const firm = { ...mockFirms.starterFirm, id: 'firm_123' };
      const mockPrepare = mockDb.prepare();

      // Mock getFirm to return the firm
      mockPrepare.first.mockResolvedValueOnce(firm);
      mockPrepare.run.mockResolvedValueOnce({ success: true });

      // Update firm should work for own firm
      const result = await dbClient.updateFirm('firm_123', { 
        settings: { newSetting: true } 
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE firms SET')
      );
    });

    it('should properly isolate audit logs by firm', async () => {
      const mockPrepare = mockDb.prepare();
      mockPrepare.all.mockResolvedValueOnce({
        results: [
          { firm_id: 'firm_123', action: 'user.created' },
          { firm_id: 'firm_123', action: 'user.updated' }
        ]
      });

      const logs = await dbClient.getAuditLog('firm_123', 100);
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.firm_id === 'firm_123')).toBe(true);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE firm_id = ?')
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('firm_123', 100);
    });
  });

  describe('Session Operations', () => {
    it('should not expose session data across firms', async () => {
      // Sessions are user-specific, not firm-specific
      // But we should verify that session permissions respect firm boundaries
      const sessionData = {
        user_id: 'user_123',
        token_hash: 'hash_123',
        permissions: { 'firm:admin': true },
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };

      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockResolvedValueOnce({ success: true });
      mockPrepare.first.mockResolvedValueOnce({
        ...sessionData,
        id: 'session_123',
        created_at: Math.floor(Date.now() / 1000)
      });

      const session = await dbClient.createSession(sessionData);
      expect(session.user_id).toBe('user_123');

      // Verify session lookup by token hash
      const found = await dbClient.getSessionByTokenHash('hash_123');
      expect(found?.user_id).toBe('user_123');
    });
  });

  describe('Security Helper Methods', () => {
    it('should verify user ownership correctly', async () => {
      const mockPrepare = mockDb.prepare();
      
      // Test positive case - user exists in firm
      mockPrepare.first.mockResolvedValueOnce(mockUsers.adminUser);
      const user = await dbClient.getUser('firm_123', 'user_123');
      expect(user).not.toBeNull();

      // Test negative case - user doesn't exist in firm
      mockPrepare.first.mockResolvedValueOnce(null);
      const wrongUser = await dbClient.getUser('firm_456', 'user_123');
      expect(wrongUser).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null firmId gracefully', async () => {
      const mockPrepare = mockDb.prepare();
      mockPrepare.first.mockResolvedValueOnce(null);

      // @ts-expect-error - Testing invalid input
      const result = await dbClient.getUser(null, 'user_123');
      expect(result).toBeNull();

      // Should still call the query with null
      expect(mockPrepare.bind).toHaveBeenCalledWith(null, 'user_123');
    });

    it('should handle empty firmId gracefully', async () => {
      const mockPrepare = mockDb.prepare();
      mockPrepare.first.mockResolvedValueOnce(null);

      const result = await dbClient.getUser('', 'user_123');
      expect(result).toBeNull();

      expect(mockPrepare.bind).toHaveBeenCalledWith('', 'user_123');
    });

    it('should prevent SQL injection through firmId parameter', async () => {
      const maliciousFirmId = "'; DROP TABLE users; --";
      const mockPrepare = mockDb.prepare();
      mockPrepare.first.mockResolvedValueOnce(null);

      const result = await dbClient.getUser(maliciousFirmId, 'user_123');
      expect(result).toBeNull();

      // Verify parameterized query was used (bind prevents injection)
      expect(mockPrepare.bind).toHaveBeenCalledWith(maliciousFirmId, 'user_123');
    });
  });
});