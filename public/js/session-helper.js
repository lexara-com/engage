/**
 * Session Helper for Lexara Firm Portal
 * Manages client-side session state and provides utilities
 */

window.LexaraSession = {
  /**
   * Get the current session from cookie
   */
  getSession() {
    const cookies = {};
    document.cookie.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = value;
      }
    });

    const sessionCookie = cookies['firm_session'];
    if (!sessionCookie) {
      return null;
    }

    try {
      const session = JSON.parse(decodeURIComponent(sessionCookie));
      
      // Check if session is expired
      const now = Math.floor(Date.now() / 1000);
      if (session.exp && session.exp < now) {
        console.log('Session expired');
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Failed to parse session:', error);
      return null;
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    const session = this.getSession();
    return session && session.isAuthenticated === true;
  },

  /**
   * Get the current user
   */
  getUser() {
    const session = this.getSession();
    return session ? {
      id: session.userId,
      email: session.email,
      name: session.name,
      firmId: session.firmId,
      roles: session.roles
    } : null;
  },

  /**
   * Update session cookie (extends expiration)
   */
  refreshSession() {
    const session = this.getSession();
    if (!session) return false;

    // Extend expiration by 24 hours
    session.exp = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
    
    const cookieOptions = [
      `firm_session=${encodeURIComponent(JSON.stringify(session))}`,
      'path=/',
      `max-age=${24 * 60 * 60}`,
      'samesite=lax'
    ];
    
    if (window.location.protocol === 'https:') {
      cookieOptions.push('secure');
    }
    
    document.cookie = cookieOptions.join('; ');
    console.log('Session refreshed');
    return true;
  },

  /**
   * Clear the session
   */
  clearSession() {
    document.cookie = 'firm_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    console.log('Session cleared');
  },

  /**
   * Monitor session and redirect if expired
   */
  startSessionMonitor() {
    // Check session every 30 seconds
    setInterval(() => {
      if (!this.isAuthenticated()) {
        console.log('Session expired, redirecting to login');
        window.location.href = '/firm/login?returnTo=' + encodeURIComponent(window.location.pathname);
      }
    }, 30000);
  },

  /**
   * Initialize session helper
   */
  init() {
    // Refresh session on page navigation to keep it active
    if (this.isAuthenticated()) {
      this.refreshSession();
    }
    
    // Start monitoring for protected pages
    const protectedPaths = ['/firm/dashboard', '/firm/conversations', '/firm/settings'];
    if (protectedPaths.some(path => window.location.pathname.startsWith(path))) {
      this.startSessionMonitor();
    }
  }
};

// Auto-initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => LexaraSession.init());
} else {
  LexaraSession.init();
}