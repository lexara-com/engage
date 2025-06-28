// Platform Security Guard - Request validation and security controls
// Security: Defense in depth for platform admin portal

import { Env } from '@/types/shared';
import { PlatformAuditLogger } from '../audit/platform-audit-logger';

export interface SecurityValidationResult {
  valid: boolean;
  reason?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  blockedReason?: string;
}

export class PlatformSecurityGuard {
  private env: Env;
  private auditLogger: PlatformAuditLogger;
  
  constructor(env: Env, auditLogger: PlatformAuditLogger) {
    this.env = env;
    this.auditLogger = auditLogger;
  }
  
  /**
   * Comprehensive request validation for platform admin portal
   */
  async validateRequest(request: Request): Promise<SecurityValidationResult> {
    const url = new URL(request.url);
    
    // 1. Origin validation
    const originCheck = this.validateOrigin(request);
    if (!originCheck.valid) {
      return originCheck;
    }
    
    // 2. Rate limiting check
    const rateLimitCheck = await this.checkRateLimit(request);
    if (!rateLimitCheck.valid) {
      return rateLimitCheck;
    }
    
    // 3. IP address validation
    const ipCheck = this.validateIPAddress(request);
    if (!ipCheck.valid) {
      return ipCheck;
    }
    
    // 4. Request method validation
    const methodCheck = this.validateRequestMethod(request);
    if (!methodCheck.valid) {
      return methodCheck;
    }
    
    // 5. Content type validation for POST requests
    if (request.method === 'POST') {
      const contentTypeCheck = this.validateContentType(request);
      if (!contentTypeCheck.valid) {
        return contentTypeCheck;
      }
    }
    
    // 6. Path validation
    const pathCheck = this.validatePath(url.pathname);
    if (!pathCheck.valid) {
      return pathCheck;
    }
    
    // 7. User agent validation
    const userAgentCheck = this.validateUserAgent(request);
    if (!userAgentCheck.valid) {
      return userAgentCheck;
    }
    
    return { valid: true };
  }
  
  private validateOrigin(request: Request): SecurityValidationResult {
    const origin = request.headers.get('Origin');
    const referer = request.headers.get('Referer');
    
    // Allowed origins for platform admin
    const allowedOrigins = [
      'https://platform.lexara.app',
      'https://platform-dev.lexara.app',
      'https://platform-test.lexara.app'
    ];
    
    // Development environment
    if (this.env.ENVIRONMENT === 'development') {
      allowedOrigins.push('http://localhost:3000');
      allowedOrigins.push('http://127.0.0.1:3000');
    }
    
    // For non-browser requests (like direct API calls), origin might be null
    if (!origin && !referer) {
      // Allow direct requests to public endpoints
      const url = new URL(request.url);
      const publicPaths = ['/health', '/login', '/callback'];
      if (publicPaths.includes(url.pathname)) {
        return { valid: true };
      }
      
      return {
        valid: false,
        reason: 'Missing Origin and Referer headers for protected endpoint',
        riskLevel: 'medium'
      };
    }
    
    // Check origin
    if (origin && !allowedOrigins.includes(origin)) {
      return {
        valid: false,
        reason: `Invalid origin: ${origin}`,
        riskLevel: 'high',
        blockedReason: 'Cross-origin request from unauthorized domain'
      };
    }
    
    // Check referer as fallback
    if (!origin && referer) {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.includes(refererOrigin)) {
        return {
          valid: false,
          reason: `Invalid referer origin: ${refererOrigin}`,
          riskLevel: 'high',
          blockedReason: 'Request from unauthorized referer domain'
        };
      }
    }
    
