import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Authentication and User Management E2E Tests', () => {
  let worker: UnstableDevWorker;
  const BASE_URL = 'http://localhost:8788';

  beforeAll(async () => {
    console.log('Building application...');
    const { execSync } = await import('child_process');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('Starting real worker...');
    worker = await unstable_dev('dist/_worker.js/index.js', {
      experimental: { disableExperimentalWarning: true },
      local: true,
      port: 8788,
      logLevel: 'error',
      vars: {
        ENVIRONMENT: 'test',
        AUTH0_DOMAIN: process.env.AUTH0_DOMAIN || 'your-domain.us.auth0.com',
        AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID || 'your-client-id',
        AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET || 'your-client-secret',
        AUTH0_MGMT_CLIENT_ID: process.env.AUTH0_MGMT_CLIENT_ID || 'your-mgmt-client-id',
        AUTH0_MGMT_CLIENT_SECRET: process.env.AUTH0_MGMT_CLIENT_SECRET || 'your-mgmt-client-secret',
        JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret'
      },
      d1Databases: [{
        binding: 'DB',
        id: process.env.D1_DATABASE_ID || 'your-d1-database-id'
      }]
    });
  });

  afterAll(async () => {
    console.log('Stopping worker...');
    await worker.stop();
  });

  describe('Session and Authentication', () => {
    it('should return session info from debug endpoint', async () => {
      // Test with a valid session
      const sessionData = {
        userId: 'auth0|6872aa2d816b5c05a022c40f',
        email: 'shawnswaner+firm1@gmail.com',
        name: 'Shawn Firm 1 Admin Swaner',
        firmId: 'firm_1752345133451_esj5wfy3w',
        roles: ['firm:admin'],
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
        isAuthenticated: true
      };
      
      const response = await fetch(`${BASE_URL}/api/debug/session`, {
        headers: {
          'Cookie': `firm_session=${encodeURIComponent(JSON.stringify(sessionData))}`
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.isAuthenticated).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('shawnswaner+firm1@gmail.com');
      expect(data.user.roles).toContain('firm:admin');
      expect(data.user.firmId).toBe('firm_1752345133451_esj5wfy3w');
    });

    it('should handle unauthenticated requests', async () => {
      const response = await fetch(`${BASE_URL}/api/debug/session`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.isAuthenticated).toBe(false);
      expect(data.user).toBeNull();
    });
  });

  describe('User Management API', () => {
    const adminSession = {
      userId: 'auth0|6872aa2d816b5c05a022c40f',
      email: 'shawnswaner+firm1@gmail.com',
      name: 'Shawn Firm 1 Admin Swaner',
      firmId: 'firm_1752345133451_esj5wfy3w',
      roles: ['firm:admin'],
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
      isAuthenticated: true
    };

    it('should fetch users for authenticated admin', async () => {
      const response = await fetch(`${BASE_URL}/api/firm/users`, {
        headers: {
          'Cookie': `firm_session=${encodeURIComponent(JSON.stringify(adminSession))}`
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBe(true);
      
      // Should have at least the admin user
      const adminUser = data.users.find((u: any) => u.email === 'shawnswaner+firm1@gmail.com');
      expect(adminUser).toBeDefined();
      expect(adminUser.role).toBe('firm:admin');
      expect(adminUser.firm_id).toBe('firm_1752345133451_esj5wfy3w');
    });

    it('should reject unauthorized users', async () => {
      const nonAdminSession = {
        ...adminSession,
        roles: ['firm:viewer'] // Not an admin
      };
      
      const response = await fetch(`${BASE_URL}/api/firm/users`, {
        headers: {
          'Cookie': `firm_session=${encodeURIComponent(JSON.stringify(nonAdminSession))}`
        }
      });
      
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await fetch(`${BASE_URL}/api/firm/users`);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('User Invitation API', () => {
    const adminSession = {
      userId: 'auth0|6872aa2d816b5c05a022c40f',
      email: 'shawnswaner+firm1@gmail.com',
      name: 'Shawn Firm 1 Admin Swaner',
      firmId: 'firm_1752345133451_esj5wfy3w',
      roles: ['firm:admin'],
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
      isAuthenticated: true
    };

    it('should fetch invitations for admin', async () => {
      const response = await fetch(`${BASE_URL}/api/firm/users/invite`, {
        headers: {
          'Cookie': `firm_session=${encodeURIComponent(JSON.stringify(adminSession))}`
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.invitations).toBeDefined();
      expect(Array.isArray(data.invitations)).toBe(true);
    });

    it('should validate required fields for invitation', async () => {
      const response = await fetch(`${BASE_URL}/api/firm/users/invite`, {
        method: 'POST',
        headers: {
          'Cookie': `firm_session=${encodeURIComponent(JSON.stringify(adminSession))}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com'
          // Missing required fields
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required fields');
    });
  });

  describe('Protected Routes', () => {
    it('should redirect unauthenticated users from protected pages', async () => {
      const response = await fetch(`${BASE_URL}/firm/users`, {
        redirect: 'manual'
      });
      
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('/firm/login');
    });

    it('should allow authenticated admin to access user management page', async () => {
      const adminSession = {
        userId: 'auth0|6872aa2d816b5c05a022c40f',
        email: 'shawnswaner+firm1@gmail.com',
        name: 'Shawn Firm 1 Admin Swaner',
        firmId: 'firm_1752345133451_esj5wfy3w',
        roles: ['firm:admin'],
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
        isAuthenticated: true
      };
      
      const response = await fetch(`${BASE_URL}/firm/users`, {
        headers: {
          'Cookie': `firm_session=${encodeURIComponent(JSON.stringify(adminSession))}`
        }
      });
      
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('User Management');
      expect(html).toContain('Add User');
    });
  });
});