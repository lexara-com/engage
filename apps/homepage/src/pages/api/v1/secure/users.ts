/**
 * Secure User Management API
 * 
 * Database-backed user management with multi-tenant isolation.
 * All operations are scoped to the authenticated user's firm.
 */

import type { APIRoute } from 'astro';
import { withAuth, createSuccessResponse, createErrorResponse, type AuthContext } from '../../../../middleware/authMiddleware.js';
import { createDatabaseClient } from '../../../../db/client.js';
import type { CreateEntity, UpdateEntity, User } from '../../../../db/types.js';

// GET /api/v1/secure/users - List all users in the authenticated user's firm
export const GET: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm } = authContext;
  
  console.log(`📋 Listing users for firm ${firm.id} (requested by ${user.email})`);

  try {
    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Get all users for the firm - automatically scoped to the user's firm
    const users = await db.listFirmUsers(firm.id);
    
    // Filter out sensitive data and format response
    const formattedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      status: u.status,
      lastLogin: u.last_login ? new Date(u.last_login * 1000).toISOString() : null,
      createdAt: new Date(u.created_at * 1000).toISOString(),
      permissions: u.permissions
    }));
    
    // Calculate admin count for validation
    const adminCount = formattedUsers.filter(u => u.role === 'admin').length;
    
    console.log(`✅ Found ${users.length} users (${adminCount} admins) for firm ${firm.id}`);

    return createSuccessResponse({
      users: formattedUsers,
      total: formattedUsers.length,
      adminCount: adminCount,
      firmId: firm.id,
      firmName: firm.name
    });

  } catch (error) {
    console.error('❌ Failed to list firm users:', error);
    return createErrorResponse(error as Error, 500);
  }
}, { requiredPermission: 'list_users' });

// POST /api/v1/secure/users - Create a new user in the firm
export const POST: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm } = authContext;
  
  try {
    const requestData = await request.json();
    
    // Validate required fields
    const { email, role, firstName, lastName, password } = requestData;
    
    if (!email || !role) {
      return createErrorResponse(
        new Error('Email and role are required'),
        400
      );
    }

    // Validate role
    if (!['admin', 'staff'].includes(role)) {
      return createErrorResponse(
        new Error('Role must be either "admin" or "staff"'),
        400
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createErrorResponse(
        new Error('Please enter a valid email address'),
        400
      );
    }

    console.log(`📧 Creating user ${email} as ${role} in firm ${firm.id} (by ${user.email})`);

    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Check if email already exists in this firm
    const existingUser = await db.getUserByEmail(email, firm.id);
    if (existingUser) {
      return createErrorResponse(
        new Error('A user with this email already exists in your firm'),
        409
      );
    }

    // TODO: Create Auth0 user first to get auth0_id
    // For now, we'll use a placeholder
    const auth0_id = `auth0|${Date.now()}`; // This should come from Auth0

    // Create user data
    const userData: CreateEntity<User> = {
      firm_id: firm.id,
      auth0_id,
      email,
      first_name: firstName || null,
      last_name: lastName || null,
      role,
      status: 'active',
      permissions: role === 'admin' 
        ? { 'firm:admin': true, 'firm:manage_users': true, 'firm:manage_settings': true }
        : { 'firm:view_conversations': true },
      invited_by: user.id
    };

    // Create the user in database
    const newUser = await db.createUser(userData);
    
    // Log audit event
    await db.logAudit({
      user_id: user.id,
      firm_id: firm.id,
      action: 'user.created',
      target_user_id: newUser.id,
      details: { role, email },
      ip_address: request.headers.get('CF-Connecting-IP') || null,
      user_agent: request.headers.get('User-Agent') || null
    });
    
    console.log(`✅ User created: ${newUser.id} (${email})`);

    return createSuccessResponse({
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.role,
        status: newUser.status,
        createdAt: new Date(newUser.created_at * 1000).toISOString()
      },
      message: `User ${email} created successfully`,
      // TODO: Add invitation URL from Auth0
      invitationUrl: `https://www.lexara.app/invite/${newUser.id}`
    }, undefined, 201);

  } catch (error) {
    console.error('❌ Failed to create user:', error);
    return createErrorResponse(error as Error, 500);
  }
}, { requiredPermission: 'invite_user' });

