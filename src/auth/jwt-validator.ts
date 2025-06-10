// JWT validation service for Auth0 integration
// Uses Web Crypto API compatible with Cloudflare Workers

import { Env } from '@/types/shared';
import { EngageError } from '@/utils/errors';

export interface AuthContext {
  // Auth0 user info
  auth0UserId: string;      // "auth0|507f1f77bcf86cd799439011"
  email: string;            // "john@smithlaw.com"
  name: string;             // "John Smith"
  
  // Firm context (from firm lookup)
  firmId?: string;          // ULID from firm registry
  role?: FirmRole;          // "admin" | "lawyer" | "staff" | "viewer"
  permissions?: AdminPermissions;
  
  // Token metadata
  issuedAt: number;
  expiresAt: number;
  scope: string[];
  
  // Additional Auth0 fields
  nickname?: string;
  picture?: string;
  updated_at?: string;
}

export type FirmRole = 'admin' | 'lawyer' | 'staff' | 'viewer';

export interface AdminPermissions {
  canManageFirm: boolean;
  canManageUsers: boolean;
  canViewConversations: boolean;
  canDeleteConversations: boolean;
  canManageConflicts: boolean;
  canManageDocuments: boolean;
}

interface JWKSKey {
  kty: string;
  use: string;
  kid: string;
  x5t: string;
  n: string;
  e: string;
  x5c: string[];
}

interface JWKS {
  keys: JWKSKey[];
}

interface JWTHeader {
  alg: string;
  typ: string;
  kid: string;
}

interface JWTPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  scope: string;
  email?: string;
  name?: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;
  // Custom claims for Engage
  'https://lexara.app/firmId'?: string;
  'https://lexara.app/role'?: FirmRole;
}

export class JWTValidator {
  private jwksCache: Map<string, { jwks: JWKS; expiresAt: number }> = new Map();
  private keyCache: Map<string, CryptoKey> = new Map();

  /**
   * Validate an Auth0 JWT token and extract user context
   */
  async validateToken(token: string, env: Env): Promise<AuthContext | null> {
    try {
      // Parse and validate token structure
      const { header, payload, signature } = this.parseJWT(token);
      
      // Get JWKS from Auth0
      const jwks = await this.getJWKS(env.AUTH0_DOMAIN!);
      
      // Find the key for this token
      const key = await this.getVerificationKey(header.kid, jwks);
      if (!key) {
        throw new Error(`No key found for kid: ${header.kid}`);
      }
      
      // Verify JWT signature
      const isValid = await this.verifySignature(token, key);
      if (!isValid) {
        throw new Error('Invalid JWT signature');
      }
      
      // Validate token claims
      this.validateClaims(payload, env);
      
      // Extract user context
      return this.extractAuthContext(payload, env);
    } catch (error) {
      console.error('JWT validation failed:', error);
      return null;
    }
  }

  /**
   * Parse JWT into header, payload, and signature
   */
  private parseJWT(token: string): { header: JWTHeader; payload: JWTPayload; signature: string } {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    try {
      const header = JSON.parse(this.base64UrlDecode(parts[0])) as JWTHeader;
      const payload = JSON.parse(this.base64UrlDecode(parts[1])) as JWTPayload;
      const signature = parts[2];

      return { header, payload, signature };
    } catch (error) {
      throw new Error('Failed to parse JWT');
    }
  }

