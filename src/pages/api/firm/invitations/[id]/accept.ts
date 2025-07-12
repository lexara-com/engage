import type { APIRoute } from 'astro';
import { InvitationStorageD1 } from '../../../../../utils/invitation-storage-d1';
import { UserManagementService } from '../../../../../services/user-management-service';
import { getD1Binding } from '../../../../../utils/get-d1-binding';

/**
 * POST /api/firm/invitations/[id]/accept - Accept an invitation and create user
 */
export const POST: APIRoute = async (context) => {
  const { params, request } = context;
  const invitationId = params.id;

  if (!invitationId) {
    return new Response(JSON.stringify({ error: 'Invitation ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get invitation code from body
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return new Response(JSON.stringify({ error: 'Invitation code required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get D1 database
    const db = getD1Binding(context);
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get invitation
    const invitationStorage = new InvitationStorageD1(db);
    const invitation = await invitationStorage.getInvitation(invitationId);

    if (!invitation) {
      return new Response(JSON.stringify({ error: 'Invitation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify invitation code matches ID
    if (invitation.id !== code) {
      return new Response(JSON.stringify({ error: 'Invalid invitation code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if already accepted
    if (invitation.status === 'accepted') {
      return new Response(JSON.stringify({ error: 'Invitation already accepted' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if expired
    if (invitation.status === 'expired' || new Date(invitation.expiresAt) < new Date()) {
      return new Response(JSON.stringify({ error: 'Invitation has expired' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create user management service
    // For invitation acceptance, we use the inviter as the current user
    const service = new UserManagementService(context, {
      id: 'system', // System action
      email: invitation.invitedBy,
      firmId: invitation.firmId,
    });

    // Create user from invitation
    const [firstName, ...lastNameParts] = invitation.firstName.split(' ');
    const lastName = invitation.lastName || lastNameParts.join(' ');

    const user = await service.createUser({
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: lastName,
      role: invitation.role,
      invitationId: invitation.id,
      sendInvitation: false, // Don't send another invitation
    });

    // Mark invitation as accepted
    await invitationStorage.acceptInvitation(invitation.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Invitation accepted successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      // TODO: Return password reset URL or redirect URL
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to accept invitation:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to accept invitation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};