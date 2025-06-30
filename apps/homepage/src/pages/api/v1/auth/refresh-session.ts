import type { APIRoute } from 'astro';

// Session configuration
const SESSION_DURATION = 8 * 60 * 60; // 8 hours
const REFRESH_THRESHOLD = 2 * 60 * 60; // Refresh if less than 2 hours remaining

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Get current session cookie
    const sessionCookie = cookies.get('lexara_session');
    
    if (!sessionCookie) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No session found'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse session data
    let sessionData;
    try {
      sessionData = JSON.parse(sessionCookie.value);
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid session data'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if session is expired
    const now = Math.floor(Date.now() / 1000);
    if (sessionData.exp && sessionData.exp < now) {
      // Clear expired session
      cookies.delete('lexara_session');
      cookies.delete('lexara_auth_status');
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Session expired'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if refresh is needed (within refresh threshold)
    if (sessionData.refreshThreshold && now < sessionData.refreshThreshold) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Session still valid, no refresh needed',
        session: {
          sessionId: sessionData.sessionId,
          expiresAt: sessionData.exp,
          refreshAt: sessionData.refreshThreshold
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Refresh the session - extend expiration
    const refreshedSessionData = {
      ...sessionData,
      iat: now,
      exp: now + SESSION_DURATION,
      refreshThreshold: now + (SESSION_DURATION - REFRESH_THRESHOLD),
      lastRefresh: now
    };
    
    // Update session cookie
    cookies.set('lexara_session', JSON.stringify(refreshedSessionData), {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: SESSION_DURATION,
      path: '/',
      priority: 'high'
    });
    
    // Update auth status cookie
    cookies.set('lexara_auth_status', JSON.stringify({
      authenticated: true,
      email: refreshedSessionData.email,
      firmId: refreshedSessionData.firmId,
      role: refreshedSessionData.role,
      exp: refreshedSessionData.exp
    }), {
      httpOnly: false,
      secure: true,
      sameSite: 'strict',
      maxAge: SESSION_DURATION,
      path: '/'
    });
    
    console.log(`✅ Session refreshed for user: ${sessionData.email}, sessionId: ${sessionData.sessionId?.substring(0, 8)}...`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Session refreshed successfully',
      session: {
        sessionId: refreshedSessionData.sessionId,
        expiresAt: refreshedSessionData.exp,
        refreshAt: refreshedSessionData.refreshThreshold
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    });
    
  } catch (error) {
    console.error('Error refreshing session:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to refresh session'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};