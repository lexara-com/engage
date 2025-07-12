import type { D1Database, D1Result } from '@cloudflare/workers-types';
import type { 
  FirmUser, 
  UserAuditLog, 
  UserListFilters, 
  UserAction,
  FirmUserRole 
} from '../types/user-management';

export class UserManagementStorage {
  constructor(private db: D1Database) {}

  /**
   * Get users for a firm with filters and pagination
   */
  async getUsers(
    firmId: string, 
    filters: UserListFilters = {}, 
    page = 0, 
    pageSize = 50
  ): Promise<{ users: FirmUser[]; total: number }> {
    let query = `
      SELECT 
        id,
        firm_id as firmId,
        auth0_user_id as auth0UserId,
        email,
        name,
        role,
        is_active as isActive,
        created_at as createdAt,
        updated_at as updatedAt
      FROM firm_users
      WHERE firm_id = ?
    `;
    
    const params: any[] = [firmId];

    // Apply filters
    // Note: deleted_at column doesn't exist in remote DB, skip this filter

    if (filters.search) {
      query += ' AND (email LIKE ? OR name LIKE ?)';
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern);
    }

    if (filters.role) {
      query += ' AND role = ?';
      params.push(filters.role);
    }

    if (filters.status) {
      switch (filters.status) {
        case 'active':
          query += ' AND is_active = 1';
          break;
        case 'inactive':
          query += ' AND is_active = 0';
          break;
        case 'blocked':
          // This would need to be synced from Auth0
          query += ' AND is_active = 0';
          break;
      }
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT id, firm_id as firmId, auth0_user_id as auth0UserId, email, name, role, is_active as isActive, created_at as createdAt, updated_at as updatedAt',
      'SELECT COUNT(*) as total'
    );
    const countResult = await this.db.prepare(countQuery).bind(...params).first<{ total: number }>();
    const total = countResult?.total || 0;

