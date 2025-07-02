// Conversations handler for Admin API

import { 
  AdminEnv, 
  AuthenticatedRequest, 
  ConversationSummary,
  ConversationDetail,
  ConversationFilters,
  PaginationParams,
  PaginationMeta,
  UpdateConversationRequest,
  AddNoteRequest,
  ConversationActionRequest,
  ConversationNote,
  AuditEntry
} from '../types';
import { validateFirmAccess, hasPermission } from '../middleware/auth';
import { createLogger } from '@/utils/logger';
import { generateULID } from '@/utils/ulid';

export class ConversationsHandler {
  constructor(private env: AdminEnv) {}

  // GET /firms/{firmId}/conversations
  async list(request: AuthenticatedRequest, firmId: string): Promise<Response> {
    const logger = createLogger(this.env, { operation: 'list-conversations', firmId });

    try {
      // Validate firm access
      if (!validateFirmAccess(request.user, firmId)) {
        return this.forbidden('Access denied to this firm');
      }

      // Parse query parameters
      const url = new URL(request.url);
      const filters = this.parseFilters(url.searchParams);
      const pagination = this.parsePagination(url.searchParams);

      // Build query
      let query = `
        SELECT 
          id, firm_id, user_id, session_id,
          user_name, user_email, user_phone,
          status, phase, conflict_status,
          assigned_to, priority, tags,
          follow_up_date, message_count,
          completed_goals, total_goals,
          created_at, last_message_at as last_activity
        FROM conversations
        WHERE firm_id = ?
      `;
      const params: any[] = [firmId];

      // Apply filters
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.assignedTo) {
        query += ' AND assigned_to = ?';
        params.push(filters.assignedTo);
      }
      if (filters.priority) {
        query += ' AND priority = ?';
        params.push(filters.priority);
      }
      if (filters.startDate) {
        query += ' AND created_at >= ?';
        params.push(filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query += ' AND created_at <= ?';
        params.push(filters.endDate.toISOString());
      }
      if (filters.search) {
        query += ' AND (user_name LIKE ? OR user_email LIKE ? OR user_phone LIKE ?)';
        const searchPattern = `%${filters.search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      // Get total count
      const countQuery = query.replace(
        'SELECT id, firm_id, user_id, session_id,',
        'SELECT COUNT(*) as total'
      ).split('ORDER BY')[0];
      const countResult = await this.env.DB.prepare(countQuery)
        .bind(...params)
        .first();
      const total = countResult?.total as number || 0;

      // Apply pagination
      query += ' ORDER BY created_at DESC';
      query += ' LIMIT ? OFFSET ?';
      params.push(pagination.limit, (pagination.page - 1) * pagination.limit);

      // Execute query
      const result = await this.env.DB.prepare(query)
        .bind(...params)
        .all();

      // Transform results
      const conversations: ConversationSummary[] = result.results.map(row => ({
        id: row.id as string,
        firmId: row.firm_id as string,
        userId: row.user_id as string,
        sessionId: row.session_id as string,
        userName: row.user_name as string | undefined,
        userEmail: row.user_email as string | undefined,
        userPhone: row.user_phone as string | undefined,
        status: row.status as any,
        phase: row.phase as string,
        conflictStatus: row.conflict_status as any,
        assignedTo: row.assigned_to as string | undefined,
        priority: row.priority as any,
        tags: JSON.parse(row.tags as string || '[]'),
        followUpDate: row.follow_up_date ? new Date(row.follow_up_date as string) : undefined,
        messageCount: row.message_count as number,
        completedGoals: row.completed_goals as number,
        totalGoals: row.total_goals as number,
        createdAt: new Date(row.created_at as string),
        lastActivity: new Date(row.last_activity as string)
      }));

      // Build pagination metadata
      const paginationMeta: PaginationMeta = {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      };

      logger.info('Listed conversations', {
        firmId,
        count: conversations.length,
        total,
        filters
      });

      return this.json({
        conversations,
        pagination: paginationMeta
      });

    } catch (error) {
      logger.error('Failed to list conversations', error as Error);
      return this.error('Failed to list conversations');
    }
  }

  // GET /firms/{firmId}/conversations/{conversationId}
  async get(request: AuthenticatedRequest, firmId: string, conversationId: string): Promise<Response> {
    const logger = createLogger(this.env, { 
      operation: 'get-conversation', 
      firmId, 
      conversationId 
    });

    try {
      // Validate firm access
      if (!validateFirmAccess(request.user, firmId)) {
        return this.forbidden('Access denied to this firm');
      }

      // Get metadata from D1
      const metadata = await this.env.DB.prepare(`
        SELECT * FROM conversations WHERE id = ? AND firm_id = ?
      `).bind(conversationId, firmId).first();

      if (!metadata) {
        return this.notFound('Conversation not found');
      }

      // Get full conversation from Durable Object
      const sessionId = metadata.session_id as string;
      const stub = this.env.CONVERSATION_SESSION.get(
        this.env.CONVERSATION_SESSION.idFromName(sessionId)
      );

      const doResponse = await stub.fetch(
        new Request('http://do/full-conversation', {
          headers: { 'X-Admin-Request': 'true' }
        })
      );

      if (!doResponse.ok) {
        logger.error('Failed to fetch from DO', {
          status: doResponse.status,
          sessionId
        });
        return this.error('Failed to fetch conversation data');
      }

      const doData = await doResponse.json() as any;

      // Get internal notes
      const notesResult = await this.env.DB.prepare(`
        SELECT * FROM conversation_notes 
        WHERE conversation_id = ? 
        ORDER BY created_at DESC
      `).bind(conversationId).all();

      const notes: ConversationNote[] = notesResult.results.map(row => ({
        id: row.id as string,
        conversationId: row.conversation_id as string,
        firmId: row.firm_id as string,
        noteType: row.note_type as any,
        noteContent: row.note_content as string,
        createdBy: row.created_by as string,
        createdAt: new Date(row.created_at as string)
      }));

      // Get audit log
      const auditResult = await this.env.DB.prepare(`
        SELECT * FROM conversation_audit_log 
        WHERE conversation_id = ? 
        ORDER BY performed_at DESC
        LIMIT 50
      `).bind(conversationId).all();

      const auditLog: AuditEntry[] = auditResult.results.map(row => ({
        id: row.id as string,
        conversationId: row.conversation_id as string,
        firmId: row.firm_id as string,
        action: row.action as any,
        performedBy: row.performed_by as string,
        performedAt: new Date(row.performed_at as string),
        details: JSON.parse(row.details as string || '{}')
      }));

      // Merge all data
      const conversation: ConversationDetail = {
        // From D1
        id: metadata.id as string,
        firmId: metadata.firm_id as string,
        userId: metadata.user_id as string,
        sessionId: metadata.session_id as string,
        userName: metadata.user_name as string | undefined,
        userEmail: metadata.user_email as string | undefined,
        userPhone: metadata.user_phone as string | undefined,
        status: metadata.status as any,
        phase: metadata.phase as string,
        conflictStatus: metadata.conflict_status as any,
        assignedTo: metadata.assigned_to as string | undefined,
        priority: metadata.priority as any,
        tags: JSON.parse(metadata.tags as string || '[]'),
        followUpDate: metadata.follow_up_date ? new Date(metadata.follow_up_date as string) : undefined,
        messageCount: doData.messages?.length || 0,
        completedGoals: metadata.completed_goals as number,
        totalGoals: metadata.total_goals as number,
        createdAt: new Date(metadata.created_at as string),
        lastActivity: new Date(metadata.last_message_at as string || metadata.updated_at as string),
        
        // From DO
        messages: doData.messages || [],
        userIdentity: doData.userIdentity || {},
        dataGoals: doData.dataGoals || [],
        supportDocuments: doData.supportDocuments || [],
        
        // From D1 joins
        internalNotes: notes,
        auditLog
      };

      logger.info('Retrieved conversation details', {
        conversationId,
        messageCount: conversation.messages.length,
        noteCount: notes.length
      });

      return this.json(conversation);

    } catch (error) {
      logger.error('Failed to get conversation', error as Error);
      return this.error('Failed to get conversation details');
    }
  }

  // PUT /firms/{firmId}/conversations/{conversationId}
  async update(request: AuthenticatedRequest, firmId: string, conversationId: string): Promise<Response> {
    const logger = createLogger(this.env, { 
      operation: 'update-conversation', 
      firmId, 
      conversationId 
    });

    try {
      // Validate firm access
      if (!validateFirmAccess(request.user, firmId)) {
        return this.forbidden('Access denied to this firm');
      }

      // Parse request body
      const updates = await request.json() as UpdateConversationRequest;

      // Validate the conversation exists
      const existing = await this.env.DB.prepare(`
        SELECT id FROM conversations WHERE id = ? AND firm_id = ?
      `).bind(conversationId, firmId).first();

      if (!existing) {
        return this.notFound('Conversation not found');
      }

      // Build update query
      const updateFields: string[] = [];
      const updateParams: any[] = [];

      if (updates.status !== undefined) {
        updateFields.push('status = ?');
        updateParams.push(updates.status);
      }
      if (updates.assignedTo !== undefined) {
        updateFields.push('assigned_to = ?');
        updateParams.push(updates.assignedTo);
      }
      if (updates.priority !== undefined) {
        updateFields.push('priority = ?');
        updateParams.push(updates.priority);
      }
      if (updates.tags !== undefined) {
        updateFields.push('tags = ?');
        updateParams.push(JSON.stringify(updates.tags));
      }
      if (updates.followUpDate !== undefined) {
        updateFields.push('follow_up_date = ?');
        updateParams.push(updates.followUpDate?.toISOString() || null);
      }

      if (updateFields.length === 0) {
        return this.badRequest('No valid fields to update');
      }

      // Update conversation
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      const updateQuery = `
        UPDATE conversations 
        SET ${updateFields.join(', ')}
        WHERE id = ? AND firm_id = ?
      `;
      updateParams.push(conversationId, firmId);

      await this.env.DB.prepare(updateQuery)
        .bind(...updateParams)
        .run();

      // Log audit entry
      const auditDetails: Record<string, any> = {};
      if (updates.status !== undefined) auditDetails.status = updates.status;
      if (updates.assignedTo !== undefined) auditDetails.assignedTo = updates.assignedTo;
      if (updates.priority !== undefined) auditDetails.priority = updates.priority;
      if (updates.tags !== undefined) auditDetails.tags = updates.tags;
      if (updates.followUpDate !== undefined) auditDetails.followUpDate = updates.followUpDate;

      await this.env.DB.prepare(`
        INSERT INTO conversation_audit_log 
        (id, conversation_id, firm_id, action, performed_by, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        generateULID(),
        conversationId,
        firmId,
        'metadata_update',
        request.user!.sub,
        JSON.stringify(auditDetails)
      ).run();

      logger.info('Updated conversation', {
        conversationId,
        updates: auditDetails,
        updatedBy: request.user!.sub
      });

      // Return updated conversation
      return this.get(request, firmId, conversationId);

    } catch (error) {
      logger.error('Failed to update conversation', error as Error);
      return this.error('Failed to update conversation');
    }
  }

  // DELETE /firms/{firmId}/conversations/{conversationId}
  async delete(request: AuthenticatedRequest, firmId: string, conversationId: string): Promise<Response> {
    const logger = createLogger(this.env, { 
      operation: 'delete-conversation', 
      firmId, 
      conversationId 
    });

    try {
      // Only admins can delete conversations
      if (!hasPermission(request.user, 'conversations:delete')) {
        return this.forbidden('Insufficient permissions to delete conversations');
      }

      // Validate firm access
      if (!validateFirmAccess(request.user, firmId)) {
        return this.forbidden('Access denied to this firm');
      }

      // Get conversation metadata
      const conversation = await this.env.DB.prepare(`
        SELECT session_id FROM conversations WHERE id = ? AND firm_id = ?
      `).bind(conversationId, firmId).first();

      if (!conversation) {
        return this.notFound('Conversation not found');
      }

      // Mark as deleted in Durable Object
      const sessionId = conversation.session_id as string;
      const stub = this.env.CONVERSATION_SESSION.get(
        this.env.CONVERSATION_SESSION.idFromName(sessionId)
      );

      const doResponse = await stub.fetch(
        new Request('http://do/delete', {
          method: 'POST',
          headers: { 
            'X-Admin-Request': 'true',
            'X-Deleted-By': request.user!.sub
          }
        })
      );

      if (!doResponse.ok) {
        logger.error('Failed to delete in DO', {
          status: doResponse.status,
          sessionId
        });
        return this.error('Failed to delete conversation');
      }

      // Delete from D1 tables
      await this.env.DB.batch([
        this.env.DB.prepare('DELETE FROM conversation_notes WHERE conversation_id = ?').bind(conversationId),
        this.env.DB.prepare('DELETE FROM conversation_audit_log WHERE conversation_id = ?').bind(conversationId),
        this.env.DB.prepare('DELETE FROM conversations WHERE id = ?').bind(conversationId)
      ]);

      logger.info('Deleted conversation', {
        conversationId,
        deletedBy: request.user!.sub
      });

      return new Response(null, { status: 204 });

    } catch (error) {
      logger.error('Failed to delete conversation', error as Error);
      return this.error('Failed to delete conversation');
    }
  }

  // POST /firms/{firmId}/conversations/{conversationId}/notes
  async addNote(request: AuthenticatedRequest, firmId: string, conversationId: string): Promise<Response> {
    const logger = createLogger(this.env, { 
      operation: 'add-note', 
      firmId, 
      conversationId 
    });

    try {
      // Validate firm access
      if (!validateFirmAccess(request.user, firmId)) {
        return this.forbidden('Access denied to this firm');
      }

      // Parse request body
      const noteRequest = await request.json() as AddNoteRequest;

      // Validate conversation exists
      const existing = await this.env.DB.prepare(`
        SELECT id FROM conversations WHERE id = ? AND firm_id = ?
      `).bind(conversationId, firmId).first();

      if (!existing) {
        return this.notFound('Conversation not found');
      }

      // Create note
      const noteId = generateULID();
      const note: ConversationNote = {
        id: noteId,
        conversationId,
        firmId,
        noteType: noteRequest.type || 'general',
        noteContent: noteRequest.note,
        createdBy: request.user!.sub,
        createdAt: new Date()
      };

      await this.env.DB.prepare(`
        INSERT INTO conversation_notes 
        (id, conversation_id, firm_id, note_type, note_content, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        note.id,
        note.conversationId,
        note.firmId,
        note.noteType,
        note.noteContent,
        note.createdBy
      ).run();

      // Log audit entry
      await this.env.DB.prepare(`
        INSERT INTO conversation_audit_log 
        (id, conversation_id, firm_id, action, performed_by, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        generateULID(),
        conversationId,
        firmId,
        'note_added',
        request.user!.sub,
        JSON.stringify({ noteId, noteType: note.noteType })
      ).run();

      logger.info('Added note to conversation', {
        conversationId,
        noteId,
        noteType: note.noteType,
        addedBy: request.user!.sub
      });

      return this.json(note, 201);

    } catch (error) {
      logger.error('Failed to add note', error as Error);
      return this.error('Failed to add note');
    }
  }

  // POST /firms/{firmId}/conversations/{conversationId}/actions
  async performAction(request: AuthenticatedRequest, firmId: string, conversationId: string): Promise<Response> {
    const logger = createLogger(this.env, { 
      operation: 'perform-action', 
      firmId, 
      conversationId 
    });

    try {
      // Validate firm access
      if (!validateFirmAccess(request.user, firmId)) {
        return this.forbidden('Access denied to this firm');
      }

      // Parse request body
      const actionRequest = await request.json() as ConversationActionRequest;

      // Validate conversation exists
      const existing = await this.env.DB.prepare(`
        SELECT id FROM conversations WHERE id = ? AND firm_id = ?
      `).bind(conversationId, firmId).first();

      if (!existing) {
        return this.notFound('Conversation not found');
      }

      // Perform action based on type
      let result: any = {};
      
      switch (actionRequest.action) {
        case 'assign':
        case 'reassign':
          if (!actionRequest.assigneeId) {
            return this.badRequest('assigneeId is required for assignment');
          }
          
          await this.env.DB.prepare(`
            UPDATE conversations 
            SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND firm_id = ?
          `).bind(actionRequest.assigneeId, conversationId, firmId).run();
          
          result.assignedTo = actionRequest.assigneeId;
          break;
          
        case 'flag_review':
          await this.env.DB.prepare(`
            UPDATE conversations 
            SET tags = json_insert(tags, '$[#]', 'needs-review'), 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND firm_id = ?
          `).bind(conversationId, firmId).run();
          
          result.flagged = true;
          break;
          
        case 'mark_urgent':
          await this.env.DB.prepare(`
            UPDATE conversations 
            SET priority = 'urgent', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND firm_id = ?
          `).bind(conversationId, firmId).run();
          
          result.priority = 'urgent';
          break;
          
        case 'request_follow_up':
          const followUpDate = new Date();
          followUpDate.setDate(followUpDate.getDate() + 1); // Default to tomorrow
          
          await this.env.DB.prepare(`
            UPDATE conversations 
            SET follow_up_date = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND firm_id = ?
          `).bind(followUpDate.toISOString(), conversationId, firmId).run();
          
          result.followUpDate = followUpDate;
          break;
          
        default:
          return this.badRequest(`Unknown action: ${actionRequest.action}`);
      }

      // Add note if provided
      if (actionRequest.note) {
        await this.env.DB.prepare(`
          INSERT INTO conversation_notes 
          (id, conversation_id, firm_id, note_type, note_content, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          generateULID(),
          conversationId,
          firmId,
          'general',
          actionRequest.note,
          request.user!.sub
        ).run();
      }

      // Log audit entry
      await this.env.DB.prepare(`
        INSERT INTO conversation_audit_log 
        (id, conversation_id, firm_id, action, performed_by, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        generateULID(),
        conversationId,
        firmId,
        actionRequest.action,
        request.user!.sub,
        JSON.stringify({
          ...result,
          ...(actionRequest.metadata || {}),
          note: actionRequest.note
        })
      ).run();

      logger.info('Performed action on conversation', {
        conversationId,
        action: actionRequest.action,
        performedBy: request.user!.sub,
        result
      });

      return this.json({
        success: true,
        action: actionRequest.action,
        timestamp: new Date().toISOString(),
        result
      });

    } catch (error) {
      logger.error('Failed to perform action', error as Error);
      return this.error('Failed to perform action');
    }
  }

  // Helper methods
  private parseFilters(params: URLSearchParams): ConversationFilters {
    const filters: ConversationFilters = {};
    
    const status = params.get('status');
    if (status && ['active', 'completed', 'terminated'].includes(status)) {
      filters.status = status as any;
    }
    
    const assignedTo = params.get('assignedTo');
    if (assignedTo) filters.assignedTo = assignedTo;
    
    const priority = params.get('priority');
    if (priority && ['low', 'normal', 'high', 'urgent'].includes(priority)) {
      filters.priority = priority as any;
    }
    
    const startDate = params.get('startDate');
    if (startDate) filters.startDate = new Date(startDate);
    
    const endDate = params.get('endDate');
    if (endDate) filters.endDate = new Date(endDate);
    
    const search = params.get('search');
    if (search) filters.search = search;
    
    return filters;
  }

  private parsePagination(params: URLSearchParams): PaginationParams {
    const page = parseInt(params.get('page') || '1', 10);
    const limit = parseInt(params.get('limit') || '20', 10);
    
    return {
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit))
    };
  }

  private json(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private error(message: string, code = 'INTERNAL_ERROR', status = 500): Response {
    return new Response(JSON.stringify({
      error: { code, message }
    }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private badRequest(message: string): Response {
    return this.error(message, 'BAD_REQUEST', 400);
  }

  private forbidden(message: string): Response {
    return this.error(message, 'FORBIDDEN', 403);
  }

  private notFound(message: string): Response {
    return this.error(message, 'NOT_FOUND', 404);
  }
}