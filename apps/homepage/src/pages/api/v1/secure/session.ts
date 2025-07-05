/**
 * Secure Session Management API
 * 
 * Provides session information and management for authenticated users.
 */

import type { APIRoute } from 'astro';
import { withAuth, createSuccessResponse, createErrorResponse, type AuthContext } from '../../../../middleware/authMiddleware.js';
import { createDatabaseClient } from '../../../../db/client.js';

// GET /api/v1/secure/session - Get current session information
export const GET: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm, permissions } = authContext;
  
  console.log(`🔐 Getting session info for user: ${user.email}`);

  try {
    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Update last activity
    await db.updateUserLastLogin(firm.id, user.id);
    
    // Build session response
    const sessionInfo = {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}` 
          : user.email,
        role: user.role,
        status: user.status,
        lastLogin: user.last_login ? new Date(user.last_login * 1000).toISOString() : null,
        createdAt: new Date(user.created_at * 1000).toISOString()
      },
      
      firm: {
        id: firm.id,
        name: firm.name,
        domain: firm.domain,
        plan: firm.plan,
        status: firm.status
      },
      
      permissions: {
        // All computed permissions from middleware
        ...permissions,
        
        // Role-based shortcuts
        isAdmin: user.role === 'admin',
        isStaff: user.role === 'staff',
        
        // Feature flags based on plan
        hasAnalytics: ['professional', 'enterprise'].includes(firm.plan),
        hasIntegrations: ['enterprise'].includes(firm.plan),
        hasAdvancedReporting: ['professional', 'enterprise'].includes(firm.plan)
      },
      
      session: {
        isAuthenticated: true,
        lastActivity: new Date().toISOString(),
        // TODO: Add actual token expiry when JWT service is integrated
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      
      // UI hints
      ui: {
        theme: user.permissions?.theme || 'light',
        locale: user.permissions?.locale || 'en-US',
        timezone: user.permissions?.timezone || 'America/New_York'
      }
    };
    
    console.log(`✅ Session info provided for user: ${user.email}`);

    return createSuccessResponse(sessionInfo);

  } catch (error) {
    console.error('❌ Failed to get session info:', error);
    return createErrorResponse(error as Error, 500);
  }
});

// POST /api/v1/secure/session/refresh - Refresh session
export const POST: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm } = authContext;
  
  console.log(`🔄 Refreshing session for user: ${user.email}`);

  try {
    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Update last activity
    await db.updateUserLastLogin(firm.id, user.id);
    
    // Log session refresh
    await db.logAudit({
      user_id: user.id,
      firm_id: firm.id,
      action: 'session.refreshed',
      details: {},
      ip_address: request.headers.get('CF-Connecting-IP') || null,
      user_agent: request.headers.get('User-Agent') || null
    });
    
    console.log(`✅ Session refreshed for user: ${user.email}`);

    return createSuccessResponse({
      message: 'Session refreshed successfully',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to refresh session:', error);
    return createErrorResponse(error as Error, 500);
  }
});

// DELETE /api/v1/secure/session - Logout / End session
export const DELETE: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm } = authContext;
  
  console.log(`🚪 Ending session for user: ${user.email}`);

  try {
    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Log logout event
    await db.logAudit({
      user_id: user.id,
      firm_id: firm.id,
      action: 'user.logout',
      details: {},
      ip_address: request.headers.get('CF-Connecting-IP') || null,
      user_agent: request.headers.get('User-Agent') || null
    });
    
    // TODO: Invalidate any server-side session tokens when implemented
    
    console.log(`✅ Session ended for user: ${user.email}`);

    return createSuccessResponse({
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('❌ Failed to end session:', error);
    return createErrorResponse(error as Error, 500);
  }
});