  /**
   * Get JWKS from Auth0 with caching
   */
  private async getJWKS(domain: string): Promise<JWKS> {
    const cacheKey = `jwks:${domain}`;
    const cached = this.jwksCache.get(cacheKey);
    
    // Return cached JWKS if valid
    if (cached && cached.expiresAt > Date.now()) {
      return cached.jwks;
    }
    
    try {
      const response = await fetch(`https://${domain}/.well-known/jwks.json`);
      if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.status}`);
      }
      
      const jwks = await response.json() as JWKS;
      
      // Cache for 1 hour
      this.jwksCache.set(cacheKey, {
        jwks,
        expiresAt: Date.now() + 3600000
      });
      
      return jwks;
    } catch (error) {
      throw new Error(`Failed to fetch JWKS from ${domain}: ${error}`);
    }
  }

  /**
   * Get verification key from JWKS
   */
  private async getVerificationKey(kid: string, jwks: JWKS): Promise<CryptoKey | null> {
    const cacheKey = `key:${kid}`;
    
    // Return cached key if available
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    // Find the key in JWKS
    const jwk = jwks.keys.find(key => key.kid === kid);
    if (!jwk) {
      return null;
    }

    try {
      // Import RSA public key
      const key = await crypto.subtle.importKey(
        'jwk',
        {
          kty: jwk.kty,
          use: jwk.use,
          n: jwk.n,
          e: jwk.e,
          alg: 'RS256'
        },
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256'
        },
        false,
        ['verify']
      );

      // Cache the key
      this.keyCache.set(cacheKey, key);
      
      return key;
    } catch (error) {
      throw new Error(`Failed to import verification key: ${error}`);
    }
  }

  /**
   * Verify JWT signature using RSA-SHA256
   */
  private async verifySignature(token: string, key: CryptoKey): Promise<boolean> {
    const parts = token.split('.');
    const signedData = parts[0] + '.' + parts[1];
    const signature = this.base64UrlDecodeToArrayBuffer(parts[2]);

    try {
      const isValid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        key,
        signature,
        new TextEncoder().encode(signedData)
      );

      return isValid;
    } catch (error) {
      throw new Error(`Signature verification failed: ${error}`);
    }
  }

  /**
   * Validate JWT claims (expiry, issuer, audience)
   */
  private validateClaims(payload: JWTPayload, env: Env): void {
    const now = Math.floor(Date.now() / 1000);

    // Check expiration
    if (payload.exp <= now) {
      throw new Error('JWT token has expired');
    }

    // Check issuer
    const expectedIssuer = `https://${env.AUTH0_DOMAIN}/`;
    if (payload.iss !== expectedIssuer) {
      throw new Error(`Invalid issuer: expected ${expectedIssuer}, got ${payload.iss}`);
    }

    // Check audience (if configured)
    if (env.AUTH0_AUDIENCE) {
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(env.AUTH0_AUDIENCE)) {
        throw new Error(`Invalid audience: expected ${env.AUTH0_AUDIENCE}`);
      }
    }

    // Check issued at (not too far in the future)
    if (payload.iat > now + 300) { // 5 minute clock skew allowance
      throw new Error('JWT issued too far in the future');
    }
  }

  /**
   * Extract user context from validated JWT payload
   */
  private extractAuthContext(payload: JWTPayload, env: Env): AuthContext {
    const scopes = payload.scope ? payload.scope.split(' ') : [];

    const context: AuthContext = {
      auth0UserId: payload.sub,
      email: payload.email || '',
      name: payload.name || '',
      issuedAt: payload.iat,
      expiresAt: payload.exp,
      scope: scopes,
      nickname: payload.nickname,
      picture: payload.picture,
      updated_at: payload.updated_at
    };

    // Extract custom claims for firm context
    const firmId = payload['https://lexara.app/firmId'];
    const role = payload['https://lexara.app/role'];

    if (firmId) {
      context.firmId = firmId;
    }

    if (role) {
      context.role = role;
      context.permissions = this.getRolePermissions(role);
    }

    return context;
  }

  /**
   * Get permissions based on user role
   */
  private getRolePermissions(role: FirmRole): AdminPermissions {
    switch (role) {
      case 'admin':
        return {
          canManageFirm: true,
          canManageUsers: true,
          canViewConversations: true,
          canDeleteConversations: true,
          canManageConflicts: true,
          canManageDocuments: true
        };
      
      case 'lawyer':
        return {
          canManageFirm: false,
          canManageUsers: false,
          canViewConversations: true,
          canDeleteConversations: true,
          canManageConflicts: true,
          canManageDocuments: true
        };
      
      case 'staff':
        return {
          canManageFirm: false,
          canManageUsers: false,
          canViewConversations: true,
          canDeleteConversations: false,
          canManageConflicts: false,
          canManageDocuments: true
        };
      
      case 'viewer':
        return {
          canManageFirm: false,
          canManageUsers: false,
          canViewConversations: true,
          canDeleteConversations: false,
          canManageConflicts: false,
          canManageDocuments: false
        };
      
      default:
        return {
          canManageFirm: false,
          canManageUsers: false,
          canViewConversations: false,
          canDeleteConversations: false,
          canManageConflicts: false,
          canManageDocuments: false
        };
    }
  }

  /**
   * Base64 URL decode string
   */
  private base64UrlDecode(str: string): string {
    // Add padding if needed
    const padded = str + '='.repeat((4 - str.length % 4) % 4);
    // Replace URL-safe characters
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    // Decode
    return atob(base64);
  }

  /**
   * Base64 URL decode to ArrayBuffer
   */
  private base64UrlDecodeToArrayBuffer(str: string): ArrayBuffer {
    const decoded = this.base64UrlDecode(str);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * Validate Auth0 JWT token (convenience function)
 */
export async function validateAuth0Token(token: string, env: Env): Promise<AuthContext | null> {
  const validator = new JWTValidator();
  return validator.validateToken(token, env);
}