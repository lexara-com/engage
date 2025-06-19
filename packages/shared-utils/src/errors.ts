// Custom error types for Engage platform

export class EngageError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EngageError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
  }
}

export class SessionNotFoundError extends EngageError {
  constructor(sessionId: string) {
    super(
      `Session not found: ${sessionId}`,
      'SESSION_NOT_FOUND',
      404,
      { sessionId }
    );
  }
}

export class UnauthorizedAccessError extends EngageError {
  constructor(reason: string) {
    super(
      `Unauthorized access: ${reason}`,
      'UNAUTHORIZED_ACCESS',
      403,
      { reason }
    );
  }
}

export class ConflictDetectedError extends EngageError {
  constructor(conflictDetails: string) {
    super(
      `Conflict of interest detected: ${conflictDetails}`,
      'CONFLICT_DETECTED',
      409,
      { conflictDetails }
    );
  }
}

export class InvalidResumeTokenError extends EngageError {
  constructor(token: string) {
    super(
      `Invalid resume token: ${token}`,
      'INVALID_RESUME_TOKEN',
      400,
      { token }
    );
  }
}

export class MCPServiceError extends EngageError {
  constructor(serviceName: string, operation: string, originalError?: Error) {
    super(
      `MCP service error in ${serviceName}.${operation}: ${originalError?.message || 'Unknown error'}`,
      'MCP_SERVICE_ERROR',
      502,
      { serviceName, operation, originalError: originalError?.message }
    );
  }
}

// Auth0 and Authentication Errors
export class Auth0TokenExchangeError extends EngageError {
  constructor(status: number, errorResponse: string, context?: Record<string, unknown>) {
    super(
      `Auth0 token exchange failed: ${status} - ${errorResponse}`,
      'AUTH0_TOKEN_EXCHANGE_FAILED',
      401,
      { 
        auth0Status: status, 
        auth0Response: errorResponse,
        ...context 
      }
    );
  }
}

export class JWTValidationError extends EngageError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super(
      `JWT validation failed: ${reason}`,
      'JWT_VALIDATION_FAILED',
      401,
      { 
        reason,
        ...context 
      }
    );
  }
}

export class AuthCallbackError extends EngageError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super(
      `Authentication callback failed: ${reason}`,
      'AUTH_CALLBACK_FAILED',
      400,
      { 
        reason,
        ...context 
      }
    );
  }
}

export class PlatformAdminAccessError extends EngageError {
  constructor(userType: string, orgId: string, context?: Record<string, unknown>) {
    super(
      `Platform admin access denied for user type: ${userType}, org: ${orgId}`,
      'PLATFORM_ADMIN_ACCESS_DENIED',
      403,
      { 
        userType,
        orgId,
        ...context 
      }
    );
  }
}

export class StateValidationError extends EngageError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super(
      `OAuth state validation failed: ${reason}`,
      'STATE_VALIDATION_FAILED',
      400,
      { 
        reason,
        ...context 
      }
    );
  }
}

// Configuration and Environment Errors  
export class ConfigurationError extends EngageError {
  constructor(missingConfig: string, context?: Record<string, unknown>) {
    super(
      `Configuration error: ${missingConfig}`,
      'CONFIGURATION_ERROR',
      500,
      { 
        missingConfig,
        ...context 
      }
    );
  }
}

export class EnvironmentError extends EngageError {
  constructor(missingVariable: string, context?: Record<string, unknown>) {
    super(
      `Missing environment variable: ${missingVariable}`,
      'ENVIRONMENT_ERROR',
      500,
      { 
        missingVariable,
        ...context 
      }
    );
  }
}

export class FirmNotFoundError extends EngageError {
  constructor(firmId: string) {
    super(
      `Firm not found: ${firmId}`,
      'FIRM_NOT_FOUND',
      404,
      { firmId }
    );
  }
}

export class DuplicateFirmError extends EngageError {
  constructor(reason: string) {
    super(
      `Duplicate firm registration: ${reason}`,
      'DUPLICATE_FIRM',
      409,
      { reason }
    );
  }
}

export class InvalidFirmDataError extends EngageError {
  constructor(reason: string) {
    super(
      `Invalid firm data: ${reason}`,
      'INVALID_FIRM_DATA',
      400,
      { reason }
    );
  }
}

export function handleError(error: unknown, defaultMessage: string = 'An unexpected error occurred'): EngageError {
  if (error instanceof EngageError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new EngageError(error.message, 'UNKNOWN_ERROR', 500, { originalError: error.message });
  }
  
  return new EngageError(defaultMessage, 'UNKNOWN_ERROR', 500, { error });
}

// Enhanced error context capture
export function captureErrorContext(request: Request, additionalContext?: Record<string, unknown>): Record<string, unknown> {
  const url = new URL(request.url);
  return {
    method: request.method,
    path: url.pathname,
    search: url.search,
    userAgent: request.headers.get('user-agent'),
    origin: request.headers.get('origin'),
    timestamp: new Date().toISOString(),
    ...additionalContext
  };
}

// Error response formatting
export function formatErrorResponse(error: EngageError, includeContext: boolean = false): Response {
  const body = {
    error: {
      code: error.code,
      message: error.message,
      ...(includeContext && error.context ? { context: error.context } : {})
    }
  };

  return new Response(JSON.stringify(body), {
    status: error.statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': error.code
    }
  });
}

// Enhanced error logging with structured format
export function logStructuredError(
  error: EngageError, 
  operation: string,
  logger?: { error: (message: string, context?: Record<string, unknown>) => void }
): void {
  const logContext = {
    operation,
    errorCode: error.code,
    statusCode: error.statusCode,
    context: error.context,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };

  if (logger) {
    logger.error(error.message, logContext);
  } else {
    console.error('Structured Error:', {
      message: error.message,
      ...logContext
    });
  }
}

// Async error wrapper for try/catch blocks
export async function asyncErrorHandler<T>(
  operation: () => Promise<T>,
  context: {
    operation: string;
    defaultError?: string;
    logger?: { error: (message: string, context?: Record<string, unknown>) => void };
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const engageError = handleError(error, context.defaultError);
    logStructuredError(engageError, context.operation, context.logger);
    throw engageError;
  }
}

// Auth0 specific error handlers
export function handleAuth0Error(response: Response, operation: string): Auth0TokenExchangeError {
  return new Auth0TokenExchangeError(
    response.status,
    response.statusText,
    {
      operation,
      url: response.url,
      timestamp: new Date().toISOString()
    }
  );
}

export function handleJWTError(originalError: Error, context?: Record<string, unknown>): JWTValidationError {
  return new JWTValidationError(
    originalError.message,
    {
      originalStack: originalError.stack,
      ...context
    }
  );
}

// Environment validation helper
export function validateEnvironment(requiredVars: string[], env: Record<string, unknown>): void {
  const missing = requiredVars.filter(varName => !env[varName]);
  
  if (missing.length > 0) {
    throw new EnvironmentError(
      `Missing required environment variables: ${missing.join(', ')}`,
      { missing, available: Object.keys(env) }
    );
  }
}