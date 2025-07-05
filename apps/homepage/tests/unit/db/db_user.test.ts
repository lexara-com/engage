import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationDatabaseClient } from '../../../src/db/client';
import type { User, CreateEntity, UpdateEntity } from '../../../src/db/types';

describe('Database - User Operations', () => {
  let dbClient: AuthorizationDatabaseClient;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn(),
      }),
    };
    dbClient = new AuthorizationDatabaseClient(mockDb);
  });

  describe('createUser', () => {
    it('should create a new user with all required fields', async () => {
      const userData: CreateEntity<User> = {
        firm_id: 'firm_123',
        auth0_id: 'auth0|123456',
        email: 'john@testfirm.com',
        first_name: 'John',
        last_name: 'Doe',
        role: 'admin',
        permissions: { 'firm:admin': true, 'firm:manage_users': true },
        status: 'active',
      } as any;

      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockResolvedValue({ success: true });

      const result = await dbClient.createUser(userData);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users')
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith(
        expect.any(String), // id
        userData.auth0_id,
        userData.firm_id,
        userData.email,
        userData.first_name || null,
        userData.last_name || null,
        userData.role,
        userData.status,
        JSON.stringify(userData.permissions),
        null, // invited_by
        null, // last_login
        expect.any(Number), // created_at
        expect.any(Number)  // updated_at
      );
      expect(result).toMatchObject({
        id: expect.any(String),
        firm_id: userData.firm_id,
        email: userData.email,
        permissions: userData.permissions,
      });
    });

    it('should enforce firm isolation', async () => {
      const userData: CreateEntity<User> = {
        firm_id: 'firm_123',
        auth0_id: 'auth0|test',
        email: 'user@example.com',
        role: 'staff',
        status: 'active'
      } as any;

      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockResolvedValue({ success: true });

      const result = await dbClient.createUser(userData);

      expect(result.firm_id).toBe('firm_123');
      expect(mockPrepare.bind).toHaveBeenCalledWith(
        expect.any(String), // id
        userData.auth0_id,
        userData.firm_id,
        userData.email,
        null, // first_name
        null, // last_name
        userData.role,
        userData.status,
        JSON.stringify({}), // permissions
        null, // invited_by
        null, // last_login
        expect.any(Number), // created_at
        expect.any(Number)  // updated_at
      );
    });

    it('should handle duplicate email error', async () => {
      const userData: CreateEntity<User> = {
        firm_id: 'firm_123',
        auth0_id: 'auth0|test',
        email: 'duplicate@example.com',
        role: 'admin',
        status: 'active'
      } as any;

      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockRejectedValue(new Error('UNIQUE constraint failed: users.email'));

      await expect(dbClient.createUser(userData)).rejects.toThrow('UNIQUE constraint failed');
    });
  });

  describe('getUser', () => {
    it('should retrieve user by ID and firmId', async () => {
      const mockUser = {
        id: 'user_123',
        firm_id: 'firm_123',
        auth0_id: 'auth0|123456',
        email: 'john@testfirm.com',
        first_name: 'John',
        last_name: 'Doe',
        role: 'admin',
        permissions: JSON.stringify({ 'firm:admin': true }),
        status: 'active',
        last_login: 1234567890,
        created_at: 1234567890,
        updated_at: 1234567890,
      };

      const mockPrepare = mockDb.prepare();
      mockPrepare.first.mockResolvedValue(mockUser);

      const result = await dbClient.getUser('firm_123', 'user_123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE firm_id = ? AND id = ?'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('firm_123', 'user_123');
      expect(result).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        permissions: { 'firm:admin': true },
      });
    });

    it('should return null for user from different firm', async () => {
      const mockPrepare = mockDb.prepare();
      mockPrepare.first.mockResolvedValue(null);

      const result = await dbClient.getUser('different_firm', 'user_123');

      expect(result).toBeNull();
    });
  });

  describe('getUserByAuth0Id', () => {
    it('should retrieve user by Auth0 ID', async () => {
      const mockUser = {
        id: 'user_123',
        firm_id: 'firm_123',
        auth0_id: 'auth0|123456',
        email: 'john@testfirm.com',
        role: 'admin',
        permissions: '{}',
        status: 'active',
        created_at: 1234567890,
        updated_at: 1234567890,
      };

      const mockPrepare = mockDb.prepare();
      mockPrepare.first.mockResolvedValue(mockUser);

      const result = await dbClient.getUserByAuth0Id('auth0|123456');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE auth0_id = ?'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('auth0|123456');
      expect(result?.auth0_id).toBe('auth0|123456');
    });
  });

  describe('updateUser', () => {
    it('should update user fields maintaining firm isolation', async () => {
      const updateData: UpdateEntity<User> = {
        role: 'staff',
        permissions: { 'firm:view_conversations': true },
        status: 'inactive',
      } as any;

      const existingUser = {
        id: 'user_123',
        firm_id: 'firm_123',
        email: 'john@testfirm.com',
        role: 'admin',
        permissions: '{}',
        status: 'active',
      };

      const mockPrepare = mockDb.prepare();
      // First call to getUser for verification
      mockPrepare.first.mockResolvedValueOnce(existingUser);
      // Then the update
      mockPrepare.run.mockResolvedValueOnce({ success: true });
      // Then getUser again to return updated user
      mockPrepare.first.mockResolvedValueOnce({
        ...existingUser,
        ...updateData,
        permissions: JSON.stringify(updateData.permissions),
        updated_at: Date.now(),
      });

      const result = await dbClient.updateUser('firm_123', 'user_123', updateData);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET')
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE firm_id = ? AND id = ?')
      );
      expect(result).toMatchObject({
        role: 'staff',
        permissions: { 'firm:view_conversations': true },
        status: 'inactive',
      });
    });

    it('should throw error when updating user from different firm', async () => {
      const mockPrepare = mockDb.prepare();
      // getUser returns null - user not in this firm
      mockPrepare.first.mockResolvedValueOnce(null);

      await expect(
        dbClient.updateUser('different_firm', 'user_123', { role: 'staff' } as any)
      ).rejects.toThrow('User not found or access denied');
    });
  });

  describe('updateUserLastLogin', () => {
    it('should update lastLogin timestamp', async () => {
      const existingUser = {
        id: 'user_123',
        firm_id: 'firm_123',
        email: 'john@testfirm.com',
      };

      const mockPrepare = mockDb.prepare();
      // First call to getUser for verification
      mockPrepare.first.mockResolvedValueOnce(existingUser);
      // Then the update
      mockPrepare.run.mockResolvedValueOnce({ success: true });

      await dbClient.updateUserLastLogin('firm_123', 'user_123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'UPDATE users SET last_login = ?, updated_at = ? WHERE firm_id = ? AND id = ?'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'firm_123',
        'user_123'
      );
    });

    it('should throw error when updating lastLogin for user from different firm', async () => {
      const mockPrepare = mockDb.prepare();
      // getUser returns null - user not in this firm
      mockPrepare.first.mockResolvedValueOnce(null);

      await expect(
        dbClient.updateUserLastLogin('different_firm', 'user_123')
      ).rejects.toThrow('User not found or access denied');
    });
  });

  describe('listFirmUsers', () => {
    it('should list all users for a firm', async () => {
      const mockUsers = [
        {
          id: 'user_1',
          firm_id: 'firm_123',
          email: 'admin@firm.com',
          role: 'admin',
          permissions: JSON.stringify({ 'firm:admin': true }),
          status: 'active',
          created_at: 1234567890,
          updated_at: 1234567890,
        },
        {
          id: 'user_2',
          firm_id: 'firm_123',
          email: 'staff@firm.com',
          role: 'staff',
          permissions: '{}',
          status: 'active',
          created_at: 1234567890,
          updated_at: 1234567890,
        },
      ];

      const mockPrepare = mockDb.prepare();
      mockPrepare.all.mockResolvedValue({ results: mockUsers });

      const result = await dbClient.listFirmUsers('firm_123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE firm_id = ? ORDER BY created_at DESC'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('firm_123');
      expect(result).toHaveLength(2);
      expect(result[0].permissions).toEqual({ 'firm:admin': true });
      expect(result[1].permissions).toEqual({});
    });
  });

  describe('deleteUser', () => {
    it('should delete user maintaining firm isolation', async () => {
      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockResolvedValue({ success: true, meta: { changes: 1 } });

      const result = await dbClient.deleteUser('firm_123', 'user_123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'DELETE FROM users WHERE firm_id = ? AND id = ?'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('firm_123', 'user_123');
      expect(result).toBe(true);
    });

    it('should return false if user not in firm', async () => {
      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockResolvedValue({ success: true, meta: { changes: 0 } });

      const result = await dbClient.deleteUser('different_firm', 'user_123');

      expect(result).toBe(false);
    });
  });

  describe('getUserByEmail', () => {
    it('should retrieve user by email within firm scope', async () => {
      const mockUser = {
        id: 'user_123',
        firm_id: 'firm_123',
        auth0_id: 'auth0|123456',
        email: 'john@testfirm.com',
        role: 'admin',
        permissions: '{}',
        status: 'active',
      };

      const mockPrepare = mockDb.prepare();
      mockPrepare.first.mockResolvedValue(mockUser);

      const result = await dbClient.getUserByEmail('john@testfirm.com', 'firm_123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = ? AND firm_id = ?'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('john@testfirm.com', 'firm_123');
      expect(result?.email).toBe('john@testfirm.com');
      expect(result?.firm_id).toBe('firm_123');
    });
  });
});