/**
 * Secure Firm Management API
 * 
 * Database-backed firm management with proper authorization.
 */

import type { APIRoute } from 'astro';
import { withAuth, createSuccessResponse, createErrorResponse, type AuthContext } from '../../../../middleware/authMiddleware.js';
import { createDatabaseClient } from '../../../../db/client.js';
import type { UpdateEntity, Firm } from '../../../../db/types.js';

// GET /api/v1/secure/firm - Get firm details
export const GET: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm } = authContext;
  
  console.log(`🏢 Getting firm details for ${firm.id} (requested by ${user.email})`);

  try {
    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Get fresh firm data
    const firmData = await db.getFirm(firm.id);
    
    if (!firmData) {
      return createErrorResponse(
        new Error('Firm not found'),
        404
      );
    }

    // Get user count for the firm
    const users = await db.listFirmUsers(firm.id);
    const userCount = users.length;
    const adminCount = users.filter(u => u.role === 'admin' && u.status === 'active').length;

    // Format firm data
    const formattedFirm = {
      id: firmData.id,
      name: firmData.name,
      domain: firmData.domain,
      plan: firmData.plan,
      status: firmData.status,
      settings: firmData.settings || {},
      createdAt: new Date(firmData.created_at * 1000).toISOString(),
      updatedAt: new Date(firmData.updated_at * 1000).toISOString(),
      stats: {
        userCount,
        adminCount,
        activeUsers: users.filter(u => u.status === 'active').length
      }
    };
    
    console.log(`✅ Firm details retrieved: ${firmData.name}`);

    return createSuccessResponse({
      firm: formattedFirm
    });

  } catch (error) {
    console.error('❌ Failed to get firm details:', error);
    return createErrorResponse(error as Error, 500);
  }
}, { requiredPermission: 'view_settings' });

// PATCH /api/v1/secure/firm - Update firm settings
export const PATCH: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm } = authContext;
  
  try {
    const requestData = await request.json();
    const { name, domain, settings } = requestData;
    
    console.log(`🔄 Updating firm ${firm.id} settings (by ${user.email})`);

    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Build update data
    const updateData: UpdateEntity<Firm> = {};
    
    if (name) {
      if (name.length < 2 || name.length > 100) {
        return createErrorResponse(
          new Error('Firm name must be between 2 and 100 characters'),
          400
        );
      }
      updateData.name = name;
    }
    
    if (domain) {
      // Validate domain format
      const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
      if (!domainRegex.test(domain)) {
        return createErrorResponse(
          new Error('Please enter a valid domain name'),
          400
        );
      }
      
      // Check if domain is already taken
      const existingFirm = await db.getFirmByDomain(domain);
      if (existingFirm && existingFirm.id !== firm.id) {
        return createErrorResponse(
          new Error('This domain is already registered to another firm'),
          409
        );
      }
      
      updateData.domain = domain;
    }
    
    if (settings) {
      // Merge with existing settings
      const currentFirm = await db.getFirm(firm.id);
      updateData.settings = {
        ...(currentFirm?.settings || {}),
        ...settings
      };
    }

    // Update the firm
    const updatedFirm = await db.updateFirm(firm.id, updateData);
    
    // Log audit event
    await db.logAudit({
      user_id: user.id,
      firm_id: firm.id,
      action: 'firm.updated',
      details: updateData,
      ip_address: request.headers.get('CF-Connecting-IP') || null,
      user_agent: request.headers.get('User-Agent') || null
    });
    
    console.log(`✅ Firm updated: ${updatedFirm.name}`);

    return createSuccessResponse({
      firm: {
        id: updatedFirm.id,
        name: updatedFirm.name,
        domain: updatedFirm.domain,
        plan: updatedFirm.plan,
        status: updatedFirm.status,
        settings: updatedFirm.settings,
        updatedAt: new Date(updatedFirm.updated_at * 1000).toISOString()
      },
      message: 'Firm settings updated successfully'
    });

  } catch (error) {
    console.error('❌ Failed to update firm:', error);
    return createErrorResponse(error as Error, 500);
  }
}, { requiredPermission: 'manage_firm' });

// GET /api/v1/secure/firm/audit-log - Get firm audit log
export const GET_AUDIT: APIRoute = withAuth(async (request, authContext: AuthContext, env) => {
  const { user, firm } = authContext;
  
  console.log(`📋 Getting audit log for firm ${firm.id} (requested by ${user.email})`);

  try {
    // Get limit from query params
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return createErrorResponse(
        new Error('Limit must be between 1 and 1000'),
        400
      );
    }

    // Initialize database client
    const db = createDatabaseClient(env.DB);
    
    // Get audit log entries
    const auditLog = await db.getAuditLog(firm.id, limit);
    
    // Format audit log entries
    const formattedEntries = auditLog.map(entry => ({
      id: entry.id,
      action: entry.action,
      userId: entry.user_id,
      targetUserId: entry.target_user_id,
      details: entry.details,
      ipAddress: entry.ip_address,
      userAgent: entry.user_agent,
      timestamp: new Date(entry.created_at * 1000).toISOString()
    }));
    
    console.log(`✅ Retrieved ${auditLog.length} audit log entries`);

    return createSuccessResponse({
      entries: formattedEntries,
      total: formattedEntries.length,
      limit
    });

  } catch (error) {
    console.error('❌ Failed to get audit log:', error);
    return createErrorResponse(error as Error, 500);
  }
}, { requiredPermission: 'manage_firm' });