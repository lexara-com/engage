import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from './invite';
import type { APIContext } from 'astro';

// Mock the invitation storage module
const mockCheckEmailExists = vi.fn();
const mockSaveInvitation = vi.fn();
const mockGetInvitations = vi.fn();

vi.mock('../../../../utils/invitation-storage-d1', () => {
  return {
    InvitationStorageD1: vi.fn().mockImplementation(() => ({
      checkEmailExists: mockCheckEmailExists,
      saveInvitation: mockSaveInvitation,
      getInvitations: mockGetInvitations
    }))
  };
});

// Mock Auth0 config
vi.mock('../../../../auth/auth0-config', () => ({
  getAuth0Config: vi.fn().mockReturnValue({}),
  AUTH0_ROLES: {}
}));

describe('Invite API Endpoints', () => {
  let mockContext: APIContext;
  let mockDB: any;
  
  beforeEach(() => {
    mockDB = {};
    
    mockContext = {
      request: new Request('http://localhost/api/firm/users/invite'),
      locals: {
        isAuthenticated: true,
        user: {
          email: 'admin@testfirm.com',
          name: 'Admin User',
          roles: ['FirmAdmin'],
          firmId: 'firm_test_001'
        }
      },
      env: {
        DB: mockDB
      }
    } as any;
    
    // Reset all mocks
    mockCheckEmailExists.mockReset();
    mockSaveInvitation.mockReset();
    mockGetInvitations.mockReset();
  });
  
  describe('POST /api/firm/users/invite', () => {
    it('should require authentication', async () => {
      mockContext.locals.isAuthenticated = false;
      mockContext.locals.user = null;
      
      const response = await POST(mockContext);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
    
    it('should require admin permissions', async () => {
      mockContext.locals.user.roles = ['User'];
      mockContext.request = new Request('http://localhost/api/firm/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          role: 'firm:lawyer'
        })
      });
      
      const response = await POST(mockContext);
      
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });
    
    it('should allow test admin email', async () => {
      mockContext.locals.user.email = 'shawnswaner+test7@gmail.com';
      mockContext.locals.user.roles = ['User'];
      mockContext.request = new Request('http://localhost/api/firm/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          role: 'firm:lawyer'
        })
      });
      
      const response = await POST(mockContext);
      
      // Should not be 403 for test admin
      expect(response.status).not.toBe(403);
    });
    
    it('should validate required fields', async () => {
      mockContext.request = new Request('http://localhost/api/firm/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: 'new@example.com'
          // Missing firstName, lastName, role
        })
      });
      
      const response = await POST(mockContext);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required fields');
    });
    
    it('should validate email format', async () => {
      mockContext.request = new Request('http://localhost/api/firm/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          firstName: 'New',
          lastName: 'User',
          role: 'firm:lawyer'
        })
      });
      
      const response = await POST(mockContext);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid email format');
    });
    
    it('should validate role', async () => {
      mockContext.request = new Request('http://localhost/api/firm/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          role: 'invalid:role'
        })
      });
      
      const response = await POST(mockContext);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid role');
    });
    
    it('should check for database configuration', async () => {
      delete mockContext.env.DB;
      mockContext.request = new Request('http://localhost/api/firm/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          role: 'firm:lawyer'
        })
      });
      
      const response = await POST(mockContext);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Database not configured');
    });
    
    it('should create invitation successfully', async () => {
      mockCheckEmailExists.mockResolvedValue(false);
      mockSaveInvitation.mockResolvedValue({
        id: 'inv_123',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        role: 'firm:lawyer',
        status: 'pending',
        firmId: 'firm_test_001',
        invitedBy: 'admin@testfirm.com',
        invitedByName: 'Admin User',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
      
      mockContext.request = new Request('http://localhost/api/firm/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          role: 'firm:lawyer',
          practiceAreas: ['personal_injury'],
          message: 'Welcome to the team!'
        })
      });
      
      const response = await POST(mockContext);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Invitation sent successfully');
      expect(data.invitation).toBeDefined();
    });
    
    it('should prevent duplicate invitations', async () => {
      mockCheckEmailExists.mockResolvedValue(true);
      
      mockContext.request = new Request('http://localhost/api/firm/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: 'existing@example.com',
          firstName: 'Existing',
          lastName: 'User',
          role: 'firm:lawyer'
        })
      });
      
      const response = await POST(mockContext);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('An invitation is already pending for this email address');
    });
  });
  
  describe('GET /api/firm/users/invite', () => {
    it('should require authentication', async () => {
      mockContext.locals.isAuthenticated = false;
      mockContext.locals.user = null;
      
      const response = await GET(mockContext);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
    
    it('should check database configuration', async () => {
      delete mockContext.env.DB;
      
      const response = await GET(mockContext);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Database not configured');
    });
    
    it('should return invitations list', async () => {
      const mockInvitations = [
        {
          id: 'inv_1',
          email: 'user1@example.com',
          firstName: 'User',
          lastName: 'One',
          role: 'firm:lawyer',
          status: 'pending',
          createdAt: new Date().toISOString(),
          invitedByName: 'Admin User'
        },
        {
          id: 'inv_2',
          email: 'user2@example.com',
          firstName: 'User',
          lastName: 'Two',
          role: 'firm:staff',
          status: 'accepted',
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          invitedByName: 'Admin User'
        }
      ];
      
      mockGetInvitations.mockResolvedValue(mockInvitations);
      
      const response = await GET(mockContext);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.invitations).toHaveLength(2);
      expect(data.invitations[0]).toMatchObject({
        id: 'inv_1',
        email: 'user1@example.com',
        firstName: 'User',
        lastName: 'One'
      });
    });
  });
});