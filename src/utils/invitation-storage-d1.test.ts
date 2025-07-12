import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InvitationStorageD1 } from './invitation-storage-d1';
import type { D1Database } from '@cloudflare/workers-types';

// Mock D1 database for testing
class MockD1Database implements Partial<D1Database> {
  private data: Map<string, any[]> = new Map();
  
  prepare(query: string) {
    const self = this;
    return {
      bind(...params: any[]) {
        return {
          async run() {
            // Simple mock implementation for INSERT
            if (query.includes('INSERT INTO user_invitations')) {
              const invitations = self.data.get('user_invitations') || [];
              invitations.push({
                id: params[0],
                firm_id: params[1],
                email: params[2],
                first_name: params[3],
                last_name: params[4],
                role: params[5],
                practice_areas: params[6],
                invited_by: params[7],
                invited_by_name: params[8],
                status: params[9],
                personal_message: params[10],
                created_at: params[11],
                expires_at: params[12]
              });
              self.data.set('user_invitations', invitations);
              return { meta: { changes: 1 } };
            }
            
            // Mock UPDATE
            if (query.includes('UPDATE user_invitations')) {
              const invitations = self.data.get('user_invitations') || [];
              const updated = invitations.filter(inv => {
                if (query.includes('status = \'expired\'')) {
                  if (inv.firm_id === params[0] && inv.status === 'pending' && new Date(inv.expires_at) < new Date(params[1])) {
                    inv.status = 'expired';
                    return true;
                  }
                } else if (inv.firm_id === params[2] && inv.id === params[3]) {
                  inv.status = params[0];
                  inv.accepted_at = params[1];
                  return true;
                }
                return false;
              });
              return { meta: { changes: updated.length } };
            }
            
            return { meta: { changes: 0 } };
          },
          
          async all() {
            // Mock SELECT queries
            if (query.includes('SELECT name FROM sqlite_master')) {
              return {
                results: [
                  { name: 'firms' },
                  { name: 'firm_users' },
                  { name: 'user_invitations' }
                ]
              };
            }
            
            if (query.includes('SELECT id, firm_id, email')) {
              const invitations = self.data.get('user_invitations') || [];
              const firmId = params[0];
              const limit = params[1] || 10;
              
              return {
                results: invitations
                  .filter(inv => inv.firm_id === firmId)
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, limit)
              };
            }
            
            return { results: [] };
          },
          
          async first() {
            // Mock COUNT queries
            if (query.includes('SELECT COUNT(*)')) {
              const invitations = self.data.get('user_invitations') || [];
              const firmId = params[0];
              const email = params[1]?.toLowerCase();
              
              const count = invitations.filter(inv => 
                inv.firm_id === firmId && 
                inv.email === email && 
                inv.status === 'pending'
              ).length;
              
              return { count };
            }
            
            // Mock single invitation SELECT
            if (query.includes('SELECT id, firm_id')) {
              const invitations = self.data.get('user_invitations') || [];
              const firmId = params[0];
              const invitationId = params[1];
              
              return invitations.find(inv => 
                inv.firm_id === firmId && inv.id === invitationId
              ) || null;
            }
            
            return null;
          }
        };
      }
    } as any;
  }
  
  // Test helper to clear data
  clearData() {
    this.data.clear();
  }
}