    return { valid: true };
  }
  
  private async checkRateLimit(request: Request): Promise<SecurityValidationResult> {
    // Rate limiting by IP address
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    if (clientIP === 'unknown') {
      return {
        valid: false,
        reason: 'Missing client IP address',
        riskLevel: 'medium'
      };
    }
    
    // TODO: Implement actual rate limiting with KV or Durable Objects
    // For now, just validate IP format
    if (!this.isValidIPAddress(clientIP)) {
      return {
        valid: false,
        reason: `Invalid IP address format: ${clientIP}`,
        riskLevel: 'high'
      };
    }
    
    // Basic rate limiting - 100 requests per minute per IP
    const rateLimitKey = `rate_limit:${clientIP}`;
    const currentTime = Math.floor(Date.now() / 60000); // Current minute
    
    // TODO: Check rate limit in KV store
    // For MVP, assume rate limit is not exceeded
    
    return { valid: true };
  }
  
  private validateIPAddress(request: Request): SecurityValidationResult {
    const clientIP = request.headers.get('CF-Connecting-IP');
    
    if (!clientIP) {
      return {
        valid: false,
        reason: 'Missing client IP address',
        riskLevel: 'medium'
      };
    }
    
    // Block known malicious IP ranges (example)
    const blockedRanges = [
      '0.0.0.0',
      '127.0.0.1',
      '::1'
    ];
    
    if (blockedRanges.includes(clientIP)) {
      return {
        valid: false,
        reason: `Blocked IP address: ${clientIP}`,
        riskLevel: 'high',
        blockedReason: 'IP address in blocked range'
      };
    }
    
    // In production, implement IP allowlisting for platform admins
    if (this.env.ENVIRONMENT === 'production') {
      // TODO: Check if IP is in allowed Lexara office ranges
      // For now, allow all valid IPs
    }
    
    return { valid: true };
  }
  
  private validateRequestMethod(request: Request): SecurityValidationResult {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
    
    if (!allowedMethods.includes(request.method)) {
      return {
        valid: false,
        reason: `Invalid HTTP method: ${request.method}`,
        riskLevel: 'medium'
      };
    }
    
    return { valid: true };
  }
  
  private validateContentType(request: Request): SecurityValidationResult {
    const contentType = request.headers.get('Content-Type');
    
    if (!contentType) {
      return {
        valid: false,
        reason: 'Missing Content-Type header for POST request',
        riskLevel: 'low'
      };
    }
    
    const allowedContentTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data'
    ];
    
    const isValidContentType = allowedContentTypes.some(type => 
      contentType.toLowerCase().includes(type)
    );
    
    if (!isValidContentType) {
      return {
        valid: false,
        reason: `Invalid Content-Type: ${contentType}`,
        riskLevel: 'medium'
      };
    }
    
    return { valid: true };
  }
  
  private validatePath(pathname: string): SecurityValidationResult {
    // Check for path traversal attempts
    if (pathname.includes('..') || pathname.includes('//')) {
      return {
        valid: false,
        reason: `Path traversal attempt detected: ${pathname}`,
        riskLevel: 'high',
        blockedReason: 'Potential path traversal attack'
      };
    }
    
    // Check for null bytes
    if (pathname.includes('\0')) {
      return {
        valid: false,
        reason: 'Null byte detected in path',
        riskLevel: 'high',
        blockedReason: 'Potential null byte injection'
      };
    }
    
    // Check path length
    if (pathname.length > 1000) {
      return {
        valid: false,
        reason: 'Path too long',
        riskLevel: 'medium'
      };
    }
    
    // Validate against allowed platform admin paths
    const allowedPathPrefixes = [
      '/',
      '/login',
      '/callback',
      '/logout',
      '/dashboard',
      '/firms',
      '/analytics',
      '/health',
      '/static/',
      '/assets/'
    ];
    
    const isValidPath = allowedPathPrefixes.some(prefix => 
      pathname === prefix || pathname.startsWith(prefix)
    );
    
    if (!isValidPath) {
      return {
        valid: false,
        reason: `Invalid path for platform admin: ${pathname}`,
        riskLevel: 'medium'
      };
    }
    
    return { valid: true };
  }
  
  private validateUserAgent(request: Request): SecurityValidationResult {
    const userAgent = request.headers.get('User-Agent');
    
    if (!userAgent) {
      return {
        valid: false,
        reason: 'Missing User-Agent header',
        riskLevel: 'low'
      };
    }
    
    // Block known malicious user agents
    const blockedUserAgents = [
      'sqlmap',
      'nikto',
      'nmap',
      'masscan',
      'curl', // Block basic curl for security
      'wget'
    ];
    
    const lowerUserAgent = userAgent.toLowerCase();
    for (const blocked of blockedUserAgents) {
      if (lowerUserAgent.includes(blocked)) {
        return {
          valid: false,
          reason: `Blocked user agent: ${blocked}`,
          riskLevel: 'high',
          blockedReason: 'Suspicious or automated user agent detected'
        };
      }
    }
    
    // User agent should look like a real browser for platform admin
    const browserIndicators = [
      'mozilla',
      'chrome',
      'firefox',
      'safari',
      'edge'
    ];
    
    const hasValidBrowserIndicator = browserIndicators.some(indicator => 
      lowerUserAgent.includes(indicator)
    );
    
    if (!hasValidBrowserIndicator) {
      return {
        valid: false,
        reason: 'Non-browser user agent for platform admin',
        riskLevel: 'medium',
        blockedReason: 'Platform admin requires browser access'
      };
    }
    
    return { valid: true };
  }
  
  private isValidIPAddress(ip: string): boolean {
    // IPv4 validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }
    
    // IPv6 validation (basic)
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (ipv6Regex.test(ip)) {
      return true;
    }
    
    // IPv6 compressed format
    if (ip.includes('::')) {
      return true; // Simplified validation for compressed IPv6
    }
    
    return false;
  }
}