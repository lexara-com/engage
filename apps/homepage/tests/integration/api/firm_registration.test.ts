import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../../src/pages/api/v1/firm/register-enhanced';
import { createMockContext, createMockRequest, createMockAuth0Response } from '../../setup';

describe('API Integration - Firm Registration', () => {
  let mockFetch: any;

  beforeEach(() => {
    // Mock global fetch for Auth0 calls
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('POST /api/v1/firm/register', () => {
    const validRegistrationData = {
      plan: 'starter',
      firmName: 'Integration Test Law Firm',
      firmSize: '1-5',
      practiceAreas: ['personal_injury', 'family_law'],
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@integrationtest.com',
      password: 'SecurePass123!',
      agreedToTerms: true,
    };

    it('should successfully register a firm with valid data', async () => {
      // Mock Auth0 token endpoint
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'mock-access-token' }),
        })
        // Mock Auth0 create user endpoint
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockAuth0Response({
            email: validRegistrationData.email,
            name: `${validRegistrationData.firstName} ${validRegistrationData.lastName}`,
          }),
        });

      const mockRequest = createMockRequest({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRegistrationData),
      });
      mockRequest.json = async () => validRegistrationData;
      
      const context = createMockContext({
        request: mockRequest,
      });

      // Mock D1 database to return created firm and user
      const mockDb = context.locals.runtime.env.DB;
      
      // Create a mock that tracks different queries
      let queryCount = 0;
      const mockPrepare = vi.fn((query) => {
        const mockBind = vi.fn().mockReturnThis();
        const mockRun = vi.fn().mockResolvedValue({ 
          success: true, 
          meta: { changes: 1, last_row_id: 1 } 
        });
        const mockFirst = vi.fn();
        
        // Mock different responses based on the query
        if (query && query.includes('SELECT * FROM firms WHERE id')) {
          // getFirm query after creation
          mockFirst.mockResolvedValue({
            id: 'firm_integration_123',
            name: validRegistrationData.firmName,
            plan: validRegistrationData.plan || 'starter',
            settings: JSON.stringify({
              size: validRegistrationData.firmSize,
              practiceAreas: validRegistrationData.practiceAreas,
            }),
            status: 'active',
            created_at: Date.now(),
            updated_at: Date.now(),
          });
        }
        
        return {
          bind: mockBind,
          run: mockRun,
          first: mockFirst,
        };
      });
      
      mockDb.prepare = mockPrepare;

      const response = await POST(context);
      const result = await response.json();

      // Debug: log the error if status is 500
      if (response.status === 500) {
        console.error('Registration failed:', JSON.stringify(result, null, 2));
      }

      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('firmId');
      expect(result.data).toHaveProperty('auth0UserId');
      expect(result.data.message).toContain('Welcome to Lexara');

      // Verify Auth0 was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.auth0.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Verify database was called for firm creation
      const firmInsertCall = mockDb.prepare.mock.calls.find(call => 
        call[0] && call[0].includes('INSERT INTO firms')
      );
      expect(firmInsertCall).toBeDefined();
    });

    it('should validate all required fields', async () => {
      const testCases = [
        { field: 'firmName', message: 'required fields' },
        { field: 'firstName', message: 'required fields' },
        { field: 'lastName', message: 'required fields' },
        { field: 'email', message: 'required fields' },
        { field: 'password', message: 'required fields' },
      ];

      for (const testCase of testCases) {
        const incompleteData = { ...validRegistrationData };
        delete (incompleteData as any)[testCase.field];

        const mockRequest = createMockRequest({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(incompleteData),
        });
        mockRequest.json = async () => incompleteData;
        
        const context = createMockContext({
          request: mockRequest,
        });

        const response = await POST(context);
        const result = await response.json();

        expect(response.status).toBe(400);
        expect(result.success).toBe(false);
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain(testCase.message);
      }
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        ...validRegistrationData,
        password: 'weak',
      };

      const mockRequest = createMockRequest({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weakPasswordData),
      });
      mockRequest.json = async () => weakPasswordData;
      
      const context = createMockContext({
        request: mockRequest,
      });

      const response = await POST(context);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('PASSWORD_TOO_WEAK');
      expect(result.error.message).toContain('at least 8 characters');
    });

    it('should require terms acceptance', async () => {
      const noTermsData = {
        ...validRegistrationData,
        agreedToTerms: false,
      };

      const mockRequest = createMockRequest({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noTermsData),
      });
      mockRequest.json = async () => noTermsData;
      
      const context = createMockContext({
        request: mockRequest,
      });

      const response = await POST(context);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('TERMS_NOT_ACCEPTED');
    });

    it('should handle Auth0 errors gracefully', async () => {
      // Mock Auth0 token endpoint failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid client credentials',
      });

      const mockRequest = createMockRequest({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRegistrationData),
      });
      mockRequest.json = async () => validRegistrationData;
      
      const context = createMockContext({
        request: mockRequest,
      });

      const response = await POST(context);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('REGISTRATION_FAILED');
      expect(result.error.message).toContain('Auth0');
    });

    it('should handle database errors gracefully', async () => {
      // Mock successful Auth0 calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'mock-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockAuth0Response(),
        });

      const mockRequest = createMockRequest({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRegistrationData),
      });
      mockRequest.json = async () => validRegistrationData;
      
      const context = createMockContext({
        request: mockRequest,
      });

      // Mock database error
      const mockDb = context.locals.runtime.env.DB;
      const mockPrepare = vi.fn((query) => {
        const mockBind = vi.fn().mockReturnThis();
        
        // Make the firm creation fail
        if (query && query.includes('INSERT INTO firms')) {
          return {
            bind: mockBind,
            run: vi.fn().mockRejectedValue(new Error('Database connection failed')),
            first: vi.fn().mockRejectedValue(new Error('Database connection failed')),
          };
        }
        
        // Other queries succeed
        return {
          bind: mockBind,
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
          first: vi.fn().mockResolvedValue(null),
        };
      });
      mockDb.prepare = mockPrepare;

      const response = await POST(context);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('REGISTRATION_FAILED');
    });

    it('should create audit log entry on successful registration', async () => {
      // Mock successful Auth0 and firm creation
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'mock-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockAuth0Response(),
        });

      const mockRequest = createMockRequest({
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '192.168.1.1',
          'User-Agent': 'Integration Test Browser',
        },
        body: JSON.stringify(validRegistrationData),
      });
      mockRequest.json = async () => validRegistrationData;
      
      const context = createMockContext({
        request: mockRequest,
      });

      const mockDb = context.locals.runtime.env.DB;
      const mockPrepare = vi.fn((query) => {
        const mockBind = vi.fn().mockReturnThis();
        const mockRun = vi.fn().mockResolvedValue({ 
          success: true, 
          meta: { changes: 1, last_row_id: 1 } 
        });
        const mockFirst = vi.fn();
        
        // Mock different responses based on the query
        if (query && query.includes('SELECT * FROM firms WHERE id')) {
          // getFirm query after creation
          mockFirst.mockResolvedValue({
            id: 'firm_123',
            name: validRegistrationData.firmName,
            plan: validRegistrationData.plan || 'starter',
            settings: JSON.stringify({
              size: validRegistrationData.firmSize,
              practiceAreas: validRegistrationData.practiceAreas,
            }),
            status: 'active',
            created_at: Date.now(),
            updated_at: Date.now(),
          });
        }
        
        return {
          bind: mockBind,
          run: mockRun,
          first: mockFirst,
        };
      });
      mockDb.prepare = mockPrepare;

      await POST(context);

      // Verify audit log was created
      const auditLogCall = mockDb.prepare.mock.calls.find(call => 
        call[0] && call[0].includes('INSERT INTO audit_log')
      );
      expect(auditLogCall).toBeDefined();
    });

    it('should handle Durable Object integration', async () => {
      // Mock successful Auth0 calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'mock-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockAuth0Response(),
        });

      const mockRequest = createMockRequest({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRegistrationData),
      });
      mockRequest.json = async () => validRegistrationData;
      
      const context = createMockContext({
        request: mockRequest,
      });

      // Setup database mocks
      const mockDb = context.locals.runtime.env.DB;
      const mockPrepare = mockDb.prepare();
      mockPrepare.run.mockResolvedValue({ success: true });
      mockPrepare.first.mockResolvedValue({
        id: 'firm_123',
        name: validRegistrationData.firmName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const response = await POST(context);
      const result = await response.json();

      expect(response.status).toBe(201);
      
      // Verify Durable Object was called
      const mockDO = context.locals.runtime.env.FIRM_REGISTRY;
      expect(mockDO.idFromName).toHaveBeenCalledWith('global');
      expect(mockDO.get).toHaveBeenCalled();
    });
  });
});