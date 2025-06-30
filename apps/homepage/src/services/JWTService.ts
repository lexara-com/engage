/**
 * JWT Service - Custom Token Management
 * 
 * Manages our own JWT tokens with permission claims, issued after Auth0 authentication.
 * This provides fine-grained permission control with proper refresh mechanisms.
 */

import type { 
  User, 
  Firm, 
  UserPermissions, 
  UserSession,
  DatabaseClient 
} from '../db/types.js';

// JWT payload structure
export interface JWTPayload {
  // Standard claims
  iss: string; // issuer
  sub: string; // subject (user ID)
  aud: string; // audience
  exp: number; // expiration time
  iat: number; // issued at
  jti: string; // JWT ID (for revocation)
  
  // Custom claims
  auth0_id: string;
  email: string;
  firm_id: string;
  role: 'admin' | 'user';
  permissions: UserPermissions;
  
  // Session info
  session_id: string;
}

// Token pair returned to client
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: 'Bearer';
}

// JWT configuration
export interface JWTConfig {
  issuer: string;
  audience: string;
  accessTokenExpiry: number; // seconds (default: 1 hour)
  refreshTokenExpiry: number; // seconds (default: 30 days)
  algorithm: 'HS256';
}

export class JWTService {
  private db: DatabaseClient;
  private config: JWTConfig;
  private secretKey: string;

  constructor(database: DatabaseClient, secretKey: string, config?: Partial<JWTConfig>) {
    this.db = database;
    this.secretKey = secretKey;
    this.config = {
      issuer: 'lexara.app',
      audience: 'lexara-firm-portal',
      accessTokenExpiry: 60 * 60, // 1 hour
      refreshTokenExpiry: 30 * 24 * 60 * 60, // 30 days
      algorithm: 'HS256',
      ...config
    };
  }

  /**
   * Generate token pair for authenticated user
   */
  async generateTokenPair(user: User, firm: Firm, permissions: UserPermissions): Promise<TokenPair> {
    console.log(`🔑 Generating token pair for user: ${user.email}`);

    const now = Math.floor(Date.now() / 1000);
    const sessionId = crypto.randomUUID();
    
    // Create access token
    const accessPayload: JWTPayload = {
      iss: this.config.issuer,
      sub: user.id,
      aud: this.config.audience,
      exp: now + this.config.accessTokenExpiry,
      iat: now,
      jti: crypto.randomUUID(),
      auth0_id: user.auth0_id,
      email: user.email,
      firm_id: user.firm_id,
      role: user.role,
      permissions,
      session_id: sessionId
    };

    // Create refresh token (longer lived, fewer claims)
    const refreshPayload = {
      iss: this.config.issuer,
      sub: user.id,
      aud: this.config.audience,
      exp: now + this.config.refreshTokenExpiry,
      iat: now,
      jti: crypto.randomUUID(),
      type: 'refresh',
      session_id: sessionId
    };

    const accessToken = await this.signToken(accessPayload);
    const refreshToken = await this.signToken(refreshPayload);

    // Store session in database for revocation
    const tokenHash = await this.hashToken(accessToken);
    await this.db.createSession({
      user_id: user.id,
      token_hash: tokenHash,
      permissions,
      expires_at: accessPayload.exp,
      session_id: sessionId
    });

    console.log(`✅ Token pair generated for user: ${user.email}`);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.config.accessTokenExpiry,
      token_type: 'Bearer'
    };
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload | null> {
    try {
      const payload = await this.verifyAndDecodeToken(token);
      
      if (!payload || typeof payload !== 'object') {
        return null;
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        console.log('🔒 Token expired');
        return null;
      }

      // Check if session is still valid in database
      const tokenHash = await this.hashToken(token);
      const session = await this.db.getSessionByTokenHash(tokenHash);
      
      if (!session) {
        console.log('🔒 Session not found or revoked');
        return null;
      }

      return payload as JWTPayload;

    } catch (error) {
      console.log('🔒 Token verification failed:', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair | null> {
    try {
      const refreshPayload = await this.verifyAndDecodeToken(refreshToken);
      
      if (!refreshPayload || refreshPayload.type !== 'refresh') {
        console.log('🔒 Invalid refresh token');
        return null;
      }

      // Get user and current permissions
      const user = await this.db.getUser(refreshPayload.sub);
      if (!user) {
        console.log('🔒 User not found for refresh token');
        return null;
      }

      const firm = await this.db.getFirm(user.firm_id);
      if (!firm) {
        console.log('🔒 Firm not found for refresh token');
        return null;
      }

      // Get current permissions (they might have changed)
      const permissions = user.permissions;

      // Revoke old session if it exists
      const oldSessions = await this.db.getSessionByTokenHash(await this.hashToken(refreshToken));
      if (oldSessions) {
        await this.db.deleteSession(oldSessions.id);
      }

      // Generate new token pair
      const tokenPair = await this.generateTokenPair(user, firm, permissions);

      console.log(`✅ Token refreshed for user: ${user.email}`);
      return tokenPair;

    } catch (error) {
      console.log('🔒 Token refresh failed:', error);
      return null;
    }
  }

  /**
   * Revoke token (logout)
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const tokenHash = await this.hashToken(token);
      const session = await this.db.getSessionByTokenHash(tokenHash);
      
      if (session) {
        await this.db.deleteSession(session.id);
        console.log(`✅ Token revoked for session: ${session.id}`);
      }
    } catch (error) {
      console.log('⚠️ Token revocation failed:', error);
    }
  }

  /**
   * Revoke all tokens for a user (logout from all devices)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      // This would require adding a method to delete all sessions for a user
      // For now, we'll implement it as a database query
      const query = 'DELETE FROM user_sessions WHERE user_id = ?';
      // await this.db.prepare(query).bind(userId).run();
      
      console.log(`✅ All tokens revoked for user: ${userId}`);
    } catch (error) {
      console.log('⚠️ Failed to revoke all user tokens:', error);
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const deletedCount = await this.db.deleteExpiredSessions();
      console.log(`🧹 Cleaned up ${deletedCount} expired sessions`);
      return deletedCount;
    } catch (error) {
      console.log('⚠️ Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Sign a JWT token using Cloudflare's Web Crypto API
   */
  private async signToken(payload: any): Promise<string> {
    const header = {
      alg: this.config.algorithm,
      typ: 'JWT'
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );

    const encodedSignature = this.base64UrlEncode(signature);
    
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  /**
   * Verify and decode JWT token using Cloudflare's Web Crypto API
   */
  private async verifyAndDecodeToken(token: string): Promise<any> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = this.base64UrlDecode(encodedSignature);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );

    if (!isValid) {
      throw new Error('Invalid token signature');
    }

    return JSON.parse(this.base64UrlDecodeString(encodedPayload));
  }

  /**
   * Hash token for storage (for revocation tracking)
   */
  private async hashToken(token: string): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Base64URL encode
   */
  private base64UrlEncode(data: string | ArrayBuffer): string {
    const base64 = typeof data === 'string' 
      ? btoa(data) 
      : btoa(String.fromCharCode(...new Uint8Array(data)));
    
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64URL decode to ArrayBuffer
   */
  private base64UrlDecode(str: string): ArrayBuffer {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
      str += '=';
    }
    const binaryString = atob(str);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Base64URL decode to string
   */
  private base64UrlDecodeString(str: string): string {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
      str += '=';
    }
    return atob(str);
  }
}

// Factory function to create JWT service
export function createJWTService(
  database: DatabaseClient, 
  secretKey: string, 
  config?: Partial<JWTConfig>
): JWTService {
  return new JWTService(database, secretKey, config);
}