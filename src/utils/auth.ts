// Auth0 Authentication Utilities

import { createAuth0Client, type Auth0Client, type User } from '@auth0/auth0-spa-js';
import type { UserProfile } from '@/types/api';

class AuthManager {
  private auth0Client: Auth0Client | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.auth0Client = await createAuth0Client({
        domain: import.meta.env.AUTH0_DOMAIN || 'lexara-dev.us.auth0.com',
        clientId: import.meta.env.AUTH0_CLIENT_ID || 'your-client-id',
        authorizationParams: {
          redirect_uri: window.location.origin + '/firm/callback',
          audience: import.meta.env.AUTH0_AUDIENCE || 'https://api.lexara.app',
          scope: 'openid profile email'
        },
        cacheLocation: 'localstorage',
        useRefreshTokens: true
      });

      this.isInitialized = true;

      // Handle the redirect callback
      if (window.location.search.includes('code=') || window.location.search.includes('error=')) {
        await this.handleRedirectCallback();
      }
    } catch (error) {
      console.error('Failed to initialize Auth0:', error);
      throw error;
    }
  }

  async handleRedirectCallback() {
    if (!this.auth0Client) throw new Error('Auth0 client not initialized');

    try {
      await this.auth0Client.handleRedirectCallback();
      
      // Redirect to intended destination or dashboard
      const targetUrl = sessionStorage.getItem('auth_redirect_url') || '/dashboard';
      sessionStorage.removeItem('auth_redirect_url');
      window.location.replace(targetUrl);
    } catch (error) {
      console.error('Error handling redirect callback:', error);
      window.location.replace('/login?error=callback_failed');
    }
  }

  async login(redirectTo?: string) {
    if (!this.auth0Client) throw new Error('Auth0 client not initialized');

    if (redirectTo) {
      sessionStorage.setItem('auth_redirect_url', redirectTo);
    }

    await this.auth0Client.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'login'
      }
    });
  }

  async signup(redirectTo?: string) {
    if (!this.auth0Client) throw new Error('Auth0 client not initialized');

    if (redirectTo) {
      sessionStorage.setItem('auth_redirect_url', redirectTo);
    }

    await this.auth0Client.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'signup'
      }
    });
  }

  async logout() {
    if (!this.auth0Client) throw new Error('Auth0 client not initialized');

    await this.auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin + '/login'
      }
    });
  }

  async isAuthenticated(): Promise<boolean> {
    if (!this.auth0Client) return false;
    return await this.auth0Client.isAuthenticated();
  }

  async getUser(): Promise<UserProfile | null> {
    if (!this.auth0Client) return null;
    
    const isAuthenticated = await this.isAuthenticated();
    if (!isAuthenticated) return null;

    const user = await this.auth0Client.getUser();
    if (!user) return null;

    return {
      sub: user.sub!,
      email: user.email!,
      name: user.name!,
      picture: user.picture,
      org_id: user['https://lexara.app/org_id'],
      org_name: user['https://lexara.app/org_name'],
      role: user['https://lexara.app/role'],
      permissions: user['https://lexara.app/permissions']
    };
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.auth0Client) return null;
    
    const isAuthenticated = await this.isAuthenticated();
    if (!isAuthenticated) return null;

    try {
      return await this.auth0Client.getTokenSilently({
        authorizationParams: {
          audience: import.meta.env.AUTH0_AUDIENCE || 'https://api.lexara.app'
        }
      });
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  async requireAuth(): Promise<UserProfile> {
    const user = await this.getUser();
    if (!user) {
      await this.login(window.location.pathname);
      throw new Error('Authentication required');
    }
    return user;
  }
}

// Singleton instance
export const authManager = new AuthManager();

// Helper functions for use in components
export async function initializeAuth() {
  return authManager.initialize();
}

export async function login(redirectTo?: string) {
  return authManager.login(redirectTo);
}

export async function signup(redirectTo?: string) {
  return authManager.signup(redirectTo);
}

export async function logout() {
  return authManager.logout();
}

export async function getUser(): Promise<UserProfile | null> {
  return authManager.getUser();
}

export async function getAccessToken(): Promise<string | null> {
  return authManager.getAccessToken();
}

export async function isAuthenticated(): Promise<boolean> {
  return authManager.isAuthenticated();
}

export async function requireAuth(): Promise<UserProfile> {
  return authManager.requireAuth();
}

// Auth guard hook for protecting routes
export async function useAuthGuard(): Promise<UserProfile | null> {
  try {
    await initializeAuth();
    const isAuth = await isAuthenticated();
    
    if (!isAuth) {
      return null;
    }
    
    return await getUser();
  } catch (error) {
    console.error('Auth guard error:', error);
    return null;
  }
}