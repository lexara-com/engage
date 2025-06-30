/**
 * Database Client for Authorization System
 * 
 * Provides a clean interface to interact with Cloudflare D1 database
 * for enterprise-grade user management.
 */

import type { 
  DatabaseClient, 
  Firm, 
  User, 
  UserSession, 
  AuditLogEntry,
  CreateEntity,
  UpdateEntity,
  DatabaseQueryResult
} from './types.js';

export class AuthorizationDatabaseClient implements DatabaseClient {
  private db: D1Database;

  constructor(database: D1Database) {
    this.db = database;
  }

  // Utility function to generate UUIDs
  private generateId(): string {
    return crypto.randomUUID();
  }

  // Utility function to get current timestamp
  private now(): number {
    return Math.floor(Date.now() / 1000);
  }

  // Utility function to safely parse JSON
  private parseJSON<T>(jsonString: string | null, defaultValue: T): T {
    if (!jsonString) return defaultValue;
    try {
      return JSON.parse(jsonString);
    } catch {
      return defaultValue;
    }
  }

  // FIRM OPERATIONS
  async createFirm(firmData: CreateEntity<Firm>): Promise<Firm> {
    const id = this.generateId();
    const now = this.now();
    
    const firm: Firm = {
      id,
      ...firmData,
      settings: firmData.settings || {},
      created_at: now,
      updated_at: now
    };

    const query = `
      INSERT INTO firms (id, name, domain, plan, settings, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.prepare(query)
      .bind(
        firm.id,
        firm.name,
        firm.domain,
        firm.plan,
        JSON.stringify(firm.settings),
        firm.status,
        firm.created_at,
        firm.updated_at
      )
      .run();

    return firm;
  }

  async getFirm(id: string): Promise<Firm | null> {
    const query = 'SELECT * FROM firms WHERE id = ?';
    const result = await this.db.prepare(query).bind(id).first();
    
    if (!result) return null;

    return {
      ...result,
      settings: this.parseJSON(result.settings as string, {})
    } as Firm;
  }

  async getFirmByDomain(domain: string): Promise<Firm | null> {
    const query = 'SELECT * FROM firms WHERE domain = ?';
    const result = await this.db.prepare(query).bind(domain).first();
    
    if (!result) return null;

    return {
      ...result,
      settings: this.parseJSON(result.settings as string, {})
    } as Firm;
  }

  async updateFirm(id: string, updates: UpdateEntity<Firm>): Promise<Firm> {
    const now = this.now();
    const setParts: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        setParts.push(`${key} = ?`);
        values.push(key === 'settings' ? JSON.stringify(value) : value);
      }
    });

    setParts.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const query = `UPDATE firms SET ${setParts.join(', ')} WHERE id = ?`;
    await this.db.prepare(query).bind(...values).run();

    const updatedFirm = await this.getFirm(id);
    if (!updatedFirm) throw new Error('Failed to retrieve updated firm');
    
    return updatedFirm;
  }

  // USER OPERATIONS
  async createUser(userData: CreateEntity<User>): Promise<User> {
    const id = this.generateId();
    const now = this.now();
    
    const user: User = {
      id,
      ...userData,
      permissions: userData.permissions || {},
      created_at: now,
      updated_at: now
    };

    const query = `
      INSERT INTO users (
        id, auth0_id, firm_id, email, first_name, last_name, 
        role, status, permissions, invited_by, last_login, 
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.prepare(query)
      .bind(
        user.id,
        user.auth0_id,
        user.firm_id,
        user.email,
        user.first_name || null,
        user.last_name || null,
        user.role,
        user.status,
        JSON.stringify(user.permissions),
        user.invited_by || null,
        user.last_login || null,
        user.created_at,
        user.updated_at
      )
      .run();

    return user;
  }

  async getUser(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = ?';
    const result = await this.db.prepare(query).bind(id).first();
    
    if (!result) return null;

    return {
      ...result,
      permissions: this.parseJSON(result.permissions as string, {})
    } as User;
  }

  async getUserByAuth0Id(auth0Id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE auth0_id = ?';
    const result = await this.db.prepare(query).bind(auth0Id).first();
    
    if (!result) return null;

    return {
      ...result,
      permissions: this.parseJSON(result.permissions as string, {})
    } as User;
  }

  async getUserByEmail(email: string, firmId: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = ? AND firm_id = ?';
    const result = await this.db.prepare(query).bind(email, firmId).first();
    
    if (!result) return null;

    return {
      ...result,
      permissions: this.parseJSON(result.permissions as string, {})
    } as User;
  }

  async updateUser(id: string, updates: UpdateEntity<User>): Promise<User> {
    const now = this.now();
    const setParts: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        setParts.push(`${key} = ?`);
        values.push(key === 'permissions' ? JSON.stringify(value) : value);
      }
    });

    setParts.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const query = `UPDATE users SET ${setParts.join(', ')} WHERE id = ?`;
    await this.db.prepare(query).bind(...values).run();

    const updatedUser = await this.getUser(id);
    if (!updatedUser) throw new Error('Failed to retrieve updated user');
    
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    const query = 'DELETE FROM users WHERE id = ?';
    await this.db.prepare(query).bind(id).run();
  }

  async listFirmUsers(firmId: string): Promise<User[]> {
    const query = 'SELECT * FROM users WHERE firm_id = ? ORDER BY created_at DESC';
    const { results } = await this.db.prepare(query).bind(firmId).all();
    
    return results.map(result => ({
      ...result,
      permissions: this.parseJSON(result.permissions as string, {})
    })) as User[];
  }

  // SESSION OPERATIONS
  async createSession(sessionData: Omit<UserSession, 'id' | 'created_at'>): Promise<UserSession> {
    const id = this.generateId();
    const now = this.now();
    
    const session: UserSession = {
      id,
      ...sessionData,
      permissions: sessionData.permissions || {},
      created_at: now
    };

    const query = `
      INSERT INTO user_sessions (
        id, user_id, token_hash, permissions, ip_address, 
        user_agent, expires_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.prepare(query)
      .bind(
        session.id,
        session.user_id,
        session.token_hash,
        JSON.stringify(session.permissions),
        session.ip_address || null,
        session.user_agent || null,
        session.expires_at,
        session.created_at
      )
      .run();

    return session;
  }

  async getSession(id: string): Promise<UserSession | null> {
    const query = 'SELECT * FROM user_sessions WHERE id = ?';
    const result = await this.db.prepare(query).bind(id).first();
    
    if (!result) return null;

    return {
      ...result,
      permissions: this.parseJSON(result.permissions as string, {})
    } as UserSession;
  }

  async getSessionByTokenHash(tokenHash: string): Promise<UserSession | null> {
    const query = 'SELECT * FROM user_sessions WHERE token_hash = ? AND expires_at > ?';
    const now = this.now();
    const result = await this.db.prepare(query).bind(tokenHash, now).first();
    
    if (!result) return null;

    return {
      ...result,
      permissions: this.parseJSON(result.permissions as string, {})
    } as UserSession;
  }

  async deleteSession(id: string): Promise<void> {
    const query = 'DELETE FROM user_sessions WHERE id = ?';
    await this.db.prepare(query).bind(id).run();
  }

  async deleteExpiredSessions(): Promise<number> {
    const now = this.now();
    const query = 'DELETE FROM user_sessions WHERE expires_at <= ?';
    const result = await this.db.prepare(query).bind(now).run();
    return result.changes || 0;
  }

  // AUDIT OPERATIONS
  async logAudit(auditData: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<AuditLogEntry> {
    const id = this.generateId();
    const now = this.now();
    
    const auditEntry: AuditLogEntry = {
      id,
      ...auditData,
      details: auditData.details || {},
      created_at: now
    };

    const query = `
      INSERT INTO audit_log (
        id, user_id, firm_id, action, target_user_id, 
        details, ip_address, user_agent, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.prepare(query)
      .bind(
        auditEntry.id,
        auditEntry.user_id || null,
        auditEntry.firm_id || null,
        auditEntry.action,
        auditEntry.target_user_id || null,
        JSON.stringify(auditEntry.details),
        auditEntry.ip_address || null,
        auditEntry.user_agent || null,
        auditEntry.created_at
      )
      .run();

    return auditEntry;
  }

  async getAuditLog(firmId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    const query = `
      SELECT * FROM audit_log 
      WHERE firm_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    const { results } = await this.db.prepare(query).bind(firmId, limit).all();
    
    return results.map(result => ({
      ...result,
      details: this.parseJSON(result.details as string, {})
    })) as AuditLogEntry[];
  }

  // UTILITY METHODS
  async runMigration(migrationSql: string): Promise<void> {
    // Split the migration SQL into individual statements
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      await this.db.prepare(statement).run();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.db.prepare('SELECT 1').first();
      return true;
    } catch {
      return false;
    }
  }
}

// Factory function to create database client
export function createDatabaseClient(database: D1Database): AuthorizationDatabaseClient {
  return new AuthorizationDatabaseClient(database);
}