import type { APIContext } from 'astro';
import { Auth0ManagementClient, createAuth0ManagementClient } from '../utils/auth0-management-client';
import { UserManagementStorage } from '../utils/user-management-storage';
import { getD1Binding } from '../utils/get-d1-binding';
import type { 
  FirmUser,
  UserListFilters,
  UserListResponse,
  CreateUserRequest,
  UpdateUserRequest,
  UserDetailResponse,
  PasswordResetResponse,
  FirmUserRole,
  UserStats
} from '../types/user-management';

export class UserManagementService {
  private auth0Client: Auth0ManagementClient;
  private storage: UserManagementStorage;

  constructor(
    private context: APIContext,
    private currentUser: { id: string; email: string; firmId: string }
  ) {
    // Initialize Auth0 client
    this.auth0Client = createAuth0ManagementClient(context);

    // Initialize storage
    const db = getD1Binding(context);
    if (!db) {
      throw new Error('D1 database not available');
    }
    this.storage = new UserManagementStorage(db);
  }

  /**
   * Get paginated list of users with filters
   */
  async listUsers(
    filters: UserListFilters = {},
    page = 0,
    pageSize = 50
  ): Promise<UserListResponse> {
    const { users, total } = await this.storage.getUsers(
      this.currentUser.firmId,
      filters,
      page,
      pageSize
    );

    // Sync with Auth0 data if needed
    await this.syncUsersWithAuth0(users);

    return {
      users,
      total,
      page,
      pageSize,
      hasMore: (page + 1) * pageSize < total,
    };
  }

  /**
   * Get detailed user information
   */
  async getUserDetail(userId: string): Promise<UserDetailResponse> {
    const user = await this.storage.getUser(this.currentUser.firmId, userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Sync with Auth0
    await this.syncUserWithAuth0(user);

    // Get audit logs
    const auditLogs = await this.storage.getUserAuditLogs(
      this.currentUser.firmId,
      userId
    );

    // Get permissions based on role
    const permissions = this.getPermissionsForRole(user.role);

    return {
      user,
      auditLogs,
      permissions,
    };
  }

  /**
   * Create a new user (from accepted invitation)
   */
  async createUser(request: CreateUserRequest & { invitationId: string }): Promise<FirmUser> {
    try {
      // Create user in Auth0
      const auth0User = await this.auth0Client.createUser({
        email: request.email,
        given_name: request.firstName,
        family_name: request.lastName,
        name: `${request.firstName} ${request.lastName}`,
        connection: 'Username-Password-Authentication',
        verify_email: true,
        app_metadata: {
          firmId: this.currentUser.firmId,
          role: request.role,
          userType: 'firm_user',
        },
        user_metadata: {
          invitedBy: this.currentUser.email,
          invitationId: request.invitationId,
        },
      });

      // Create password reset ticket
      const resetTicket = await this.auth0Client.createPasswordResetTicket(
        auth0User.user_id
      );

      // Store in database
      const user = await this.storage.upsertUserFromAuth0({
        firmId: this.currentUser.firmId,
        auth0UserId: auth0User.user_id,
        email: auth0User.email,
        name: auth0User.name || `${request.firstName} ${request.lastName}`,
        role: request.role,
        isActive: true,
      });

      // Create audit log
      await this.storage.createAuditLog({
        firmId: this.currentUser.firmId,
        userId: user.id,
        performedBy: this.currentUser.id,
        action: 'created',
        details: {
          invitationId: request.invitationId,
          resetTicketUrl: resetTicket.ticket,
        },
        ipAddress: this.getClientIP(),
        userAgent: this.getUserAgent(),
      });

      // TODO: Send welcome email with password reset link

      return user;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw new Error('Failed to create user account');
    }
  }

  /**
   * Update user information
   */
  async updateUser(userId: string, updates: UpdateUserRequest): Promise<FirmUser> {
    const user = await this.storage.getUser(this.currentUser.firmId, userId);
    if (!user) {
      throw new Error('User not found');
    }

    const changes: Record<string, any> = {};

    // Update role if changed
    if (updates.role && updates.role !== user.role) {
      // Check if trying to demote last admin
      if (user.role === 'firm:admin' && updates.role !== 'firm:admin') {
        const canDemote = await this.storage.canDeleteUser(this.currentUser.firmId, userId);
        if (!canDemote) {
          throw new Error('Cannot demote the last administrator');
        }
      }

      await this.storage.updateUserRole(this.currentUser.firmId, userId, updates.role);
      changes.role = { from: user.role, to: updates.role };

      // Update in Auth0
      await this.auth0Client.updateUser(user.auth0UserId, {
        app_metadata: {
          role: updates.role,
        },
      });
    }

    // Update active status if changed
    if (updates.isActive !== undefined && updates.isActive !== user.isActive) {
      await this.storage.updateUserStatus(this.currentUser.firmId, userId, updates.isActive);
      changes.isActive = { from: user.isActive, to: updates.isActive };

      // Block/unblock in Auth0
      if (updates.isActive) {
        await this.auth0Client.unblockUser(user.auth0UserId);
      } else {
        await this.auth0Client.blockUser(user.auth0UserId);
      }
    }

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await this.storage.createAuditLog({
        firmId: this.currentUser.firmId,
        userId: user.id,
        performedBy: this.currentUser.id,
        action: 'updated',
        details: changes,
        ipAddress: this.getClientIP(),
        userAgent: this.getUserAgent(),
      });
    }

    // Return updated user
    const updatedUser = await this.storage.getUser(this.currentUser.firmId, userId);
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }

