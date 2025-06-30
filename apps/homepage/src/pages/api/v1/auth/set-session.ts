import type { APIRoute } from 'astro';

// Session configuration
const SESSION_DURATION = 8 * 60 * 60; // 8 hours (shorter than Auth0 token)
const REFRESH_THRESHOLD = 2 * 60 * 60; // Refresh if less than 2 hours remaining

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { accessToken, user } = await request.json();
    
    if (!accessToken || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing access token or user data'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify the Auth0 token (basic validation)
    if (!accessToken.startsWith('ey')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid token format'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate secure session ID using Web Crypto API
    const sessionIdBytes = new Uint8Array(32);
    crypto.getRandomValues(sessionIdBytes);
    const sessionId = Array.from(sessionIdBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Create session data with enhanced security
    const now = Math.floor(Date.now() / 1000);
    const sessionData = {
      sessionId: sessionId,
      userId: user.sub,
      email: user.email,
      firmId: user.user_metadata?.firmId || `firm-${user.email.split('@')[1].replace(/\./g, '-')}`,
      role: user.user_metadata?.role || 'user',
      isAuthenticated: true,
      iat: now,
      exp: now + SESSION_DURATION,
      refreshThreshold: now + (SESSION_DURATION - REFRESH_THRESHOLD),
      userAgent: request.headers.get('user-agent')?.substring(0, 200) || 'unknown',
      ipAddress: request.headers.get('cf-connecting-ip') || 
                 request.headers.get('x-forwarded-for') || 
                 'unknown'
    };
    
    // Set HTTP-only session cookie with enhanced security
    cookies.set('lexara_session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: true,
      sameSite: 'strict', // More restrictive for security
      maxAge: SESSION_DURATION,
      path: '/',
      // Add additional security headers
      priority: 'high'
    });
    
    // Set a client-readable auth status cookie (minimal info for UI)
    cookies.set('lexara_auth_status', JSON.stringify({
      authenticated: true,
      email: user.email,
      firmId: sessionData.firmId,
      role: sessionData.role,
      exp: sessionData.exp
    }), {
      httpOnly: false,
      secure: true,
      sameSite: 'strict',
      maxAge: SESSION_DURATION,
      path: '/'
    });
    
    console.log(`✅ Secure session created for user: ${user.email}, firm: ${sessionData.firmId}, sessionId: ${sessionId.substring(0, 8)}...`);
    
    return new Response(JSON.stringify({
      success: true,
      session: {
        sessionId: sessionId,
        expiresAt: sessionData.exp,
        refreshAt: sessionData.refreshThreshold
      },
      user: {
        email: user.email,
        firmId: sessionData.firmId,
        role: sessionData.role
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        // Add security headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    });
    
  } catch (error) {
    console.error('Error setting session cookies:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to set session'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};