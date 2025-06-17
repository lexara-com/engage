// Platform Audit Log Durable Object - Permanent audit trail storage
// Security: Immutable audit logs for compliance and security monitoring

import { PlatformAuditLog as PlatformAuditLogData } from '../audit/platform-audit-logger';
import { Env } from '@/types/shared';

interface AuditLogState {
  logs: PlatformAuditLogData[];
  totalCount: number;
  createdAt: Date;
  lastUpdated: Date;
}

export class PlatformAuditLog {
  private state: DurableObjectState;
  private env: Env;
  private auditState: AuditLogState | null = null;
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    try {
      switch (url.pathname) {
        case '/store':
          return this.handleStoreLog(request);
        case '/query':
          return this.handleQueryLogs(request);
        case '/stats':
          return this.handleGetStats();
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: (error as Error).message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  private async handleStoreLog(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    
    const logEntry: PlatformAuditLogData = await request.json();
    
    // Validate log entry
    if (!logEntry.logId || !logEntry.action || !logEntry.timestamp) {
      return new Response('Invalid audit log entry', { status: 400 });
    }
    
    // Load current state
    await this.loadAuditState();
    
    // Add log entry (immutable - never modify existing logs)
    this.auditState!.logs.push({
      ...logEntry,
      timestamp: new Date(logEntry.timestamp)
    });
    
    this.auditState!.totalCount++;
    this.auditState!.lastUpdated = new Date();
    
    // Persist to storage
    await this.persistAuditState();
    
    // Log storage for monitoring
    console.log(`Audit log stored: ${logEntry.logId} - ${logEntry.action} by ${logEntry.platformUserEmail}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      logId: logEntry.logId 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private async handleQueryLogs(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    
    const query = await request.json();
    
    // Load current state
    await this.loadAuditState();
    
    let filteredLogs = this.auditState!.logs;
    
    // Apply filters
    if (query.action) {
      filteredLogs = filteredLogs.filter(log => log.action === query.action);
    }
    
    if (query.platformUserId) {
      filteredLogs = filteredLogs.filter(log => log.platformUserId === query.platformUserId);
    }
    
    if (query.targetId) {
      filteredLogs = filteredLogs.filter(log => log.targetId === query.targetId);
    }
    
    if (query.riskLevel) {
      filteredLogs = filteredLogs.filter(log => log.riskLevel === query.riskLevel);
    }
    
    if (query.dateFrom) {
      const fromDate = new Date(query.dateFrom);
      filteredLogs = filteredLogs.filter(log => log.timestamp >= fromDate);
    }
    
    if (query.dateTo) {
      const toDate = new Date(query.dateTo);
      filteredLogs = filteredLogs.filter(log => log.timestamp <= toDate);
    }
    
    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Pagination
    const limit = Math.min(query.limit || 50, 100); // Max 100 per request
    const offset = query.offset || 0;
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);
    
    return new Response(JSON.stringify({
      logs: paginatedLogs.map(log => ({
        ...log,
        timestamp: log.timestamp.toISOString()
      })),
      totalCount: filteredLogs.length,
      hasMore: offset + limit < filteredLogs.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private async handleGetStats(): Promise<Response> {
    await this.loadAuditState();
    
    const logs = this.auditState!.logs;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Calculate statistics
    const stats = {
      totalLogs: this.auditState!.totalCount,
      last24Hours: logs.filter(log => log.timestamp >= oneDayAgo).length,
      lastWeek: logs.filter(log => log.timestamp >= oneWeekAgo).length,
      
      // Risk level breakdown
      riskLevels: {
        low: logs.filter(log => log.riskLevel === 'low').length,
        medium: logs.filter(log => log.riskLevel === 'medium').length,
        high: logs.filter(log => log.riskLevel === 'high').length,
        critical: logs.filter(log => log.riskLevel === 'critical').length
      },
      
      // Action categories
      categories: this.calculateCategoryStats(logs),
      
      // Most active users
      topUsers: this.calculateTopUsers(logs),
      
      // Recent high-risk actions
      recentHighRiskActions: logs
        .filter(log => log.riskLevel === 'high' || log.riskLevel === 'critical')
        .slice(0, 10)
        .map(log => ({
          logId: log.logId,
          action: log.action,
          user: log.platformUserEmail,
          timestamp: log.timestamp.toISOString(),
          riskLevel: log.riskLevel,
          description: log.description
        })),
      
      createdAt: this.auditState!.createdAt.toISOString(),
      lastUpdated: this.auditState!.lastUpdated.toISOString()
    };
    
    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private async loadAuditState(): Promise<void> {
    if (!this.auditState) {
      this.auditState = await this.state.storage.get('auditState');
      
      if (!this.auditState) {
        // Initialize new audit state
        this.auditState = {
          logs: [],
          totalCount: 0,
          createdAt: new Date(),
          lastUpdated: new Date()
        };
      } else {
        // Convert date strings back to Date objects
        this.auditState.createdAt = new Date(this.auditState.createdAt);
        this.auditState.lastUpdated = new Date(this.auditState.lastUpdated);
        this.auditState.logs = this.auditState.logs.map(log => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    }
  }
  
  private async persistAuditState(): Promise<void> {
    if (!this.auditState) return;
    
    // Archive old logs if we have too many (keep last 10,000 in memory)
    if (this.auditState.logs.length > 10000) {
      await this.archiveOldLogs();
    }
    
    await this.state.storage.put('auditState', {
      ...this.auditState,
      logs: this.auditState.logs.map(log => ({
        ...log,
        timestamp: log.timestamp.toISOString()
      })),
      createdAt: this.auditState.createdAt.toISOString(),
      lastUpdated: this.auditState.lastUpdated.toISOString()
    });
  }
  
  private async archiveOldLogs(): Promise<void> {
    if (!this.auditState) return;
    
    const logsToArchive = this.auditState.logs.slice(0, -5000); // Keep newest 5000
    const archiveKey = `archive_${Date.now()}`;
    
    // Store archived logs separately
    await this.state.storage.put(archiveKey, {
      logs: logsToArchive.map(log => ({
        ...log,
        timestamp: log.timestamp.toISOString()
      })),
      archivedAt: new Date().toISOString()
    });
    
    // Keep only recent logs in main state
    this.auditState.logs = this.auditState.logs.slice(-5000);
    
    console.log(`Archived ${logsToArchive.length} old audit logs to ${archiveKey}`);
  }
  
  private calculateCategoryStats(logs: PlatformAuditLog[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    logs.forEach(log => {
      const category = log.actionCategory;
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return categories;
  }
  
  private calculateTopUsers(logs: PlatformAuditLog[]): Array<{user: string, actions: number}> {
    const userCounts: Record<string, number> = {};
    
    logs.forEach(log => {
      const user = log.platformUserEmail;
      userCounts[user] = (userCounts[user] || 0) + 1;
    });
    
    return Object.entries(userCounts)
      .map(([user, actions]) => ({ user, actions }))
      .sort((a, b) => b.actions - a.actions)
      .slice(0, 10); // Top 10 users
  }
}