    return updatedUser;
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string, reason?: string): Promise<void> {
    const user = await this.storage.getUser(this.currentUser.firmId, userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if can delete
    const canDelete = await this.storage.canDeleteUser(this.currentUser.firmId, userId);
    if (!canDelete) {
      throw new Error('Cannot delete the last administrator');
    }

    // Soft delete in database
    await this.storage.softDeleteUser(this.currentUser.firmId, userId, reason);

    // Delete from Auth0
    await this.auth0Client.deleteUser(user.auth0UserId);

    // Create audit log
    await this.storage.createAuditLog({
      firmId: this.currentUser.firmId,
      userId: user.id,
      performedBy: this.currentUser.id,
      action: 'deleted',
      details: { reason },
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent(),
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(userId: string): Promise<PasswordResetResponse> {
    const user = await this.storage.getUser(this.currentUser.firmId, userId);
    if (!user) {
      throw new Error('User not found');
    }

    try {
      const resetTicket = await this.auth0Client.createPasswordResetTicket(
        user.auth0UserId,
        `${this.context.url.origin}/auth/password-reset-success`
      );

      // Create audit log
      await this.storage.createAuditLog({
        firmId: this.currentUser.firmId,
        userId: user.id,
        performedBy: this.currentUser.id,
        action: 'password_reset',
        ipAddress: this.getClientIP(),
        userAgent: this.getUserAgent(),
      });

      // TODO: Send email with reset link

      return {
        success: true,
        message: 'Password reset email sent successfully',
        ticketUrl: resetTicket.ticket,
      };
    } catch (error) {
      console.error('Failed to send password reset:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    const stats = await this.storage.getUserStats(this.currentUser.firmId);
    const recentActivity = await this.storage.getRecentAuditLogs(this.currentUser.firmId, 10);

    return {
      ...stats,
      blockedUsers: 0, // TODO: Sync from Auth0
      recentActivity,
    };
  }

  /**
   * Sync users with Auth0 data
   */
  private async syncUsersWithAuth0(users: FirmUser[]): Promise<void> {
    // Batch sync to avoid too many API calls
    // In production, this would be done via webhooks or scheduled jobs
    for (const user of users.slice(0, 5)) {
      // Only sync first 5 to avoid rate limits
      if (this.shouldSyncUser(user)) {
        await this.syncUserWithAuth0(user);
      }
    }
  }

  /**
   * Sync single user with Auth0
   */
  private async syncUserWithAuth0(user: FirmUser): Promise<void> {
    try {
      const auth0User = await this.auth0Client.getUser(user.auth0UserId);
      
      // Update local data if changed
      if (
        auth0User.email !== user.email ||
        auth0User.name !== user.name ||
        auth0User.blocked !== !user.isActive
      ) {
        await this.storage.upsertUserFromAuth0({
          firmId: user.firmId,
          auth0UserId: auth0User.user_id,
          email: auth0User.email,
          name: auth0User.name || user.name,
          role: user.role,
          isActive: !auth0User.blocked,
        });
      }

      await this.storage.updateLastSyncedAt(user.auth0UserId);
    } catch (error) {
      console.error(`Failed to sync user ${user.id}:`, error);
    }
  }

  /**
   * Check if user should be synced
   */
  private shouldSyncUser(user: FirmUser): boolean {
    if (!user.lastSyncedAt) return true;
    
    const lastSync = new Date(user.lastSyncedAt).getTime();
    const hourAgo = Date.now() - (60 * 60 * 1000);
    
    return lastSync < hourAgo;
  }

  /**
   * Get permissions for role
   */
  private getPermissionsForRole(role: FirmUserRole): string[] {
    const permissions: Record<FirmUserRole, string[]> = {
      'firm:admin': [
        'users.create',
        'users.read',
        'users.update',
        'users.delete',
        'settings.manage',
        'analytics.view',
        'conversations.manage',
        'billing.manage',
      ],
      'firm:lawyer': [
        'users.read',
        'analytics.view',
        'conversations.view',
        'conversations.manage_own',
      ],
      'firm:staff': [
        'users.read',
        'conversations.view',
        'conversations.create',
      ],
      'firm:viewer': [
        'users.read',
        'conversations.view',
      ],
    };

    return permissions[role] || [];
  }

  /**
   * Get client IP address
   */
  private getClientIP(): string {
    return this.context.clientAddress || 'unknown';
  }

  /**
   * Get user agent
   */
  private getUserAgent(): string {
    return this.context.request.headers.get('user-agent') || 'unknown';
  }
}