    // Add pagination
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, page * pageSize);

    // Get users
    const result = await this.db.prepare(query).bind(...params).all<FirmUser>();
    
    return {
      users: result.results || [],
      total
    };
  }

  /**
   * Get a single user by ID
   */
  async getUser(firmId: string, userId: string): Promise<FirmUser | null> {
    const result = await this.db.prepare(`
      SELECT 
        id,
        firm_id as firmId,
        auth0_user_id as auth0UserId,
        email,
        name,
        role,
        is_active as isActive,
        created_at as createdAt,
        updated_at as updatedAt
      FROM firm_users
      WHERE firm_id = ? AND id = ?
    `).bind(firmId, userId).first<FirmUser>();

    return result || null;
  }

  /**
   * Get user by Auth0 ID
   */
  async getUserByAuth0Id(auth0UserId: string): Promise<FirmUser | null> {
    const result = await this.db.prepare(`
      SELECT 
        id,
        firm_id as firmId,
        auth0_user_id as auth0UserId,
        email,
        name,
        role,
        is_active as isActive,
        created_at as createdAt,
        updated_at as updatedAt
      FROM firm_users
      WHERE auth0_user_id = ?
    `).bind(auth0UserId).first<FirmUser>();

    return result || null;
  }

  /**
   * Create or update user from Auth0 data
   */
  async upsertUserFromAuth0(userData: {
    firmId: string;
    auth0UserId: string;
    email: string;
    name: string;
    role: FirmUserRole;
    isActive?: boolean;
  }): Promise<FirmUser> {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await this.db.prepare(`
      INSERT INTO firm_users (
        id, firm_id, auth0_user_id, email, name, role, is_active, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(auth0_user_id) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        role = excluded.role,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `).bind(
      id,
      userData.firmId,
      userData.auth0UserId,
      userData.email,
      userData.name,
      userData.role,
      userData.isActive ?? true,
      now,
      now
    ).run();

    const user = await this.getUserByAuth0Id(userData.auth0UserId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  /**
   * Update user role
   */
  async updateUserRole(
    firmId: string, 
    userId: string, 
    newRole: FirmUserRole
  ): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.prepare(`
      UPDATE firm_users 
      SET role = ?, updated_at = ?
      WHERE firm_id = ? AND id = ?
    `).bind(newRole, now, firmId, userId).run();
  }

  /**
   * Update user active status
   */
  async updateUserStatus(
    firmId: string, 
    userId: string, 
    isActive: boolean
  ): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.prepare(`
      UPDATE firm_users 
      SET is_active = ?, updated_at = ?
      WHERE firm_id = ? AND id = ?
    `).bind(isActive ? 1 : 0, now, firmId, userId).run();
  }

  /**
   * Soft delete a user (marks as inactive since deleted_at doesn't exist)
   */
  async softDeleteUser(
    firmId: string, 
    userId: string, 
    reason?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    
    // Since deleted_at doesn't exist, just mark as inactive
    await this.db.prepare(`
      UPDATE firm_users 
      SET is_active = 0, updated_at = ?
      WHERE firm_id = ? AND id = ?
    `).bind(now, firmId, userId).run();
  }

  /**
   * Check if user can be deleted (not last admin)
   */
  async canDeleteUser(firmId: string, userId: string): Promise<boolean> {
    // Get the user to check their role
    const user = await this.getUser(firmId, userId);
    if (!user || (user.role !== 'firm:admin' && user.role !== 'admin')) {
      return true; // Non-admins can always be deleted
    }

    // Count active admins
    const result = await this.db.prepare(`
      SELECT COUNT(*) as count
      FROM firm_users
      WHERE firm_id = ? 
        AND role IN ('firm:admin', 'admin') 
        AND is_active = 1
        AND id != ?
    `).bind(firmId, userId).first<{ count: number }>();

    return (result?.count || 0) > 0;
  }

  /**
   * Update last synced timestamp (no-op since column doesn't exist)
   */
  async updateLastSyncedAt(auth0UserId: string): Promise<void> {
    // Column doesn't exist in remote DB, skip this update
    console.log(`Would update last_synced_at for ${auth0UserId} but column doesn't exist`);
  }

  /**
   * Create audit log entry (no-op since table doesn't exist)
   */
  async createAuditLog(log: {
    firmId: string;
    userId: string;
    performedBy: string;
    action: UserAction;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    // Table doesn't exist in remote DB, skip audit logging
    console.log('Would create audit log:', log.action, 'for user:', log.userId);
  }

  /**
   * Get audit logs for a user (returns empty since table doesn't exist)
   */
  async getUserAuditLogs(
    firmId: string, 
    userId: string, 
    limit = 50
  ): Promise<UserAuditLog[]> {
    // Table doesn't exist in remote DB, return empty array
    return [];
  }

  /**
   * Get recent audit logs for a firm (returns empty since table doesn't exist)
   */
  async getRecentAuditLogs(firmId: string, limit = 20): Promise<UserAuditLog[]> {
    // Table doesn't exist in remote DB, return empty array
    return [];
  }

  /**
   * Get user statistics for a firm
   */
  async getUserStats(firmId: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    usersByRole: Record<string, number>;
  }> {
    // Get total and active users
    const statsResult = await this.db.prepare(`
      SELECT 
        COUNT(*) as totalUsers,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as activeUsers
      FROM firm_users
      WHERE firm_id = ?
    `).bind(firmId).first<{ totalUsers: number; activeUsers: number }>();

    // Get users by role
    const roleResult = await this.db.prepare(`
      SELECT role, COUNT(*) as count
      FROM firm_users
      WHERE firm_id = ?
      GROUP BY role
    `).bind(firmId).all<{ role: FirmUserRole; count: number }>();

    const usersByRole: Record<string, number> = {
      'firm:admin': 0,
      'firm:lawyer': 0,
      'firm:staff': 0,
      'firm:viewer': 0,
      'admin': 0,
      'lawyer': 0,
      'staff': 0,
      'viewer': 0,
    };

    (roleResult.results || []).forEach(row => {
      usersByRole[row.role] = row.count;
    });

    return {
      totalUsers: statsResult?.totalUsers || 0,
      activeUsers: statsResult?.activeUsers || 0,
      usersByRole,
    };
  }
}