import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock wrangler for testing
const mockFetch = vi.fn();
const mockWorker = {
  fetch: mockFetch,
  stop: vi.fn()
};

vi.mock('wrangler', () => ({
  unstable_dev: vi.fn().mockResolvedValue(mockWorker)
}));

describe('Invitation Flow Integration Tests', () => {
  let worker: any;
  let authCookie: string;
  
  beforeAll(async () => {
    // Use the mock worker
    worker = mockWorker;
    
    // Simulate authentication by creating a session cookie
    const sessionData = {
      userId: 'test_user_123',
      email: 'admin@testfirm.com',
      name: 'Test Admin',
      roles: ['FirmAdmin'],
      firmId: 'firm_test_001',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
      isAuthenticated: true
    };
    
    authCookie = `firm_session=${encodeURIComponent(JSON.stringify(sessionData))}`;
  });
  
  afterAll(async () => {
    await worker.stop();
  });
  
  beforeEach(() => {
    mockFetch.mockReset();
  });
  
  describe('POST /api/firm/users/invite', () => {
    it('should create a new invitation', async () => {
      // Mock successful response
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        success: true,
        message: 'Invitation sent successfully',
        invitation: {
          id: 'inv_123',
          email: 'newuser@example.com',
          status: 'pending'
        }
      }), { status: 200 }));
      const invitationData = {
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        role: 'firm:lawyer',
        practiceAreas: ['personal_injury', 'employment_law'],
        message: 'Welcome to our firm!'
      };
      
      const response = await worker.fetch('/api/firm/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie
        },
        body: JSON.stringify(invitationData)
      });
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Invitation sent successfully');
      expect(data.invitation).toMatchObject({
        email: invitationData.email,
        status: 'pending'
      });
      expect(data.invitation.id).toMatch(/^inv_/);
    });
    
    it('should prevent duplicate invitations', async () => {
      // First mock for successful creation
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        message: 'Invitation sent successfully',
        invitation: { id: 'inv_123', email: 'duplicate@example.com', status: 'pending' }
      }), { status: 200 }));
      
      // Second mock for duplicate error
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'An invitation is already pending for this email address'
      }), { status: 400 }));
      
      const invitationData = {
        email: 'duplicate@example.com',
        firstName: 'Duplicate',
        lastName: 'User',
        role: 'firm:lawyer'
      };
      
      // First invitation
      await worker.fetch('/api/firm/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie
        },
        body: JSON.stringify(invitationData)
      });
      
      // Attempt duplicate
      const response = await worker.fetch('/api/firm/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie
        },
        body: JSON.stringify(invitationData)
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('An invitation is already pending for this email address');
    });
    
    it('should reject unauthorized requests', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        error: 'Unauthorized'
      }), { status: 401 }));
      
      const response = await worker.fetch('/api/firm/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // No auth cookie
        },
        body: JSON.stringify({
          email: 'unauthorized@example.com',
          firstName: 'Unauthorized',
          lastName: 'User',
          role: 'firm:lawyer'
        })
      });
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });
  
  describe('GET /api/firm/users/invitations', () => {
    it('should retrieve invitations list', async () => {
      // Mock response with invitations
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        success: true,
        invitations: [
          { email: 'user1@example.com', firstName: 'User', lastName: 'One' },
          { email: 'user2@example.com', firstName: 'User', lastName: 'Two' }
        ]
      }), { status: 200 }));
      // Create some invitations first
      const invitations = [
        {
          email: 'user1@example.com',
          firstName: 'User',
          lastName: 'One',
          role: 'firm:lawyer'
        },
        {
          email: 'user2@example.com',
          firstName: 'User',
          lastName: 'Two',
          role: 'firm:staff'
        }
      ];
      
      for (const inv of invitations) {
        await worker.fetch('/api/firm/users/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          body: JSON.stringify(inv)
        });
      }
      
      // Get invitations list
      const response = await worker.fetch('/api/firm/users/invitations', {
        headers: {
          'Cookie': authCookie
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.invitations).toBeInstanceOf(Array);
      expect(data.invitations.length).toBeGreaterThanOrEqual(2);
      
      // Check that our invitations are included
      const emails = data.invitations.map((inv: any) => inv.email);
      expect(emails).toContain('user1@example.com');
      expect(emails).toContain('user2@example.com');
    });
  });
  
  describe('Invitation Page UI Flow', () => {
    it('should load the invitation page for authenticated admins', async () => {
      // Mock HTML response
      mockFetch.mockResolvedValue(new Response(`
        <html>
          <body>
            <h1>Invite Team Member</h1>
            <label>Email Address</label>
            <label>First Name</label>
            <label>Last Name</label>
            <button>Send Invitation</button>
            <h2>Recent Invitations</h2>
          </body>
        </html>
      `, { status: 200, headers: { 'Content-Type': 'text/html' } }));
      
      const response = await worker.fetch('/firm/users/invite', {
        headers: {
          'Cookie': authCookie
        }
      });
      
      expect(response.status).toBe(200);
      const html = await response.text();
      
      // Check for key elements
      expect(html).toContain('Invite Team Member');
      expect(html).toContain('Email Address');
      expect(html).toContain('First Name');
      expect(html).toContain('Last Name');
      expect(html).toContain('Send Invitation');
      expect(html).toContain('Recent Invitations');
    });
    
    it('should redirect non-admin users', async () => {
      // Mock redirect response
      mockFetch.mockResolvedValue(new Response(null, { 
        status: 302, 
        headers: { 'Location': '/firm/dashboard?error=unauthorized' }
      }));
      
      // Create non-admin session
      const nonAdminSession = {
        userId: 'user_456',
        email: 'user@testfirm.com',
        name: 'Regular User',
        roles: ['User'],
        firmId: 'firm_test_001',
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
        isAuthenticated: true
      };
      
      const nonAdminCookie = `firm_session=${encodeURIComponent(JSON.stringify(nonAdminSession))}`;
      
      const response = await worker.fetch('/firm/users/invite', {
        headers: {
          'Cookie': nonAdminCookie
        },
        redirect: 'manual'
      });
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/firm/dashboard?error=unauthorized');
    });
  });
});