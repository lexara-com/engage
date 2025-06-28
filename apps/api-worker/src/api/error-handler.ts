/**
 * Global Error Handler
 * 
 * Provides centralized error handling for the API worker with:
 * - Structured error responses
 * - Security-conscious error messages
 * - Audit logging for errors
 * - Performance monitoring integration
 */

import type { ErrorHandler } from 'hono';
import type { Env } from './api-worker';
import { logger } from '@/utils/common/logging';

export interface APIError {
  code: string;
  message: string;
  details?: unknown;
  statusCode: number;
  requestId?: string;
  timestamp: string;
}

export class LexaraError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'LexaraError';
  }
}

// Predefined error types
export class ValidationError extends LexaraError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class AuthenticationError extends LexaraError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_ERROR', message, 401);
  }
}

export class AuthorizationError extends LexaraError {
  constructor(message: string = 'Insufficient permissions') {
    super('AUTHORIZATION_ERROR', message, 403);
  }
}

export class NotFoundError extends LexaraError {
  constructor(resource: string = 'Resource') {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class ConflictError extends LexaraError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT_ERROR', message, 409, details);
  }
}

export class RateLimitError extends LexaraError {
  constructor(retryAfter?: number) {
    super('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded', 429, { retryAfter });
  }
}

export class DataLayerError extends LexaraError {
  constructor(layer: string, operation: string, cause?: unknown) {
    super(
      'DATA_LAYER_ERROR', 
      `${layer} ${operation} failed`, 
      500, 
      { layer, operation, cause }
    );
  }
}

export const errorHandler: ErrorHandler<{ Bindings: Env }> = async (err, c) => {
  const requestId = c.get('requestId') || 'unknown';
  const env = c.env;
  
  // Log error for monitoring
  logger.error('API Error', {
    error: err.message,
    stack: err.stack,
    requestId,
    method: c.req.method,
    path: c.req.path,
    userAgent: c.req.header('user-agent'),
    firmId: c.get('firm')?.firmId,
    userId: c.get('user')?.userId
  });
  
  // Handle known error types
  if (err instanceof LexaraError) {
    return c.json(createErrorResponse(err, requestId, env), err.statusCode);
  }
  
  // Handle Hono validation errors
  if (err.name === 'HTTPException') {
    const httpErr = err as any;
    return c.json(createErrorResponse(
      new ValidationError(httpErr.message),
      requestId,
      env
    ), httpErr.status || 400);
  }
  
  // Handle Durable Object errors
  if (err.message?.includes('Durable Object')) {
    const doError = new DataLayerError('DurableObject', 'operation', err.message);
    return c.json(createErrorResponse(doError, requestId, env), 500);
  }
  
  // Handle D1 database errors
  if (err.message?.includes('D1_ERROR') || err.message?.includes('SQL')) {
    const d1Error = new DataLayerError('D1', 'query', err.message);
    return c.json(createErrorResponse(d1Error, requestId, env), 500);
  }
  
  // Handle Vectorize errors
  if (err.message?.includes('Vectorize')) {
    const vectorError = new DataLayerError('Vectorize', 'search', err.message);
    return c.json(createErrorResponse(vectorError, requestId, env), 500);
  }
  
  // Handle Auth0 errors
  if (err.message?.includes('Auth0') || err.message?.includes('JWT')) {
    const authError = new AuthenticationError('Invalid authentication token');
    return c.json(createErrorResponse(authError, requestId, env), 401);
  }
  
  // Generic server error (hide implementation details in production)
  const genericError = new LexaraError(
    'INTERNAL_SERVER_ERROR',
    env.ENVIRONMENT === 'production' 
      ? 'An internal server error occurred'
      : err.message,
    500,
    env.ENVIRONMENT === 'production' ? undefined : err.stack
  );
  
  return c.json(createErrorResponse(genericError, requestId, env), 500);
};

function createErrorResponse(error: LexaraError, requestId: string, env: Env): APIError {
  return {
    code: error.code,
    message: error.message,
    details: env.ENVIRONMENT === 'production' ? undefined : error.details,
    statusCode: error.statusCode,
    requestId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Error response helpers for common scenarios
 */
export const ErrorResponses = {
  invalidFirmContext: () => new AuthenticationError('Invalid firm context in JWT'),
  
  insufficientPermissions: (required: string[]) => 
    new AuthorizationError(`Required permissions: ${required.join(', ')}`),
  
  invalidRequestFormat: (field: string) => 
    new ValidationError(`Invalid ${field} format`),
  
  resourceNotFound: (type: string, id: string) => 
    new NotFoundError(`${type} with ID ${id}`),
  
  conflictDetected: (details: unknown) => 
    new ConflictError('Conflict of interest detected', details),
  
  conversationLocked: (sessionId: string) => 
    new ConflictError(`Conversation ${sessionId} is locked to another user`),
  
  dataInconsistency: (doValue: unknown, d1Value: unknown) => 
    new DataLayerError('Consistency', 'check', { doValue, d1Value }),
  
  rateLimitExceeded: (limit: number, window: string) => 
    new RateLimitError(),
  
  invalidSearchQuery: (reason: string) => 
    new ValidationError(`Invalid search query: ${reason}`),
  
  webhookValidationFailed: (source: string) => 
    new AuthenticationError(`Invalid webhook signature from ${source}`)
};

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return (...args: T): Promise<R> => {
    return Promise.resolve(fn(...args)).catch((error) => {
      throw error; // Will be caught by global error handler
    });
  };
}

/**
 * Error monitoring integration
 */
export async function reportError(error: Error, context: {
  requestId: string;
  firmId?: string;
  userId?: string;
  endpoint: string;
  method: string;
}) {
  // In production, integrate with error monitoring service
  // (Sentry, Bugsnag, Rollbar, etc.)
  
  if (process.env.NODE_ENV === 'production') {
    // Example: Sentry integration
    // Sentry.captureException(error, {
    //   tags: {
    //     endpoint: context.endpoint,
    //     method: context.method
    //   },
    //   user: {
    //     id: context.userId,
    //     firmId: context.firmId
    //   },
    //   extra: {
    //     requestId: context.requestId
    //   }
    // });
  }
}