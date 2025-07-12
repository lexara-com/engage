import type { APIRoute } from 'astro';
import { getAuth0Config, AUTH0_ROLES } from '../../../../auth/auth0-config';
import { InvitationStorageD1 } from '../../../../utils/invitation-storage-d1';
import { getD1Binding } from '../../../../utils/get-d1-binding';

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  // Check authentication
  if (!locals.isAuthenticated || !locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check permissions
  const userRoles = locals.user.roles || [];
  const canInviteUsers = userRoles.includes('FirmAdmin') || userRoles.includes('firm:admin') || userRoles.includes('admin');
  
  if (!canInviteUsers) {
    console.log('API Access denied for user:', locals.user.email, 'with roles:', userRoles);
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const data = await request.json();
    const { email, firstName, lastName, role, practiceAreas, message } = data;

    // Validate required fields
    if (!email || !firstName || !lastName || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate role
    const validRoles = ['firm:admin', 'firm:lawyer', 'firm:staff', 'firm:viewer'];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get firm ID from user context
    const firmId = locals.user.firmId;
    
    if (!firmId) {
      console.error('Firm ID not found for user:', locals.user.email);
      return new Response(JSON.stringify({ error: 'Firm ID not found. Please register your firm first.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get D1 database binding
    const db = getD1Binding(context);
    
    if (!db) {
      console.error('D1 binding not found');
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize storage
    const invitationStorage = new InvitationStorageD1(db);
    
    console.log('Saving invitation with firmId:', firmId);
    
    // Verify firm exists
    console.log('Checking for firm with ID:', firmId);
    const allFirms = await db.prepare('SELECT id, name FROM firms').all();
    console.log('All firms in database:', allFirms);
    
    const firmCheck = await db.prepare('SELECT id FROM firms WHERE id = ?').bind(firmId).first();
    console.log('Firm check result:', firmCheck);
    
    if (!firmCheck) {
      console.error('Firm not found in database:', firmId);
      return new Response(JSON.stringify({ error: 'Firm not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if email already has a pending invitation
    const emailExists = await invitationStorage.checkEmailExists(firmId, email);
    if (emailExists) {
      return new Response(JSON.stringify({ error: 'An invitation is already pending for this email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Save invitation to database
    const invitation = await invitationStorage.saveInvitation({
      firmId,
      email,
      firstName,
      lastName,
      role,
      practiceAreas: practiceAreas || [],
      invitedBy: locals.user.email,
      invitedByName: locals.user.name || locals.user.email,
      personalMessage: message
    });

    // TODO: Send invitation email
    // TODO: Create user in Auth0 when they accept the invitation
    
    console.log('User invitation created:', invitation);

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Invitation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to send invitation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

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
  const canViewInvitations = userRoles.includes('FirmAdmin') || userRoles.includes('firm:admin') || userRoles.includes('admin');
  
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
      console.error('D1 binding not found in GET request');
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize storage and fetch invitations
    const invitationStorage = new InvitationStorageD1(db);
    const invitations = await invitationStorage.getInvitations(firmId, 20);

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