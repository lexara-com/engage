import type { APIRoute } from 'astro';
import { InvitationStorageD1 } from '../../../../utils/invitation-storage-d1';
import { getD1Binding } from '../../../../utils/get-d1-binding';

// GET endpoint to retrieve recent invitations
export const GET: APIRoute = async (context) => {
  const { locals } = context;
  // Check authentication
  if (!locals.isAuthenticated || !locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check permissions
  const userRoles = locals.user.roles || [];
  // TEMPORARY: Allow shawnswaner email to have admin access for testing
  const isTestAdmin = locals.user.email === 'shawnswaner+test7@gmail.com';
  const canViewInvitations = isTestAdmin || userRoles.includes('FirmAdmin') || userRoles.includes('firm:admin');
  
  if (!canViewInvitations) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const firmId = locals.user.firmId;
    if (!firmId) {
      return new Response(JSON.stringify({ error: 'Firm ID not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get D1 database binding
    const db = getD1Binding(context);
    
    if (!db) {
      console.error('D1 binding not found in invitations endpoint');
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize storage and fetch invitations
    const invitationStorage = new InvitationStorageD1(db);
    const invitations = await invitationStorage.getInvitations(firmId, 10);

    return new Response(JSON.stringify({
      success: true,
      invitations: invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        firstName: inv.firstName,
        lastName: inv.lastName,
        role: inv.role,
        status: inv.status,
        createdAt: inv.createdAt,
        invitedBy: inv.invitedByName
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to fetch invitations:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch invitations'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};