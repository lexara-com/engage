// Platform Auth Manager - Auth0 integration and session management for platform admins
// Security: Handles platform admin authentication with enterprise security controls

import { Env } from '@/types/shared';
import { AuthContext, verifyJWT, JWTPayload } from '@/auth/auth-middleware';
import { getAuth0Config } from '@/auth/auth0-config';
import { generateULID } from '@/utils/ulid';
import { PlatformAuditLogger } from '../audit/platform-audit-logger';
import { 
  Auth0TokenExchangeError,
  JWTValidationError,
  StateValidationError,
  PlatformAdminAccessError,
  ConfigurationError,
  asyncErrorHandler,
  captureErrorContext,
  logStructuredError,
  validateEnvironment,
  handleJWTError
} from '@/utils/errors';

export interface PlatformAuthResult {
  success: boolean;
  authContext?: AuthContext;
  sessionCookie?: string;
  returnTo?: string;
  reason?: string;
  error?: string;
}

export interface PlatformSession {
  sessionId: string;
  auth0UserId: string;
  userEmail: string;
  userName: string;
  userType: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
}

export class PlatformAuthManager {
  private env: Env;
  private auditLogger: PlatformAuditLogger;
  
  constructor(env: Env, auditLogger: PlatformAuditLogger) {
    // Validate required environment variables
    validateEnvironment([
      'AUTH0_DOMAIN',
      'AUTH0_CLIENT_ID', 
      'AUTH0_CLIENT_SECRET'
    ], env);
    
    this.env = env;
    this.auditLogger = auditLogger;
  }
  
