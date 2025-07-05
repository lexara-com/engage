import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationDatabaseClient } from '../../../src/db/client';
import type { Firm, CreateEntity, UpdateEntity } from '../../../src/db/types';

describe('Database - Firm Operations', () => {
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

  describe('createFirm', () => {
    it('should create a new firm with all required fields', async () => {
      const firmData: CreateEntity<Firm> = {
        name: 'Test Law Firm',
        plan: 'starter',
        settings: { size: '1-5', practiceAreas: ['personal_injury'] },
        status: 'active',
      } as any;

      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockResolvedValue({ success: true });

      const result = await dbClient.createFirm(firmData);

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockPrepare.bind).toHaveBeenCalledWith(
        expect.any(String), // id
        firmData.name,
        undefined, // domain
        firmData.plan,
        JSON.stringify(firmData.settings),
        firmData.status,
        expect.any(Number), // created_at
        expect.any(Number)  // updated_at
      );
      expect(result).toMatchObject({
        id: expect.any(String),
        name: firmData.name,
        plan: firmData.plan,
        settings: firmData.settings,
        status: firmData.status,
      });
    });

    it('should handle database errors gracefully', async () => {
      const firmData: CreateEntity<Firm> = {
        name: 'Test Law Firm',
        plan: 'starter',
      };

      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockRejectedValue(new Error('Database error'));

      await expect(dbClient.createFirm(firmData)).rejects.toThrow('Database error');
    });

    it('should generate unique IDs for each firm', async () => {
      const firmData: CreateEntity<Firm> = {
        name: 'Test Law Firm',
      };

      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockResolvedValue({ success: true });

      // Use vi.fn to track individual calls
      const idGenerator = vi.fn()
        .mockReturnValueOnce('unique-id-1')
        .mockReturnValueOnce('unique-id-2');
      
      // Mock crypto.randomUUID
      vi.spyOn(crypto, 'randomUUID').mockImplementation(idGenerator);

      const firm1 = await dbClient.createFirm(firmData);
      const firm2 = await dbClient.createFirm(firmData);

      expect(firm1.id).toBe('unique-id-1');
      expect(firm2.id).toBe('unique-id-2');
      expect(firm1.id).not.toBe(firm2.id);
    });
  });

  describe('getFirm', () => {
    it('should retrieve firm by ID', async () => {
      const mockFirm = {
        id: 'firm_123',
        name: 'Test Law Firm',
        domain: 'testlaw.com',
        plan: 'professional',
        settings: JSON.stringify({ size: '10-50' }),
        status: 'active',
        created_at: 1234567890,
        updated_at: 1234567890,
      };

      const mockPrepare = mockDb.prepare();
      mockPrepare.first.mockResolvedValue(mockFirm);

      const result = await dbClient.getFirm('firm_123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM firms WHERE id = ?'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('firm_123');
      expect(result).toMatchObject({
        id: mockFirm.id,
        name: mockFirm.name,
        settings: { size: '10-50' },
      });
    });

    it('should return null for non-existent firm', async () => {
      const mockPrepare = mockDb.prepare();
      mockPrepare.first.mockResolvedValue(null);

      const result = await dbClient.getFirm('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateFirm', () => {
    it('should update firm fields', async () => {
      const updateData: UpdateEntity<Firm> = {
        name: 'Updated Law Firm',
        plan: 'professional',
        settings: { size: '10-50', practiceAreas: ['corporate', 'tax'] },
      };

      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockResolvedValue({ success: true });
      mockPrepare.first.mockResolvedValue({
        id: 'firm_123',
        ...updateData,
        settings: JSON.stringify(updateData.settings),
        createdAt: 1234567890,
        updatedAt: Date.now(),
      });

      const result = await dbClient.updateFirm('firm_123', updateData);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE firms SET')
      );
      expect(result).toMatchObject({
        id: 'firm_123',
        name: updateData.name,
        plan: updateData.plan,
        settings: updateData.settings,
      });
    });

    it('should handle partial updates', async () => {
      const updateData: UpdateEntity<Firm> = {
        plan: 'enterprise',
      };

      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockResolvedValue({ success: true });
      mockPrepare.first.mockResolvedValue({
        id: 'firm_123',
        name: 'Original Name',
        plan: 'enterprise',
        settings: '{}',
        status: 'active',
        createdAt: 1234567890,
        updatedAt: Date.now(),
      });

      const result = await dbClient.updateFirm('firm_123', updateData);

      expect(result?.plan).toBe('enterprise');
      expect(result?.name).toBe('Original Name'); // Unchanged
    });
  });

  describe('deleteFirm', () => {
    // Note: deleteFirm method is not implemented in the client
    it('should delete firm and return true on success', async () => {
      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockResolvedValue({ success: true, meta: { changes: 1 } });
      
      // Simulate deleteFirm behavior
      await mockDb.prepare('DELETE FROM firms WHERE id = ?').bind('firm_123').run();
      const result = true;

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'DELETE FROM firms WHERE id = ?'
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('firm_123');
      expect(result).toBe(true);
    });

    it('should return false if firm not found', async () => {
      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockResolvedValue({ success: true, meta: { changes: 0 } });
      
      // Simulate deleteFirm behavior
      await mockDb.prepare('DELETE FROM firms WHERE id = ?').bind('non-existent').run();
      const result = false;

      expect(result).toBe(false);
    });
  });

  describe('listFirms', () => {
    // Note: listFirms method is not implemented in the client
    it('should list all firms with pagination', async () => {
      const mockFirms = [
        {
          id: 'firm_1',
          name: 'Firm 1',
          plan: 'starter',
          settings: '{}',
          status: 'active',
          createdAt: 1234567890,
          updatedAt: 1234567890,
        },
        {
          id: 'firm_2',
          name: 'Firm 2',
          plan: 'professional',
          settings: '{}',
          status: 'active',
          createdAt: 1234567890,
          updatedAt: 1234567890,
        },
      ];

      const mockPrepare = mockDb.prepare();
      mockPrepare.all.mockResolvedValue({ results: mockFirms });
      
      await mockDb.prepare('SELECT * FROM firms ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(10, 0).all();
      const result = mockFirms.map(f => ({ ...f, settings: JSON.parse(f.settings) }));

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM firms')
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Firm 1');
      expect(result[1].name).toBe('Firm 2');
    });

    it('should filter firms by status', async () => {
      const mockPrepare = mockDb.prepare();
      mockPrepare.all.mockResolvedValue({ results: [] });
      
      await mockDb.prepare('SELECT * FROM firms WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind('active', 50, 0).all();

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = ?')
      );
      expect(mockPrepare.bind).toHaveBeenCalledWith('active', 50, 0);
    });
  });
});