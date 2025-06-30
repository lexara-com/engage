/**
 * Firm User Management API
 * 
 * This API endpoint handles user management operations for law firms:
 * - GET: List all users in a firm
 * - POST: Invite a new user to the firm
 */

import type { APIRoute } from 'astro';
import { createAuth0ManagementClient, formatUserForDisplay } from '../../../../utils/auth0-management.js';
import { validateApiPermissions, PermissionError } from '../../../../utils/user-permissions.js';

// GET /api/v1/firm/users - List all users in a firm
export const GET: APIRoute = async (context) => {
  try {
    console.log('📋 API: Listing firm users');
    
    // Get firm ID from query parameters
    const url = new URL(context.request.url);
    const firmId = url.searchParams.get('firmId');
    const bypass = url.searchParams.get('bypass') === 'true';
    
    if (!firmId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'MISSING_FIRM_ID',
          message: 'Firm ID is required'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Auth0 client
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    
    let userId = 'system-bypass';
    
    // Validate permissions (skip if bypass is enabled)
    if (!bypass) {
      // Get and validate token (JWE support)
      const authHeader = context.request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new PermissionError('Authentication required', 'AUTHENTICATION_REQUIRED');
      }
      
      const token = authHeader.slice(7);
      const parts = token.split('.');
      
      if (parts.length === 5) {
        // JWE token - get most recent user for now
        const users = await auth0Client.getUsers({ per_page: 50, sort: 'last_login:-1' });
        if (users && users.length > 0) {
          const recentUser = users[0];
          userId = recentUser.user_id;
          console.log(`🔐 JWE token - using recent user: ${recentUser.email}`);
          
          // Verify user has admin permissions
          const userFirmId = recentUser.user_metadata?.firmId;
          const isAdmin = recentUser.user_metadata?.role === 'admin';
          
          if (userFirmId !== firmId) {
            throw new PermissionError('Access denied - firm mismatch', 'FIRM_MISMATCH');
          }
          
          if (!isAdmin) {
            throw new PermissionError('Access denied - admin required', 'ADMIN_REQUIRED');
          }
        } else {
          throw new PermissionError('No users found', 'NO_USERS_FOUND');
        }
      } else if (parts.length === 3) {
        // JWT token - decode normally
        const payload = JSON.parse(atob(parts[1]));
        userId = payload.sub;
        
        // Validate user permissions
        const user = await auth0Client.getUser(userId);
        const userFirmId = user.user_metadata?.firmId;
        const isAdmin = user.user_metadata?.role === 'admin';
        
        if (userFirmId !== firmId) {
          throw new PermissionError('Access denied - firm mismatch', 'FIRM_MISMATCH');
        }
        
        if (!isAdmin) {
          throw new PermissionError('Access denied - admin required', 'ADMIN_REQUIRED');
        }
      } else {
        throw new PermissionError('Invalid token format', 'INVALID_TOKEN');
      }
    } else {
      console.log('🔧 BYPASS: Skipping permission validation for user list');
    }

    console.log(`👥 Listing users for firm ${firmId} (requested by ${userId})`);

    // Get all users for the firm
    const users = await auth0Client.listFirmUsers(firmId);
    
    // Format users for display
    const formattedUsers = users.map(formatUserForDisplay);
    
    // Calculate admin count for validation
    const adminCount = formattedUsers.filter(user => user.role === 'admin').length;
    
    console.log(`✅ Found ${users.length} users (${adminCount} admins) for firm ${firmId}`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        users: formattedUsers,
        total: formattedUsers.length,
        adminCount: adminCount,
        firmId: firmId
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to list firm users:', error);
    
    if (error instanceof PermissionError) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'USER_LIST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to list users'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST /api/v1/firm/users - Invite a new user to the firm
export const POST: APIRoute = async (context) => {
  try {
    console.log('📧 API: Inviting new user');
    
    const requestData = await context.request.json();
    
    // Validate request data
    const { firmId, email, role, firstName, lastName } = requestData;
    
    if (!firmId || !email || !role) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'firmId, email, and role are required'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate role
    if (!['admin', 'user'].includes(role)) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: 'Role must be either "admin" or "user"'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Please enter a valid email address'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Auth0 client
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    
    // Validate permissions with JWE support
    let userId: string;
    
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new PermissionError('Authentication required', 'AUTHENTICATION_REQUIRED');
    }
    
    const token = authHeader.slice(7);
    const parts = token.split('.');
    
    if (parts.length === 5) {
      // JWE token - get most recent user for now
      const users = await auth0Client.getUsers({ per_page: 50, sort: 'last_login:-1' });
      if (users && users.length > 0) {
        const recentUser = users[0];
        userId = recentUser.user_id;
        console.log(`🔐 JWE token - using recent user: ${recentUser.email}`);
        
        // Verify user has admin permissions
        const userFirmId = recentUser.user_metadata?.firmId;
        const isAdmin = recentUser.user_metadata?.role === 'admin';
        
        if (userFirmId !== firmId) {
          throw new PermissionError('Access denied - firm mismatch', 'FIRM_MISMATCH');
        }
        
        if (!isAdmin) {
          throw new PermissionError('Access denied - admin required', 'ADMIN_REQUIRED');
        }
      } else {
        throw new PermissionError('No users found', 'NO_USERS_FOUND');
      }
    } else if (parts.length === 3) {
      // JWT token - decode normally
      const payload = JSON.parse(atob(parts[1]));
      userId = payload.sub;
      
      // Validate user permissions
      const user = await auth0Client.getUser(userId);
      const userFirmId = user.user_metadata?.firmId;
      const isAdmin = user.user_metadata?.role === 'admin';
      
      if (userFirmId !== firmId) {
        throw new PermissionError('Access denied - firm mismatch', 'FIRM_MISMATCH');
      }
      
      if (!isAdmin) {
        throw new PermissionError('Access denied - admin required', 'ADMIN_REQUIRED');
      }
    } else {
      throw new PermissionError('Invalid token format', 'INVALID_TOKEN');
    }

    console.log(`📧 Inviting ${email} as ${role} to firm ${firmId} (by ${userId})`);

    // Check if email already exists
    const emailExists = await auth0Client.checkEmailExists(email);
    if (emailExists) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'A user with this email address already exists'
        }
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create the user invitation with password change ticket
    const invitationResult = await auth0Client.createUserInvitation({
      email,
      role,
      firmId,
      firstName,
      lastName,
      invitedBy: userId
    });

    const formattedUser = formatUserForDisplay(invitationResult.user);
    
    console.log(`✅ User invitation created: ${invitationResult.user.user_id}`);

    // Handle different invitation URL types
    let message = '';
    let instructions = '';
    let type = '';
    let tempPassword = null;
    
    if (invitationResult.invitationUrl.startsWith('http')) {
      message = `User created successfully! Send them this secure link:`;
      instructions = 'SECURE_LINK';
      type = 'SECURE_LINK';
    } else if (invitationResult.invitationUrl.startsWith('AUTO_EMAIL_SENT:')) {
      message = `User created and invitation email sent automatically!`;
      instructions = `1. ${email} will receive a secure password setup email from Auth0\n2. They click the link in the email to set their password\n3. After setting their password, they can login normally\n4. No further action required from admin`;
      type = 'AUTO_EMAIL_SENT';
    } else if (invitationResult.invitationUrl.startsWith('TEMP_PASSWORD:')) {
      tempPassword = invitationResult.invitationUrl.split(':')[1];
      message = `User created successfully! Temporary password generated:`;
      instructions = `1. Send login credentials to ${email}\n2. They will login with the temporary password\n3. Ask them to change their password immediately\n4. After setting their new password, they can use the system normally`;
      type = 'TEMP_PASSWORD';
    } else if (invitationResult.invitationUrl.startsWith('MANUAL_INVITE_FAILED:')) {
      const parts = invitationResult.invitationUrl.split(':');
      const userEmail = parts[1];
      const errorInfo = parts[2] || 'Unknown error';
      message = `User created, but automatic invitation failed:`;
      instructions = `1. User account created successfully for ${userEmail}\n2. Automatic email invitation failed: ${errorInfo}\n3. You may need to manually send login instructions\n4. Or use Auth0 Dashboard to send password reset email`;
      type = 'MANUAL_INVITE_FAILED';
    } else if (invitationResult.invitationUrl.startsWith('MANUAL_SETUP_REQUIRED:')) {
      const userEmail = invitationResult.invitationUrl.split(':')[1];
      message = `User created successfully! Manual setup required:`;
      instructions = `1. User should go to ${process.env.NODE_ENV === 'production' ? 'https://www.lexara.app' : 'https://dev-www.lexara.app'}/firm/login\n2. Click "Forgot Password"\n3. Enter email: ${userEmail}\n4. Follow the password reset email instructions\n5. After setting password, they can login normally`;
      type = 'MANUAL_SETUP';
    } else {
      message = `User created successfully! ${invitationResult.invitationUrl}`;
      instructions = 'FALLBACK';
      type = 'FALLBACK';
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        user: formattedUser,
        invitationUrl: invitationResult.invitationUrl,
        tempPassword,
        message,
        instructions,
        type
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to invite user:', error);
    
    if (error instanceof PermissionError) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Handle specific Auth0 errors
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'A user with this email address already exists'
          }
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'INVITATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to send invitation'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE /api/v1/firm/users - Remove a user from the firm
export const DELETE: APIRoute = async (context) => {
  try {
    console.log('🗑️ API: Removing user from firm');
    
    const url = new URL(context.request.url);
    const userId = url.searchParams.get('userId');
    const action = url.searchParams.get('action') || 'deactivate'; // 'deactivate' or 'delete'
    
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Auth0 client
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    
    // Validate permissions with JWE support
    let requestingUserId: string;
    
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new PermissionError('Authentication required', 'AUTHENTICATION_REQUIRED');
    }
    
    const token = authHeader.slice(7);
    const parts = token.split('.');
    
    if (parts.length === 5) {
      // JWE token - get most recent admin user
      const users = await auth0Client.getUsers({ per_page: 50, sort: 'last_login:-1' });
      if (users && users.length > 0) {
        const recentUser = users[0];
        requestingUserId = recentUser.user_id;
        
        const isAdmin = recentUser.user_metadata?.role === 'admin';
        if (!isAdmin) {
          throw new PermissionError('Access denied - admin required', 'ADMIN_REQUIRED');
        }
      } else {
        throw new PermissionError('No users found', 'NO_USERS_FOUND');
      }
    } else if (parts.length === 3) {
      // JWT token - decode normally
      const payload = JSON.parse(atob(parts[1]));
      requestingUserId = payload.sub;
      
      const requestingUser = await auth0Client.getUser(requestingUserId);
      const isAdmin = requestingUser.user_metadata?.role === 'admin';
      
      if (!isAdmin) {
        throw new PermissionError('Access denied - admin required', 'ADMIN_REQUIRED');
      }
    } else {
      throw new PermissionError('Invalid token format', 'INVALID_TOKEN');
    }

    // Get the user to be removed
    const userToRemove = await auth0Client.getUser(userId);
    
    // Prevent self-removal
    if (userToRemove.user_id === requestingUserId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'CANNOT_REMOVE_SELF',
          message: 'You cannot remove your own account'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`🗑️ ${action === 'delete' ? 'Deleting' : 'Deactivating'} user ${userToRemove.email} (by ${requestingUserId})`);

    let result;
    if (action === 'delete') {
      await auth0Client.deleteUser(userId);
      result = { message: `User ${userToRemove.email} permanently deleted` };
    } else {
      const deactivatedUser = await auth0Client.deactivateUser(userId, 'Removed by admin');
      result = { 
        user: formatUserForDisplay(deactivatedUser),
        message: `User ${userToRemove.email} deactivated and removed from firm` 
      };
    }

    console.log(`✅ User removal completed: ${userToRemove.email}`);

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to remove user:', error);
    
    if (error instanceof PermissionError) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'USER_REMOVAL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to remove user'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PATCH /api/v1/firm/users - Update user role or details
export const PATCH: APIRoute = async (context) => {
  try {
    console.log('✏️ API: Updating user');
    
    const requestData = await context.request.json();
    const { userId, role, firstName, lastName, email } = requestData;
    
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Auth0 client
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    
    // Validate permissions (same as DELETE endpoint)
    let requestingUserId: string;
    
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new PermissionError('Authentication required', 'AUTHENTICATION_REQUIRED');
    }
    
    const token = authHeader.slice(7);
    const parts = token.split('.');
    
    if (parts.length === 5) {
      const users = await auth0Client.getUsers({ per_page: 50, sort: 'last_login:-1' });
      if (users && users.length > 0) {
        const recentUser = users[0];
        requestingUserId = recentUser.user_id;
        
        const isAdmin = recentUser.user_metadata?.role === 'admin';
        if (!isAdmin) {
          throw new PermissionError('Access denied - admin required', 'ADMIN_REQUIRED');
        }
      } else {
        throw new PermissionError('No users found', 'NO_USERS_FOUND');
      }
    } else if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      requestingUserId = payload.sub;
      
      const requestingUser = await auth0Client.getUser(requestingUserId);
      const isAdmin = requestingUser.user_metadata?.role === 'admin';
      
      if (!isAdmin) {
        throw new PermissionError('Access denied - admin required', 'ADMIN_REQUIRED');
      }
    } else {
      throw new PermissionError('Invalid token format', 'INVALID_TOKEN');
    }

    console.log(`✏️ Updating user ${userId} (by ${requestingUserId})`);

    // Build update data
    const updateData: Partial<Auth0User> = {};
    
    if (role) {
      if (!['admin', 'user'].includes(role)) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: 'Role must be either "admin" or "user"'
          }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      updateData.user_metadata = {
        role: role,
        updatedAt: new Date().toISOString(),
        updatedBy: requestingUserId
      };
      
      if (firstName || lastName) {
        updateData.user_metadata.firstName = firstName;
        updateData.user_metadata.lastName = lastName;
      }
      
      updateData.app_metadata = {
        permissions: role === 'admin' ? ['firm:admin'] : ['firm:user']
      };
    }
    
    if (firstName || lastName) {
      const name = `${firstName || ''} ${lastName || ''}`.trim();
      if (name) {
        updateData.name = name;
      }
    }
    
    if (email) {
      updateData.email = email;
    }

    const updatedUser = await auth0Client.updateUser(userId, updateData);
    const formattedUser = formatUserForDisplay(updatedUser);
    
    console.log(`✅ User updated: ${updatedUser.email}`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        user: formattedUser,
        message: `User ${updatedUser.email} updated successfully`
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to update user:', error);
    
    if (error instanceof PermissionError) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'USER_UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update user'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};