// PATCH /api/v1/secure/users/:userId - Update a user
export const PATCH: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm } = authContext;
  
  try {
    // Get userId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];
    
    if (!userId || userId === 'users') {
      return createErrorResponse(
        new Error('User ID is required'),
        400
      );
    }

    const requestData = await request.json();
    const { role, firstName, lastName, status } = requestData;
    
    console.log(`🔄 Updating user ${userId} in firm ${firm.id} (by ${user.email})`);

    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Build update data
    const updateData: UpdateEntity<User> = {};
    
    if (role) {
      if (!['admin', 'staff'].includes(role)) {
        return createErrorResponse(
          new Error('Role must be either "admin" or "staff"'),
          400
        );
      }
      updateData.role = role;
      updateData.permissions = role === 'admin' 
        ? { 'firm:admin': true, 'firm:manage_users': true, 'firm:manage_settings': true }
        : { 'firm:view_conversations': true };
    }
    
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (status) updateData.status = status;

    // Update the user - this will verify firm ownership
    const updatedUser = await db.updateUser(firm.id, userId, updateData);
    
    // Log audit event
    await db.logAudit({
      user_id: user.id,
      firm_id: firm.id,
      action: 'user.updated',
      target_user_id: userId,
      details: updateData,
      ip_address: request.headers.get('CF-Connecting-IP') || null,
      user_agent: request.headers.get('User-Agent') || null
    });
    
    console.log(`✅ User updated: ${updatedUser.email}`);

    return createSuccessResponse({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        role: updatedUser.role,
        status: updatedUser.status,
        permissions: updatedUser.permissions,
        updatedAt: new Date(updatedUser.updated_at * 1000).toISOString()
      },
      message: `User ${updatedUser.email} updated successfully`
    });

  } catch (error) {
    console.error('❌ Failed to update user:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return createErrorResponse(
        new Error('User not found or access denied'),
        404
      );
    }
    
    return createErrorResponse(error as Error, 500);
  }
}, { requiredPermission: 'change_user_role' });

// DELETE /api/v1/secure/users/:userId - Remove a user from the firm
export const DELETE: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm } = authContext;
  
  try {
    // Get userId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];
    
    if (!userId || userId === 'users') {
      return createErrorResponse(
        new Error('User ID is required'),
        400
      );
    }

    // Prevent self-removal
    if (userId === user.id) {
      return createErrorResponse(
        new Error('You cannot remove your own account'),
        400
      );
    }

    console.log(`🗑️ Removing user ${userId} from firm ${firm.id} (by ${user.email})`);

    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Get user details before deletion for audit log
    const userToRemove = await db.getUser(firm.id, userId);
    if (!userToRemove) {
      return createErrorResponse(
        new Error('User not found or access denied'),
        404
      );
    }

    // Check if this is the last admin
    if (userToRemove.role === 'admin') {
      const users = await db.listFirmUsers(firm.id);
      const adminCount = users.filter(u => u.role === 'admin' && u.status === 'active').length;
      
      if (adminCount <= 1) {
        return createErrorResponse(
          new Error('Cannot remove the last admin from the firm'),
          400
        );
      }
    }

    // Delete the user - this will verify firm ownership
    const deleted = await db.deleteUser(firm.id, userId);
    
    if (!deleted) {
      return createErrorResponse(
        new Error('Failed to remove user'),
        500
      );
    }
    
    // Log audit event
    await db.logAudit({
      user_id: user.id,
      firm_id: firm.id,
      action: 'user.removed',
      target_user_id: userId,
      details: { 
        email: userToRemove.email,
        role: userToRemove.role 
      },
      ip_address: request.headers.get('CF-Connecting-IP') || null,
      user_agent: request.headers.get('User-Agent') || null
    });
    
    console.log(`✅ User removed: ${userToRemove.email}`);

    return createSuccessResponse({
      message: `User ${userToRemove.email} has been removed from the firm`
    });

  } catch (error) {
    console.error('❌ Failed to remove user:', error);
    return createErrorResponse(error as Error, 500);
  }
}, { requiredPermission: 'remove_user' });