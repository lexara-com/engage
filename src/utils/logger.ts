// Centralized logging utility for Engage platform

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  sessionId?: string;
  userId?: string;
  firmId?: string;
  operation?: string;
  [key: string]: unknown;
}

export class Logger {
  private logLevel: LogLevel;
  private context: LogContext;

  constructor(logLevel: LogLevel = 'info', context: LogContext = {}) {
    this.logLevel = logLevel;
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(level: LogLevel, message: string, additionalContext?: LogContext): string {
    const timestamp = new Date().toISOString();
    const fullContext = { ...this.context, ...additionalContext };
    
    return JSON.stringify({
      timestamp,
      level,
      message,
      context: fullContext
    });
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorContext = error ? {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      } : {};
      
      console.error(this.formatMessage('error', message, { ...context, ...errorContext }));
    }
  }

  withContext(additionalContext: LogContext): Logger {
    return new Logger(this.logLevel, { ...this.context, ...additionalContext });
  }
}

export function createLogger(env: { LOG_LEVEL?: string }, context?: LogContext): Logger {
  const logLevel = (env.LOG_LEVEL as LogLevel) || 'info';
  return new Logger(logLevel, context);
}