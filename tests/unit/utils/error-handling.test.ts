// Unit tests for enhanced error handling system
// Tests the new structured error handling that prevents debugging marathons

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Enhanced Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth0 Specific Errors', () => {
    it('should create Auth0TokenExchangeError with proper context', async () => {
      const { Auth0TokenExchangeError } = await import('@/utils/errors');
      
      const error = new Auth0TokenExchangeError(
        401,
        'Invalid client credentials',
        { 
          clientId: 'test-client',
          operation: 'token_exchange'
        }
      );

      expect(error.code).toBe('AUTH0_TOKEN_EXCHANGE_FAILED');
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain('Auth0 token exchange failed: 401');
      expect(error.context).toMatchObject({
        auth0Status: 401,
        auth0Response: 'Invalid client credentials',
        clientId: 'test-client',
        operation: 'token_exchange'
      });
    });

    it('should create JWTValidationError with stack trace context', async () => {
      const { JWTValidationError } = await import('@/utils/errors');
      
      const error = new JWTValidationError(
        'Invalid signature',
        {
          idTokenLength: 1234,
          auth0Domain: 'test.auth0.com'
        }
      );

      expect(error.code).toBe('JWT_VALIDATION_FAILED');
      expect(error.statusCode).toBe(401);
      expect(error.context).toMatchObject({
        reason: 'Invalid signature',
        idTokenLength: 1234,
        auth0Domain: 'test.auth0.com'
      });
    });

    it('should create StateValidationError for OAuth state issues', async () => {
      const { StateValidationError } = await import('@/utils/errors');
      
      const error = new StateValidationError(
        'State parameter expired',
        {
          stateLength: 120,
          hasState: true
        }
      );

      expect(error.code).toBe('STATE_VALIDATION_FAILED');
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('OAuth state validation failed');
    });
  });

  describe('Error Context Capture', () => {
    it('should capture comprehensive request context', async () => {
      const { captureErrorContext } = await import('@/utils/errors');
      
      const mockRequest = new Request('https://platform-dev.lexara.app/callback?code=test&state=abc', {
        method: 'GET',
        headers: {
          'user-agent': 'Mozilla/5.0...',
          'origin': 'https://platform-dev.lexara.app'
        }
      });

      const context = captureErrorContext(mockRequest, { 
        operation: 'auth_callback',
        userId: 'test-user' 
      });

      expect(context).toMatchObject({
        method: 'GET',
        path: '/callback',
        search: '?code=test&state=abc',
        userAgent: 'Mozilla/5.0...',
        origin: 'https://platform-dev.lexara.app',
        operation: 'auth_callback',
        userId: 'test-user'
      });
      expect(context.timestamp).toBeDefined();
    });
  });

  describe('Error Response Formatting', () => {
    it('should format error response with proper HTTP structure', async () => {
      const { Auth0TokenExchangeError, formatErrorResponse } = await import('@/utils/errors');
      
      const error = new Auth0TokenExchangeError(401, 'Invalid client');
      const response = formatErrorResponse(error, false);

      expect(response.status).toBe(401);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Error-Code')).toBe('AUTH0_TOKEN_EXCHANGE_FAILED');

      const body = await response.json();
      expect(body).toMatchObject({
        error: {
          code: 'AUTH0_TOKEN_EXCHANGE_FAILED',
          message: expect.stringContaining('Auth0 token exchange failed')
        }
      });
    });

    it('should include context when requested', async () => {
      const { JWTValidationError, formatErrorResponse } = await import('@/utils/errors');
      
      const error = new JWTValidationError('Invalid signature', { tokenLength: 1234 });
      const response = formatErrorResponse(error, true);

      const body = await response.json();
      expect(body.error.context).toMatchObject({
        reason: 'Invalid signature',
        tokenLength: 1234
      });
    });
  });

  describe('Structured Error Logging', () => {
    it('should log structured error with operation context', async () => {
      const { Auth0TokenExchangeError, logStructuredError } = await import('@/utils/errors');
      
      const mockLogger = {
        error: vi.fn()
      };

      const error = new Auth0TokenExchangeError(401, 'Invalid client');
      logStructuredError(error, 'auth0_token_exchange', mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Auth0 token exchange failed'),
        expect.objectContaining({
          operation: 'auth0_token_exchange',
          errorCode: 'AUTH0_TOKEN_EXCHANGE_FAILED',
          statusCode: 401,
          timestamp: expect.any(String)
        })
      );
    });

    it('should fallback to console.error when no logger provided', async () => {
      const { JWTValidationError, logStructuredError } = await import('@/utils/errors');
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new JWTValidationError('Test error');
      logStructuredError(error, 'test_operation');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Structured Error:',
        expect.objectContaining({
          message: 'JWT validation failed: Test error',
          operation: 'test_operation',
          errorCode: 'JWT_VALIDATION_FAILED'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Async Error Handler', () => {
    it('should wrap async operations with structured error handling', async () => {
      const { asyncErrorHandler, Auth0TokenExchangeError } = await import('@/utils/errors');
      
      const mockLogger = { error: vi.fn() };
      const failingOperation = async () => {
        throw new Error('Simulated failure');
      };

      await expect(
        asyncErrorHandler(failingOperation, {
          operation: 'test_operation',
          defaultError: 'Operation failed',
          logger: mockLogger
        })
      ).rejects.toThrow('Simulated failure');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should preserve EngageError types through async wrapper', async () => {
      const { asyncErrorHandler, Auth0TokenExchangeError } = await import('@/utils/errors');
      
      const failingOperation = async () => {
        throw new Auth0TokenExchangeError(401, 'Invalid client');
      };

      await expect(
        asyncErrorHandler(failingOperation, { operation: 'test' })
      ).rejects.toThrow(Auth0TokenExchangeError);
    });
  });

  describe('Environment Validation', () => {
    it('should validate required environment variables', async () => {
      const { validateEnvironment } = await import('@/utils/errors');
      
      const env = {
        AUTH0_DOMAIN: 'test.auth0.com',
        AUTH0_CLIENT_ID: 'test-client'
        // Missing AUTH0_CLIENT_SECRET
      };

      expect(() => {
        validateEnvironment(['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'], env);
      }).toThrow('Missing required environment variables: AUTH0_CLIENT_SECRET');
    });

    it('should pass validation when all variables present', async () => {
      const { validateEnvironment } = await import('@/utils/errors');
      
      const env = {
        AUTH0_DOMAIN: 'test.auth0.com',
        AUTH0_CLIENT_ID: 'test-client',
        AUTH0_CLIENT_SECRET: 'test-secret'
      };

      expect(() => {
        validateEnvironment(['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'], env);
      }).not.toThrow();
    });
  });

  describe('Auth0 Helper Functions', () => {
    it('should create Auth0 error from Response object', async () => {
      const { handleAuth0Error } = await import('@/utils/errors');
      
      const mockResponse = {
        status: 401,
        statusText: 'Unauthorized',
        url: 'https://test.auth0.com/oauth/token'
      } as Response;

      const error = handleAuth0Error(mockResponse, 'token_exchange');

      expect(error.code).toBe('AUTH0_TOKEN_EXCHANGE_FAILED');
      expect(error.context).toMatchObject({
        operation: 'token_exchange',
        url: 'https://test.auth0.com/oauth/token'
      });
    });

    it('should wrap JWT errors with additional context', async () => {
      const { handleJWTError } = await import('@/utils/errors');
      
      const originalError = new Error('Invalid token format');
      originalError.stack = 'Error stack trace...';

      const jwtError = handleJWTError(originalError, { 
        idTokenLength: 1234,
        operation: 'verification' 
      });

      expect(jwtError.code).toBe('JWT_VALIDATION_FAILED');
      expect(jwtError.context).toMatchObject({
        originalStack: 'Error stack trace...',
        idTokenLength: 1234,
        operation: 'verification'
      });
    });
  });
});