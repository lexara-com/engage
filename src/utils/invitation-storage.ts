// Simple invitation storage using Cloudflare KV or in-memory for dev

export interface Invitation {
  id: string;
  firmId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  practiceAreas?: string[];
  invitedBy: string;
  invitedByName: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  acceptedAt?: string;
  expiresAt: string;
}

// In-memory storage for development
// In production, this would use Cloudflare KV or D1
const invitationsStore = new Map<string, Invitation[]>();

export class InvitationStorage {
  constructor(private env?: any) {}

  async saveInvitation(invitation: Omit<Invitation, 'id' | 'createdAt' | 'expiresAt' | 'status'>): Promise<Invitation> {
    const newInvitation: Invitation = {
      ...invitation,
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    // Get existing invitations for firm
    const firmInvitations = invitationsStore.get(invitation.firmId) || [];
    
    // Add new invitation
    firmInvitations.unshift(newInvitation);
    
    // Keep only last 50 invitations
    if (firmInvitations.length > 50) {
      firmInvitations.length = 50;
    }
    
    invitationsStore.set(invitation.firmId, firmInvitations);
    
    // In production, save to KV:
    // await this.env.INVITATIONS.put(
    //   `firm:${invitation.firmId}:invitations`,
    //   JSON.stringify(firmInvitations),
    //   { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    // );
    
    return newInvitation;
  }

  async getInvitations(firmId: string, limit: number = 10): Promise<Invitation[]> {
    // In development, get from memory
    const invitations = invitationsStore.get(firmId) || [];
    
    // In production, get from KV:
    // const stored = await this.env.INVITATIONS.get(`firm:${firmId}:invitations`);
    // const invitations = stored ? JSON.parse(stored) : [];
    
    // Update status based on expiration
    const now = new Date();
    invitations.forEach(inv => {
      if (inv.status === 'pending' && new Date(inv.expiresAt) < now) {
        inv.status = 'expired';
      }
    });
    
    return invitations.slice(0, limit);
  }

  async getInvitationById(firmId: string, invitationId: string): Promise<Invitation | null> {
    const invitations = await this.getInvitations(firmId, 50);
    return invitations.find(inv => inv.id === invitationId) || null;
  }

  async updateInvitationStatus(firmId: string, invitationId: string, status: 'accepted' | 'expired'): Promise<boolean> {
    const invitations = invitationsStore.get(firmId) || [];
    const invitation = invitations.find(inv => inv.id === invitationId);
    
    if (!invitation) return false;
    
    invitation.status = status;
    if (status === 'accepted') {
      invitation.acceptedAt = new Date().toISOString();
    }
    
    invitationsStore.set(firmId, invitations);
    
    // In production, save to KV
    
    return true;
  }

  async checkEmailExists(firmId: string, email: string): Promise<boolean> {
    const invitations = await this.getInvitations(firmId, 50);
    return invitations.some(inv => 
      inv.email.toLowerCase() === email.toLowerCase() && 
      inv.status === 'pending'
    );
  }
}

// Singleton instance
export const invitationStorage = new InvitationStorage();