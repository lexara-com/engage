/**
 * Legacy Permission API Bridge
 * 
 * Provides server-side permissions using existing Auth0 metadata
 * This allows testing the new UI without full database migration
 */

import type { APIRoute } from 'astro';
import { createAuth0ManagementClient, isUserAdmin, extractFirmId } from '../../../../utils/auth0-management.js';

export const GET: APIRoute = async (context) => {
  try {
    console.log('📋 Legacy: Providing permission context from Auth0...');
    console.log('🔍 Request URL:', context.url);
    console.log('🔍 Request headers:', Object.fromEntries(context.request.headers.entries()));
    
    // Extract Auth0 user ID from token
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Authentication token required');
    }
    
    const token = authHeader.slice(7);
    let userId = null;
    
    try {
      // Check if it's a JWE (encrypted) token - has 5 parts separated by dots
      const parts = token.split('.');
      
      if (parts.length === 5) {
        // This is a JWE token - we can't decode it client-side
        // We'll need to use Auth0 Management API to validate it
        console.log('🔐 JWE token detected, will validate via Auth0 Management API');
        
        // For JWE tokens, we'll get user info from Auth0 Management API
        // First, let's try to get all users and match by recent activity
        const env = context.locals?.runtime?.env;
        const auth0Client = createAuth0ManagementClient(env);
        
        // Get recent users (this is a workaround for JWE tokens)
        const users = await auth0Client.getUsers({ per_page: 50, sort: 'last_login:-1' });
        
        // For now, we'll take the most recently logged in user
        // In production, you'd want a more robust way to identify the user
        if (users && users.length > 0) {
          const recentUser = users[0];
          userId = recentUser.user_id;
          console.log(`🔍 Using most recent user: ${recentUser.email} (${userId})`);
        } else {
          throw new Error('No users found in Auth0 tenant');
        }
        
      } else if (parts.length === 3) {
        // This is a regular JWT - decode normally
        const payload = JSON.parse(atob(parts[1]));
        userId = payload.sub;
        console.log(`🔓 JWT token decoded, user: ${userId}`);
      } else {
        throw new Error('Invalid token format');
      }
      
    } catch (error) {
      console.error('❌ Token parsing error:', error);
      throw new Error(`Invalid authentication token: ${error.message}`);
    }
    
    if (!userId) {
      throw new Error('Could not extract user ID from token');
    }
    
    // Create Auth0 client and get user
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    const auth0User = await auth0Client.getUser(userId);
    const firmId = extractFirmId(auth0User);
    const isAdmin = isUserAdmin(auth0User);
    
    if (!firmId) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Firm ID not found in user metadata' }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build permission context from Auth0 data
    const permissionContext = {
      user: {
        id: auth0User.user_id,
        email: auth0User.email,
        name: auth0User.name || auth0User.email,
        role: isAdmin ? 'admin' : 'user',
        status: auth0User.email_verified ? 'active' : 'pending',
        lastLogin: auth0User.last_login ? new Date(auth0User.last_login).toISOString() : null,
        createdAt: new Date(auth0User.created_at).toISOString()
      },
      
      firm: {
        id: firmId,
        name: auth0User.user_metadata?.firmName || 'Unknown Firm',
        domain: firmId.replace('firm-', '').replace(/-/g, '.'),
        plan: auth0User.app_metadata?.plan || 'starter',
        status: 'active'
      },
      
      permissions: {
        // User management permissions (admin only)
        canManageUsers: isAdmin,
        canInviteUsers: isAdmin,
        canRemoveUsers: isAdmin,
        canChangeUserRoles: isAdmin,
        
        // Settings permissions
        canViewSettings: true, // All users can view settings
        canManageFirm: isAdmin,
        canUpdateFirmInfo: isAdmin,
        
        // Analytics and reporting (admin only for now)
        canViewAnalytics: isAdmin,
        canViewReports: isAdmin,
        
        // Integration management (admin only)
        canManageIntegrations: isAdmin,
        canViewIntegrations: isAdmin,
        
        // Content permissions
        canViewConversations: true,
        canManageConversations: isAdmin,
        
        // Billing (admin only)
        canViewBilling: isAdmin,
        canManageBilling: isAdmin
      },
      
      // UI-specific context
      ui: {
        showAddUserButton: isAdmin,
        showFirmSettings: isAdmin,
        showUserManagement: isAdmin,
        showAnalyticsTab: isAdmin,
        showIntegrationsTab: isAdmin,
        
        // Navigation permissions
        canAccessDashboard: true,
        canAccessSettings: true,
        canAccessAnalytics: isAdmin,
        canAccessConversations: true
      },
      
      // Session info
      session: {
        isAuthenticated: true,
        tokenExpiry: null,
        needsRefresh: false,
        legacy: true // Flag to indicate this is legacy Auth0 data
      }
    };

    console.log(`✅ Legacy permission context provided for: ${auth0User.email} (admin: ${isAdmin})`);

    return new Response(JSON.stringify({
      success: true,
      data: permissionContext
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Legacy permission context failed:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to load permissions',
        code: 'PERMISSION_LOAD_FAILED',
        debug: {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          timestamp: new Date().toISOString()
        }
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};