describe('InvitationStorageD1', () => {
  let storage: InvitationStorageD1;
  let mockDb: MockD1Database;
  
  beforeEach(() => {
    mockDb = new MockD1Database();
    storage = new InvitationStorageD1(mockDb as any);
  });
  
  afterEach(() => {
    mockDb.clearData();
  });
  
  describe('saveInvitation', () => {
    it('should save a new invitation with generated fields', async () => {
      const invitationData = {
        firmId: 'firm_test_001',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'firm:lawyer',
        practiceAreas: ['personal_injury', 'employment_law'],
        invitedBy: 'admin@testfirm.com',
        invitedByName: 'Admin User'
      };
      
      const result = await storage.saveInvitation(invitationData);
      
      expect(result).toMatchObject({
        ...invitationData,
        status: 'pending'
      });
      expect(result.id).toMatch(/^inv_\d+_[a-z0-9]+$/);
      expect(result.createdAt).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      
      // Check expiration is 7 days from now
      const createdDate = new Date(result.createdAt);
      const expiresDate = new Date(result.expiresAt);
      const daysDiff = (expiresDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(7, 0);
    });
    
    it('should convert email to lowercase', async () => {
      const invitationData = {
        firmId: 'firm_test_001',
        email: 'John.Doe@Example.COM',
        firstName: 'John',
        lastName: 'Doe',
        role: 'firm:lawyer',
        invitedBy: 'admin@testfirm.com',
        invitedByName: 'Admin User'
      };
      
      await storage.saveInvitation(invitationData);
      
      // The mock stores the lowercased email
      const invitations = await storage.getInvitations('firm_test_001');
      expect(invitations[0].email).toBe('john.doe@example.com');
    });
  });
  
  describe('getInvitations', () => {
    beforeEach(async () => {
      // Add some test invitations with a small delay to ensure different timestamps
      const inv1 = await storage.saveInvitation({
        firmId: 'firm_test_001',
        email: 'user1@example.com',
        firstName: 'User',
        lastName: 'One',
        role: 'firm:lawyer',
        invitedBy: 'admin@testfirm.com',
        invitedByName: 'Admin User'
      });
      
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const inv2 = await storage.saveInvitation({
        firmId: 'firm_test_001',
        email: 'user2@example.com',
        firstName: 'User',
        lastName: 'Two',
        role: 'firm:staff',
        invitedBy: 'admin@testfirm.com',
        invitedByName: 'Admin User'
      });
      
      await storage.saveInvitation({
        firmId: 'firm_other',
        email: 'user3@example.com',
        firstName: 'User',
        lastName: 'Three',
        role: 'firm:admin',
        invitedBy: 'admin@otherfirm.com',
        invitedByName: 'Other Admin'
      });
    });
    
    it('should return invitations for specific firm only', async () => {
      const invitations = await storage.getInvitations('firm_test_001');
      
      expect(invitations).toHaveLength(2);
      expect(invitations.every(inv => inv.firmId === 'firm_test_001')).toBe(true);
    });
    
    it('should respect the limit parameter', async () => {
      const invitations = await storage.getInvitations('firm_test_001', 1);
      
      expect(invitations).toHaveLength(1);
    });
    
    it('should return invitations in reverse chronological order', async () => {
      const invitations = await storage.getInvitations('firm_test_001');
      
      // Most recent first (User Two was added after User One)
      expect(invitations[0].email).toBe('user2@example.com');
      expect(invitations[1].email).toBe('user1@example.com');
    });
  });
  
  describe('checkEmailExists', () => {
    beforeEach(async () => {
      await storage.saveInvitation({
        firmId: 'firm_test_001',
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
        role: 'firm:lawyer',
        invitedBy: 'admin@testfirm.com',
        invitedByName: 'Admin User'
      });
    });
    
    it('should return true for existing pending invitation', async () => {
      const exists = await storage.checkEmailExists('firm_test_001', 'existing@example.com');
      expect(exists).toBe(true);
    });
    
    it('should return false for non-existing email', async () => {
      const exists = await storage.checkEmailExists('firm_test_001', 'new@example.com');
      expect(exists).toBe(false);
    });
    
    it('should be case-insensitive', async () => {
      const exists = await storage.checkEmailExists('firm_test_001', 'EXISTING@EXAMPLE.COM');
      expect(exists).toBe(true);
    });
    
    it('should return false for different firm', async () => {
      const exists = await storage.checkEmailExists('firm_other', 'existing@example.com');
      expect(exists).toBe(false);
    });
  });
  
  describe('updateInvitationStatus', () => {
    let invitationId: string;
    
    beforeEach(async () => {
      const invitation = await storage.saveInvitation({
        firmId: 'firm_test_001',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'firm:lawyer',
        invitedBy: 'admin@testfirm.com',
        invitedByName: 'Admin User'
      });
      invitationId = invitation.id;
    });
    
    it('should update invitation to accepted', async () => {
      const success = await storage.updateInvitationStatus('firm_test_001', invitationId, 'accepted');
      
      expect(success).toBe(true);
      
      const invitation = await storage.getInvitationById('firm_test_001', invitationId);
      expect(invitation?.status).toBe('accepted');
      expect(invitation?.acceptedAt).toBeDefined();
    });
    
    it('should update invitation to expired', async () => {
      const success = await storage.updateInvitationStatus('firm_test_001', invitationId, 'expired');
      
      expect(success).toBe(true);
      
      const invitation = await storage.getInvitationById('firm_test_001', invitationId);
      expect(invitation?.status).toBe('expired');
      expect(invitation?.acceptedAt).toBeFalsy();
    });
    
    it('should return false for non-existing invitation', async () => {
      const success = await storage.updateInvitationStatus('firm_test_001', 'invalid_id', 'accepted');
      expect(success).toBe(false);
    });
  });
});