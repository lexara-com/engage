// Rate limiting middleware for Admin API

import { AdminEnv, AuthenticatedRequest } from '../types';
import { createLogger } from '@/utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  default: { windowMs: 60000, maxRequests: 100 },      // 100 requests per minute
  strict: { windowMs: 60000, maxRequests: 20 },        // 20 requests per minute for sensitive ops
  bulk: { windowMs: 300000, maxRequests: 10 }          // 10 bulk operations per 5 minutes
};

export async function handleRateLimit(
  request: AuthenticatedRequest, 
  env: AdminEnv,
  configName: string = 'default'
): Promise<AuthenticatedRequest | Response> {
  const logger = createLogger(env, { operation: 'rate-limit' });
  
  try {
    // Skip rate limiting in development
    if (env.ENVIRONMENT === 'development') {
      return request;
    }

    const config = RATE_LIMIT_CONFIGS[configName] || RATE_LIMIT_CONFIGS.default;
    const identifier = getRateLimitIdentifier(request);
    const key = `rate_limit:${configName}:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get current request count from D1
    const result = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM rate_limit_log WHERE key = ? AND timestamp > ?'
    ).bind(key, windowStart).first();

    const currentCount = result?.count as number || 0;

    if (currentCount >= config.maxRequests) {
      logger.warn('Rate limit exceeded', {
        identifier,
        configName,
        currentCount,
        limit: config.maxRequests
      });

      return rateLimitExceededResponse(config);
    }

    // Log this request
    await env.DB.prepare(
      'INSERT INTO rate_limit_log (key, timestamp) VALUES (?, ?)'
    ).bind(key, now).run();

    // Clean up old entries periodically (1% chance)
    if (Math.random() < 0.01) {
      ctx.waitUntil(cleanupOldEntries(env.DB, windowStart));
    }

    return request;

  } catch (error) {
    logger.error('Rate limit check failed', error as Error);
    // Fail open - allow request if rate limiting fails
    return request;
  }
}

function getRateLimitIdentifier(request: AuthenticatedRequest): string {
  // Use user ID if authenticated, otherwise use IP
  if (request.user) {
    return `user:${request.user.sub}`;
  }

  // Fall back to CF-Connecting-IP or X-Forwarded-For
  const ip = request.headers.get('CF-Connecting-IP') || 
             request.headers.get('X-Forwarded-For')?.split(',')[0] || 
             'unknown';
  
  return `ip:${ip}`;
}

function rateLimitExceededResponse(config: RateLimitConfig): Response {
  const retryAfter = Math.ceil(config.windowMs / 1000); // Convert to seconds

  return new Response(JSON.stringify({
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      details: {
        retryAfter
      }
    }
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Window': (config.windowMs / 1000).toString()
    }
  });
}

async function cleanupOldEntries(db: D1Database, cutoff: number): Promise<void> {
  try {
    await db.prepare(
      'DELETE FROM rate_limit_log WHERE timestamp < ?'
    ).bind(cutoff).run();
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Create rate limit table if it doesn't exist
export const RATE_LIMIT_TABLE = `
CREATE TABLE IF NOT EXISTS rate_limit_log (
  key TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  INDEX idx_key_timestamp (key, timestamp)
);
`;