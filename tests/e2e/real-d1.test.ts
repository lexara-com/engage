import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Real D1 Integration Tests', () => {
  let worker: UnstableDevWorker;
  const TEST_PORT = 8788;
  
  beforeAll(async () => {
    console.log('Building application...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('Starting real worker on port', TEST_PORT);
    worker = await unstable_dev('dist/_worker.js/index.js', {
      port: TEST_PORT,
      local: true,
      env: 'dev',
      logLevel: 'debug',
      vars: {
        ENVIRONMENT: 'test'
      }
    });
    
    // Wait for worker to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Worker started, running tests...');
  }, 30000);
  
  afterAll(async () => {
    console.log('Stopping worker...');
    await worker.stop();
  });
  
  describe('D1 Binding Verification', () => {
    it('should have D1 binding available in real environment', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/api/firm/test-d1-binding`);
      const data = await response.json();
      
      console.log('D1 binding test response:', data);
      
      if (response.status === 500) {
        console.error('D1 binding error details:', data);
      }
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('D1 binding is working');
    });
  });
  
  describe('Real Invitation API Tests', () => {
    const sessionData = {
      userId: 'test_user_123',
      email: 'admin@testfirm.com',
      name: 'Test Admin',
      roles: ['FirmAdmin'],
      firmId: 'firm_test_001',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
      isAuthenticated: true
    };
    
    const authCookie = `firm_session=${encodeURIComponent(JSON.stringify(sessionData))}`;
    
    it('should create an invitation with real D1 database', async () => {
      const invitationData = {
        email: `test-${Date.now()}@example.com`, // Unique email
        firstName: 'Real',
        lastName: 'Test',
        role: 'firm:lawyer',
        practiceAreas: ['personal_injury']
      };
      
      const response = await fetch(`http://localhost:${TEST_PORT}/api/firm/users/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie
        },
        body: JSON.stringify(invitationData)
      });
      
      const responseText = await response.text();
      console.log('Create invitation response:', response.status, responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', responseText);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
      if (response.status !== 200) {
        console.error('Invitation creation failed:', data);
      }
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.invitation).toBeDefined();
      expect(data.invitation.email).toBe(invitationData.email);
    });
    
    it('should retrieve invitations from real D1 database', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/api/firm/users/invitations`, {
        headers: {
          'Cookie': authCookie
        }
      });
      
      const data = await response.json();
      console.log('Get invitations response:', data);
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.invitations)).toBe(true);
    });
    
    it('should prevent duplicate invitations in real D1', async () => {
      const duplicateEmail = `duplicate-${Date.now()}@example.com`;
      const invitationData = {
        email: duplicateEmail,
        firstName: 'Duplicate',
        lastName: 'Test',
        role: 'firm:lawyer'
      };
      
      // First invitation
      const response1 = await fetch(`http://localhost:${TEST_PORT}/api/firm/users/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie
        },
        body: JSON.stringify(invitationData)
      });
      
      expect(response1.status).toBe(200);
      
      // Duplicate invitation
      const response2 = await fetch(`http://localhost:${TEST_PORT}/api/firm/users/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie
        },
        body: JSON.stringify(invitationData)
      });
      
      const data2 = await response2.json();
      console.log('Duplicate invitation response:', data2);
      
      expect(response2.status).toBe(400);
      expect(data2.error).toContain('already pending');
    });
  });
  
  describe('Real UI Page Tests', () => {
    const sessionData = {
      userId: 'test_user_123',
      email: 'admin@testfirm.com',
      name: 'Test Admin',
      roles: ['FirmAdmin'],
      firmId: 'firm_test_001',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
      isAuthenticated: true
    };
    
    const authCookie = `firm_session=${encodeURIComponent(JSON.stringify(sessionData))}`;
    
    it('should load the invitation page', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/firm/users/invite`, {
        headers: {
          'Cookie': authCookie
        }
      });
      
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html).toContain('Invite Team Member');
      expect(html).toContain('Email Address');
      expect(html).toContain('Send Invitation');
    });
  });
});