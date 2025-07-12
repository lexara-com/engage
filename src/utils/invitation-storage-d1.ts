// Invitation storage using Cloudflare D1
import type { D1Database } from '@cloudflare/workers-types';

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
  personalMessage?: string;
  createdAt: string;
  acceptedAt?: string;
  expiresAt: string;
}

export class InvitationStorageD1 {
  constructor(private db: D1Database) {}

  async saveInvitation(invitation: Omit<Invitation, 'id' | 'createdAt' | 'expiresAt' | 'status'>): Promise<Invitation> {
    const id = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    
    const practiceAreasJson = invitation.practiceAreas ? JSON.stringify(invitation.practiceAreas) : null;
    
    await this.db.prepare(`
      INSERT INTO user_invitations (
        id, firm_id, email, first_name, last_name, role, 
        practice_areas, invited_by, invited_by_name, status,
        personal_message, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      invitation.firmId,
      invitation.email.toLowerCase(),
      invitation.firstName,
      invitation.lastName,
      invitation.role,
      practiceAreasJson,
      invitation.invitedBy,
      invitation.invitedByName,
      'pending',
      invitation.personalMessage || null,
      createdAt,
      expiresAt
    ).run();

    const newInvitation: Invitation = {
      ...invitation,
      id,
      status: 'pending',
      createdAt,
      expiresAt
    };

    return newInvitation;
  }

  async getInvitations(firmId: string, limit: number = 10): Promise<Invitation[]> {
    // Update expired invitations
    const now = new Date().toISOString();
    await this.db.prepare(`
      UPDATE user_invitations 
      SET status = 'expired' 
      WHERE firm_id = ? AND status = 'pending' AND expires_at < ?
    `).bind(firmId, now).run();

    // Get invitations
    const results = await this.db.prepare(`
      SELECT id, firm_id, email, first_name, last_name, role,
             practice_areas, invited_by, invited_by_name, status,
             personal_message, created_at, accepted_at, expires_at
      FROM user_invitations
      WHERE firm_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(firmId, limit).all();

    return results.results.map(row => ({
      id: row.id as string,
      firmId: row.firm_id as string,
      email: row.email as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      role: row.role as string,
      practiceAreas: row.practice_areas ? JSON.parse(row.practice_areas as string) : undefined,
      invitedBy: row.invited_by as string,
      invitedByName: row.invited_by_name as string,
      status: row.status as 'pending' | 'accepted' | 'expired',
      personalMessage: row.personal_message as string | undefined,
      createdAt: row.created_at as string,
      acceptedAt: row.accepted_at as string | undefined,
      expiresAt: row.expires_at as string
    }));
  }

  async getInvitationById(firmId: string, invitationId: string): Promise<Invitation | null> {
    const result = await this.db.prepare(`
      SELECT id, firm_id, email, first_name, last_name, role,
             practice_areas, invited_by, invited_by_name, status,
             personal_message, created_at, accepted_at, expires_at
      FROM user_invitations
      WHERE firm_id = ? AND id = ?
    `).bind(firmId, invitationId).first();

    if (!result) return null;

    return {
      id: result.id as string,
      firmId: result.firm_id as string,
      email: result.email as string,
      firstName: result.first_name as string,
      lastName: result.last_name as string,
      role: result.role as string,
      practiceAreas: result.practice_areas ? JSON.parse(result.practice_areas as string) : undefined,
      invitedBy: result.invited_by as string,
      invitedByName: result.invited_by_name as string,
      status: result.status as 'pending' | 'accepted' | 'expired',
      personalMessage: result.personal_message as string | undefined,
      createdAt: result.created_at as string,
      acceptedAt: result.accepted_at as string | undefined,
      expiresAt: result.expires_at as string
    };
  }

  async updateInvitationStatus(firmId: string, invitationId: string, status: 'accepted' | 'expired'): Promise<boolean> {
    const acceptedAt = status === 'accepted' ? new Date().toISOString() : null;
    
    const result = await this.db.prepare(`
      UPDATE user_invitations 
      SET status = ?, accepted_at = ?
      WHERE firm_id = ? AND id = ?
    `).bind(status, acceptedAt, firmId, invitationId).run();

    return result.meta.changes > 0;
  }

  async checkEmailExists(firmId: string, email: string): Promise<boolean> {
    const result = await this.db.prepare(`
      SELECT COUNT(*) as count
      FROM user_invitations
      WHERE firm_id = ? AND email = ? AND status = 'pending'
    `).bind(firmId, email.toLowerCase()).first();

    return (result?.count as number) > 0;
  }

  async deleteExpiredInvitations(firmId: string): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const result = await this.db.prepare(`
      DELETE FROM user_invitations
      WHERE firm_id = ? AND status = 'expired' AND expires_at < ?
    `).bind(firmId, thirtyDaysAgo).run();

    return result.meta.changes;
  }
}