  /**
   * Generate Auth0 authorization URL for platform admin login
   */
  async generateAuthUrl(returnTo: string = '/dashboard'): Promise<string> {
    const auth0Config = getAuth0Config(this.env);
    const state = this.generateSecureState(returnTo);
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: auth0Config.adminClientId,
      redirect_uri: 'https://platform-dev.lexara.app/callback', // Use dev domain for development
      scope: 'openid profile email',
      // audience: auth0Config.audience, // Commented out as requested
      // organization: 'org_fsbkBrWfWlrlp7gI', // Disabled - client doesn't allow organization parameter
      state
    });
    
    const authUrl = `https://${auth0Config.domain}/authorize?${params}`;
    
    // Debug logging
    console.log('Generated Auth URL debug:', {
      domain: auth0Config.domain,
      client_id: auth0Config.adminClientId,
      redirect_uri: 'https://platform-dev.lexara.app/callback',
      state_length: state.length,
      full_url_length: authUrl.length,
      url_preview: authUrl.substring(0, 100) + '...'
    });
    
    return authUrl;
  }
  
  /**
   * Handle Auth0 callback and create platform admin session
   */
  async handleCallback(code: string, state: string, request: Request): Promise<PlatformAuthResult> {
    try {
      // 1. Validate state parameter
      const stateData = this.validateState(state);
      if (!stateData) {
        const stateError = new StateValidationError('State parameter validation failed', {
          stateLength: state?.length,
          hasState: !!state,
          timestamp: new Date().toISOString()
        });
        logStructuredError(stateError, 'oauth_state_validation');
        return { success: false, error: stateError.message };
      }
      
      // 2. Exchange authorization code for tokens
      const tokens = await this.exchangeCodeForTokens(code);
      if (!tokens) {
        return { success: false, error: 'Failed to exchange authorization code' };
      }
      
      // 3. Validate JWT and extract user info
      console.log('JWT validation debug:', {
        has_id_token: !!tokens.id_token,
        id_token_length: tokens.id_token?.length,
        auth0_domain: this.env.AUTH0_DOMAIN
      });
      
      let jwtPayload: JWTPayload;
      try {
        jwtPayload = await verifyJWT(tokens.id_token, this.env.AUTH0_DOMAIN!);
      } catch (originalError) {
        const jwtError = handleJWTError(originalError as Error, {
          idTokenLength: tokens.id_token.length,
          auth0Domain: this.env.AUTH0_DOMAIN
        });
        logStructuredError(jwtError, 'jwt_validation');
        return { success: false, error: jwtError.message };
      }
      
      if (!jwtPayload) {
        const jwtError = new JWTValidationError('JWT verification returned null', {
          idTokenLength: tokens.id_token.length,
          auth0Domain: this.env.AUTH0_DOMAIN
        });
        logStructuredError(jwtError, 'jwt_validation');
        return { success: false, error: jwtError.message };
      }
      
      // Convert JWT payload to AuthContext
      const authContext: AuthContext = {
        userId: jwtPayload.sub,
        userType: jwtPayload['https://lexara.app/user_type'] || 'client',
        firmId: jwtPayload['https://lexara.app/firm_id'],
        firmSlug: jwtPayload['https://lexara.app/firm_slug'],
        roles: jwtPayload['https://lexara.app/roles'] || [],
        permissions: jwtPayload['https://lexara.app/permissions'] || [],
        orgId: jwtPayload['https://lexara.app/org_id'] || '',
        email: jwtPayload.email,
        name: jwtPayload.name
      };
      
      console.log('JWT validation success, authContext:', {
        userId: authContext.userId,
        email: authContext.email,
        userType: authContext.userType,
        orgId: authContext.orgId
      });
      
      // 4. Verify platform admin access
      const isPlatformAdmin = this.isPlatformAdmin(authContext);
      console.log('Platform admin check:', {
        isPlatformAdmin,
        userType: authContext.userType,
        orgId: authContext.orgId
      });
      
      if (!isPlatformAdmin) {
        return { success: false, error: 'Platform admin access required' };
      }
      
      // 5. Create secure session
      const sessionCookie = await this.createPlatformSession(authContext, request);
      
      return {
        success: true,
        authContext,
        sessionCookie,
        returnTo: stateData.returnTo
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: `Callback processing failed: ${(error as Error).message}` 
      };
    }
  }
  
  /**
   * Require platform admin authentication for protected routes
   */
  async requirePlatformAuth(request: Request): Promise<PlatformAuthResult> {
    try {
      // 1. Extract session from cookie
      const sessionId = this.getSessionCookie(request);
      if (!sessionId) {
        return { success: false, reason: 'No session cookie' };
      }
      
      // 2. Validate session
      const session = await this.validatePlatformSession(sessionId);
      if (!session) {
        return { success: false, reason: 'Invalid or expired session' };
      }
      
      // 3. Check session expiration
      if (session.expiresAt < new Date()) {
        await this.deletePlatformSession(sessionId);
        return { success: false, reason: 'Session expired' };
      }
      
      // 4. Update session activity
      await this.updateSessionActivity(sessionId, request);
      
      // 5. Build auth context
      const authContext: AuthContext = {
        userId: session.auth0UserId,
        userType: session.userType as any,
        email: session.userEmail,
        name: session.userName,
        roles: [], // Platform admins have implicit permissions
        permissions: [],
        orgId: 'org_fsbkBrWfWlrlp7gI'
      };
      
      return { success: true, authContext };
      
    } catch (error) {
      return { 
        success: false, 
        reason: `Authentication failed: ${(error as Error).message}` 
      };
    }
  }
  
  /**
   * Handle platform admin logout
   */
  async handleLogout(request: Request): Promise<Response> {
    const sessionId = this.getSessionCookie(request);
    
    if (sessionId) {
      await this.deletePlatformSession(sessionId);
    }
    
    // Redirect to Auth0 logout
    const auth0Config = getAuth0Config(this.env);
    const logoutUrl = `https://${auth0Config.domain}/v2/logout?` + new URLSearchParams({
      client_id: auth0Config.adminClientId,
      returnTo: 'https://platform-dev.lexara.app/login'
    });
    
    const response = Response.redirect(logoutUrl, 302);
    
    // Clear session cookie
    response.headers.set('Set-Cookie', this.createClearCookie());
    
    return response;
  }
  
  private async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    id_token: string;
    token_type: string;
    expires_in: number;
  } | null> {
    const auth0Config = getAuth0Config(this.env);
    
    const tokenRequest = {
      grant_type: 'authorization_code',
      client_id: auth0Config.adminClientId,
      client_secret: this.env.AUTH0_CLIENT_SECRET,
      code,
      redirect_uri: 'https://platform-dev.lexara.app/callback'
    };
    
    // Debug logging (without exposing secrets)
    console.log('Token exchange debug:', {
      domain: auth0Config.domain,
      client_id: tokenRequest.client_id,
      redirect_uri: tokenRequest.redirect_uri,
      has_client_secret: !!tokenRequest.client_secret,
      client_secret_length: tokenRequest.client_secret?.length,
      code_length: code.length
    });
    
    const response = await fetch(`https://${auth0Config.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenRequest)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      
      // Create structured error with full context
      const error = new Auth0TokenExchangeError(
        response.status,
        errorText,
        {
          domain: auth0Config.domain,
          clientId: auth0Config.adminClientId,
          redirectUri: tokenRequest.redirect_uri,
          codeLength: code.length
        }
      );
      
      logStructuredError(error, 'auth0_token_exchange');
      return null;
    }
    
    return response.json();
  }
  
  private isPlatformAdmin(authContext: AuthContext): boolean {
    // Temporary: Allow any authenticated user for testing
    // TODO: Implement proper platform admin validation
    console.log('Platform admin validation - temporarily allowing all users for testing');
    
    // Must be Lexara employee (temporarily disabled for testing)
    // if (!authContext.userType.startsWith('lexara_')) {
    //   return false;
    // }
    
    // Must have platform admin role or be in platform organization (temporarily disabled for testing)  
    // if (authContext.orgId !== 'org_fsbkBrWfWlrlp7gI') {
    //   return false;
    // }
    
    return true; // Allow any authenticated user for now
  }
  
  private async createPlatformSession(authContext: AuthContext, request: Request): Promise<string> {
    const sessionId = generateULID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours
    
    const session: PlatformSession = {
      sessionId,
      auth0UserId: authContext.userId,
      userEmail: authContext.email || '',
      userName: authContext.name || '',
      userType: authContext.userType,
      createdAt: now,
      lastActivity: now,
      expiresAt,
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent')?.substring(0, 200) || 'unknown'
    };
    
    // Store session in Durable Object
    await this.storePlatformSession(session);
    
    // Return secure cookie value
    return this.createSessionCookie(sessionId);
  }
  
  private async storePlatformSession(session: PlatformSession): Promise<void> {
    const sessionDO = this.env.PLATFORM_SESSION.get(
      this.env.PLATFORM_SESSION.idFromName(session.sessionId)
    );
    
    await sessionDO.fetch(new Request('https://session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    }));
  }
  
  private async validatePlatformSession(sessionId: string): Promise<PlatformSession | null> {
    try {
      const sessionDO = this.env.PLATFORM_SESSION.get(
        this.env.PLATFORM_SESSION.idFromName(sessionId)
      );
      
      const response = await sessionDO.fetch(new Request('https://session/get'));
      
      if (!response.ok) {
        return null;
      }
      
      const sessionData = await response.json();
      return {
        ...sessionData,
        createdAt: new Date(sessionData.createdAt),
        lastActivity: new Date(sessionData.lastActivity),
        expiresAt: new Date(sessionData.expiresAt)
      };
    } catch (error) {
      return null;
    }
  }
  
  private async updateSessionActivity(sessionId: string, request: Request): Promise<void> {
    try {
      const sessionDO = this.env.PLATFORM_SESSION.get(
        this.env.PLATFORM_SESSION.idFromName(sessionId)
      );
      
      await sessionDO.fetch(new Request('https://session/update-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastActivity: new Date().toISOString(),
          ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown'
        })
      }));
    } catch (error) {
      // Non-critical error - session will still work
    }
  }
  
  private async deletePlatformSession(sessionId: string): Promise<void> {
    try {
      const sessionDO = this.env.PLATFORM_SESSION.get(
        this.env.PLATFORM_SESSION.idFromName(sessionId)
      );
      
      await sessionDO.fetch(new Request('https://session/delete', {
        method: 'DELETE'
      }));
    } catch (error) {
      // Non-critical error
    }
  }
  
  private generateSecureState(returnTo: string): string {
    const stateData = {
      returnTo,
      timestamp: Date.now(),
      nonce: generateULID()
    };
    
    return btoa(JSON.stringify(stateData));
  }
  
  private validateState(state: string): { returnTo: string } | null {
    try {
      const stateData = JSON.parse(atob(state));
      
      // Check timestamp (state expires after 10 minutes)
      if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
        return null;
      }
      
      return { returnTo: stateData.returnTo };
    } catch (error) {
      return null;
    }
  }
  
  private getSessionCookie(request: Request): string | null {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').map(c => c.trim().split('='));
    const sessionCookie = cookies.find(([key]) => key === 'platform_session');
    return sessionCookie ? sessionCookie[1] : null;
  }
  
  private createSessionCookie(sessionId: string): string {
    const maxAge = 24 * 60 * 60; // 24 hours in seconds
    
    return [
      `platform_session=${sessionId}`,
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      'Path=/',
      `Max-Age=${maxAge}`
    ].join('; ');
  }
  
  private createClearCookie(): string {
    return [
      'platform_session=',
      'HttpOnly',
      'Secure', 
      'SameSite=Strict',
      'Path=/',
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    ].join('; ');
  }
}