/**
 * User Permissions API - Server-Provided Permission Context
 * 
 * Provides current user's permissions and context for UI rendering.
 * This replaces all client-side permission logic with server authority.
 */

import type { APIRoute } from 'astro';
import { withAuth, createSuccessResponse, createErrorResponse } from '../../../../middleware/authMiddleware.js';

export const GET: APIRoute = withAuth(async (request, authContext, env) => {
  const { user, firm, permissions } = authContext;
  
  console.log(`📋 Providing permission context for user: ${user.email}`);

  // Build comprehensive permission context
  const permissionContext = {
    user: {
      id: user.id,
      email: user.email,
      name: user.first_name && user.last_name 
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
      // User management permissions
      canManageUsers: permissions.canManageUsers || false,
      canInviteUsers: permissions.canManageUsers || false, // Same as manage users
      canRemoveUsers: permissions.canManageUsers || false,
      canChangeUserRoles: permissions.canManageUsers || false,
      
      // Settings permissions
      canViewSettings: permissions.canViewSettings || false,
      canManageFirm: permissions.canManageFirm || false,
      canUpdateFirmInfo: permissions.canManageFirm || false,
      
      // Analytics and reporting
      canViewAnalytics: permissions.canViewAnalytics || false,
      canViewReports: permissions.canViewAnalytics || false,
      
      // Integration management
      canManageIntegrations: permissions.canManageIntegrations || false,
      canViewIntegrations: permissions.canManageIntegrations || false,
      
      // Content permissions
      canViewConversations: true, // All users can view conversations
      canManageConversations: user.role === 'admin', // Only admins can manage
      
      // Billing (admin only for now)
      canViewBilling: user.role === 'admin',
      canManageBilling: user.role === 'admin'
    },
    
    // UI-specific context
    ui: {
      showAddUserButton: permissions.canManageUsers || false,
      showFirmSettings: permissions.canManageFirm || false,
      showUserManagement: permissions.canManageUsers || false,
      showAnalyticsTab: permissions.canViewAnalytics || false,
      showIntegrationsTab: permissions.canManageIntegrations || false,
      
      // Navigation permissions
      canAccessDashboard: true,
      canAccessSettings: permissions.canViewSettings || false,
      canAccessAnalytics: permissions.canViewAnalytics || false,
      canAccessConversations: true
    },
    
    // Session info
    session: {
      isAuthenticated: true,
      tokenExpiry: null, // TODO: Add when JWT service is integrated
      needsRefresh: false
    }
  };

  console.log(`✅ Permission context provided for user: ${user.email} (role: ${user.role})`);

  return createSuccessResponse(permissionContext);
});

// POST endpoint to check specific permission (for complex checks)
export const POST: APIRoute = withAuth(async (request, authContext, env) => {
  const { user, permissions } = authContext;
  
  try {
    const { action, resourceId } = await request.json();
    
    if (!action) {
      return createErrorResponse(new Error('Action parameter required'), 400);
    }

    console.log(`🔍 Checking specific permission: ${action} for user: ${user.email}`);

    // Map permission actions to actual permissions
    let hasPermission = false;
    
    switch (action) {
      case 'invite_user':
      case 'remove_user':
      case 'change_user_role':
      case 'list_users':
        hasPermission = permissions.canManageUsers || false;
        break;
        
      case 'view_settings':
        hasPermission = permissions.canViewSettings || false;
        break;
        
      case 'manage_firm':
      case 'update_firm_info':
        hasPermission = permissions.canManageFirm || false;
        break;
        
      case 'view_analytics':
      case 'view_reports':
        hasPermission = permissions.canViewAnalytics || false;
        break;
        
      case 'manage_integrations':
        hasPermission = permissions.canManageIntegrations || false;
        break;
        
      case 'view_conversations':
        hasPermission = true; // All users can view conversations
        break;
        
      case 'manage_conversations':
        hasPermission = user.role === 'admin';
        break;
        
      default:
        hasPermission = false;
    }

    console.log(`✅ Permission check result: ${action} = ${hasPermission}`);

    return createSuccessResponse({
      action,
      resourceId,
      allowed: hasPermission,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Permission check failed:', error);
    return createErrorResponse(error as Error, 400);
  }
});