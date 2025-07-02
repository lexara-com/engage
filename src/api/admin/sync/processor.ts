// Sync Processor - Handles DO to D1 synchronization

import { AdminEnv, SyncEvent } from '../types';
import { createLogger } from '@/utils/logger';
import { generateULID } from '@/utils/ulid';

export class SyncProcessor {
  constructor(private env: AdminEnv) {}

  async processEvent(event: SyncEvent): Promise<void> {
    const logger = createLogger(this.env, { 
      operation: 'sync-processor',
      eventType: event.type 
    });

    try {
      logger.info('Processing sync event', {
        type: event.type,
        conversationId: event.conversationId,
        doVersion: event.doVersion
      });

      switch (event.type) {
        case 'conversation.created':
          await this.handleConversationCreated(event);
          break;
          
        case 'conversation.message_added':
          await this.handleMessageAdded(event);
          break;
          
        case 'conversation.status_changed':
          await this.handleStatusChanged(event);
          break;
          
        case 'conversation.user_identified':
          await this.handleUserIdentified(event);
          break;
          
        case 'conversation.goals_updated':
          await this.handleGoalsUpdated(event);
          break;
          
        case 'conversation.conflict_checked':
          await this.handleConflictChecked(event);
          break;
          
        default:
          logger.warn('Unknown sync event type', { type: event.type });
      }

      // Log successful sync
      await this.logSyncEvent(event, true);

    } catch (error) {
      logger.error('Failed to process sync event', error as Error, {
        event
      });
      
      // Log failed sync
      await this.logSyncEvent(event, false, error as Error);
      
      throw error;
    }
  }

  private async handleConversationCreated(event: SyncEvent): Promise<void> {
    const { conversationId, firmId, doVersion, data } = event;
    
    // Insert new conversation record
    await this.env.DB.prepare(`
      INSERT INTO conversations (
        id, firm_id, user_id, session_id,
        status, phase, conflict_status,
        do_version, last_sync_at, sync_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'synced', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        do_version = EXCLUDED.do_version,
        last_sync_at = CURRENT_TIMESTAMP,
        sync_status = 'synced'
      WHERE do_version < EXCLUDED.do_version
    `).bind(
      conversationId,
      firmId,
      data.userId,
      conversationId, // session_id same as conversation id
      'active',
      data.phase || 'pre_login',
      'pending',
      doVersion,
      data.createdAt || new Date().toISOString()
    ).run();
  }

  private async handleMessageAdded(event: SyncEvent): Promise<void> {
    const { conversationId, doVersion, data } = event;
    
    // Update message count and last message time
    await this.env.DB.prepare(`
      UPDATE conversations 
      SET message_count = ?,
          last_message_at = ?,
          do_version = ?,
          last_sync_at = CURRENT_TIMESTAMP,
          sync_status = 'synced',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND do_version < ?
    `).bind(
      data.messageCount,
      data.lastMessageAt || new Date().toISOString(),
      doVersion,
      conversationId,
      doVersion
    ).run();
  }

  private async handleStatusChanged(event: SyncEvent): Promise<void> {
    const { conversationId, doVersion, data } = event;
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (data.phase) {
      updates.push('phase = ?');
      params.push(data.phase);
    }
    
    if (data.status) {
      updates.push('status = ?');
      params.push(data.status);
      
      // Set completed_at if status is completed
      if (data.status === 'completed') {
        updates.push('completed_at = CURRENT_TIMESTAMP');
      }
    }
    
    if (updates.length === 0) return;
    
    // Add standard updates
    updates.push('do_version = ?', 'last_sync_at = CURRENT_TIMESTAMP', 'sync_status = ?', 'updated_at = CURRENT_TIMESTAMP');
    params.push(doVersion, 'synced');
    
    // Add WHERE clause params
    params.push(conversationId, doVersion);
    
    await this.env.DB.prepare(`
      UPDATE conversations 
      SET ${updates.join(', ')}
      WHERE id = ? AND do_version < ?
    `).bind(...params).run();
  }

  private async handleUserIdentified(event: SyncEvent): Promise<void> {
    const { conversationId, doVersion, data } = event;
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (data.userName) {
      updates.push('user_name = ?');
      params.push(data.userName);
    }
    
    if (data.userEmail) {
      updates.push('user_email = ?');
      params.push(data.userEmail);
    }
    
    if (data.userPhone) {
      updates.push('user_phone = ?');
      params.push(data.userPhone);
    }
    
    if (updates.length === 0) return;
    
    // Add standard updates
    updates.push('do_version = ?', 'last_sync_at = CURRENT_TIMESTAMP', 'sync_status = ?', 'updated_at = CURRENT_TIMESTAMP');
    params.push(doVersion, 'synced');
    
    // Add WHERE clause params
    params.push(conversationId, doVersion);
    
    await this.env.DB.prepare(`
      UPDATE conversations 
      SET ${updates.join(', ')}
      WHERE id = ? AND do_version < ?
    `).bind(...params).run();
  }

  private async handleGoalsUpdated(event: SyncEvent): Promise<void> {
    const { conversationId, doVersion, data } = event;
    
    await this.env.DB.prepare(`
      UPDATE conversations 
      SET completed_goals = ?,
          total_goals = ?,
          do_version = ?,
          last_sync_at = CURRENT_TIMESTAMP,
          sync_status = 'synced',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND do_version < ?
    `).bind(
      data.completedGoals || 0,
      data.totalGoals || 0,
      doVersion,
      conversationId,
      doVersion
    ).run();
  }

  private async handleConflictChecked(event: SyncEvent): Promise<void> {
    const { conversationId, doVersion, data } = event;
    
    await this.env.DB.prepare(`
      UPDATE conversations 
      SET conflict_status = ?,
          do_version = ?,
          last_sync_at = CURRENT_TIMESTAMP,
          sync_status = 'synced',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND do_version < ?
    `).bind(
      data.conflictStatus || 'pending',
      doVersion,
      conversationId,
      doVersion
    ).run();
  }

  private async logSyncEvent(event: SyncEvent, success: boolean, error?: Error): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO sync_events (
          id, conversation_id, event_type, event_data,
          do_version, processed, processed_at, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).bind(
        generateULID(),
        event.conversationId,
        event.type,
        JSON.stringify(event.data),
        event.doVersion,
        success ? 1 : 0,
        error?.message || null
      ).run();
    } catch (logError) {
      // Don't fail the sync if logging fails
      const logger = createLogger(this.env, { operation: 'sync-log-error' });
      logger.error('Failed to log sync event', logError as Error);
    }
  }
}