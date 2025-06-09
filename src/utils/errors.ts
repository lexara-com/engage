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

export function handleError(error: unknown, defaultMessage: string = 'An unexpected error occurred'): EngageError {
  if (error instanceof EngageError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new EngageError(error.message, 'UNKNOWN_ERROR', 500, { originalError: error.message });
  }
  
  return new EngageError(defaultMessage, 'UNKNOWN_ERROR', 500, { error });
}