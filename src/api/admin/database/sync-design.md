# DO to D1 Sync Mechanism Design

## Overview
This document describes how conversation data is synchronized from Durable Objects (source of truth) to D1 (searchable index).

## Architecture

### 1. Event-Driven Sync
When DO state changes, it emits events that are processed asynchronously to update D1.

```mermaid
DO State Change → Emit Event → Queue → Event Processor → Update D1
```

### 2. Sync Points

#### A. Conversation Creation
```typescript
// In ConversationSession DO
async createSession() {
  // ... create conversation state ...
  await this.saveState();
  
  // Emit sync event
  await this.emitSyncEvent({
    type: 'conversation.created',
    data: {
      conversationId: this.conversationState.sessionId,
      firmId: this.conversationState.firmId,
      userId: this.conversationState.userId,
      phase: 'pre_login',
      createdAt: new Date()
    }
  });
}
```

#### B. Message Added
```typescript
async addMessage() {
  // ... add message ...
  await this.saveState();
  
  // Emit lightweight sync event
  await this.emitSyncEvent({
    type: 'conversation.message_added',
    data: {
      conversationId: this.conversationState.sessionId,
      messageCount: this.conversationState.messages.length,
      lastMessageAt: new Date()
    }
  });
}
```

#### C. Status Changes
```typescript
async updatePhase(newPhase: string) {
  this.conversationState.phase = newPhase;
  await this.saveState();
  
  await this.emitSyncEvent({
    type: 'conversation.status_changed',
    data: {
      conversationId: this.conversationState.sessionId,
      phase: newPhase,
      status: this.deriveStatus(newPhase)
    }
  });
}
```

### 3. Event Processing

#### Option 1: Queue-Based (Recommended)
```typescript
// Durable Object emits to Queue
async emitSyncEvent(event: SyncEvent) {
  await this.env.SYNC_QUEUE.send({
    ...event,
    doVersion: ++this.conversationState.doVersion,
    timestamp: new Date()
  });
}

// Queue consumer worker
export default {
  async queue(batch: MessageBatch<SyncEvent>, env: Env) {
    const db = env.DB;
    
    for (const message of batch.messages) {
      try {
        await processSyncEvent(db, message.body);
        message.ack();
      } catch (error) {
        // Retry logic
        message.retry();
      }
    }
  }
};
```

#### Option 2: Webhooks
```typescript
// DO calls internal webhook
async emitSyncEvent(event: SyncEvent) {
  await fetch(`${this.env.SYNC_WEBHOOK_URL}/events`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${this.env.SYNC_SECRET}` },
    body: JSON.stringify(event)
  });
}
```

### 4. D1 Update Logic

```typescript
async function processSyncEvent(db: D1Database, event: SyncEvent) {
  switch (event.type) {
    case 'conversation.created':
      await db.prepare(`
        INSERT INTO conversations (
          id, firm_id, user_id, session_id, 
          status, phase, created_at, do_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        event.data.conversationId,
        event.data.firmId,
        event.data.userId,
        event.data.conversationId, // session_id same as id
        'active',
        event.data.phase,
        event.data.createdAt,
        event.doVersion
      ).run();
      break;
      
    case 'conversation.message_added':
      await db.prepare(`
        UPDATE conversations 
        SET message_count = ?, 
            last_message_at = ?,
            do_version = ?,
            last_sync_at = CURRENT_TIMESTAMP
        WHERE id = ? AND do_version < ?
      `).bind(
        event.data.messageCount,
        event.data.lastMessageAt,
        event.doVersion,
        event.data.conversationId,
        event.doVersion
      ).run();
      break;
      
    case 'conversation.user_identified':
      await db.prepare(`
        UPDATE conversations 
        SET user_name = ?, 
            user_email = ?,
            user_phone = ?,
            do_version = ?,
            last_sync_at = CURRENT_TIMESTAMP
        WHERE id = ? AND do_version < ?
      `).bind(
        event.data.userName,
        event.data.userEmail,
        event.data.userPhone,
        event.doVersion,
        event.data.conversationId,
        event.doVersion
      ).run();
      break;
  }
  
  // Log sync event
  await db.prepare(`
    INSERT INTO sync_events (
      id, conversation_id, event_type, event_data, 
      do_version, processed, processed_at
    ) VALUES (?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)
  `).bind(
    generateULID(),
    event.data.conversationId,
    event.type,
    JSON.stringify(event.data),
    event.doVersion
  ).run();
}
```

### 5. Handling Admin Updates

When admin updates via API affect D1 but not DO:

```typescript
// Admin API endpoint
async updateConversationMetadata(conversationId: string, updates: AdminUpdates) {
  // Update D1 directly for admin-only fields
  await db.prepare(`
    UPDATE conversations 
    SET assigned_to = ?,
        priority = ?,
        tags = ?,
        follow_up_date = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    updates.assignedTo,
    updates.priority,
    JSON.stringify(updates.tags),
    updates.followUpDate,
    conversationId
  ).run();
  
  // Log audit entry
  await db.prepare(`
    INSERT INTO conversation_audit_log (
      id, conversation_id, firm_id, action, 
      performed_by, details
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    generateULID(),
    conversationId,
    firmId,
    'metadata_update',
    userId,
    JSON.stringify(updates)
  ).run();
}
```

### 6. Full Sync for Conversations

For the GET endpoint, we need to merge D1 metadata with DO data:

```typescript
async getConversationDetail(conversationId: string): Promise<ConversationDetail> {
  // 1. Get metadata from D1
  const metadata = await db.prepare(`
    SELECT * FROM conversations WHERE id = ?
  `).bind(conversationId).first();
  
  if (!metadata) {
    throw new NotFoundError('Conversation not found');
  }
  
  // 2. Get full conversation from DO
  const stub = env.CONVERSATION_SESSION.get(
    env.CONVERSATION_SESSION.idFromName(metadata.session_id)
  );
  
  const doResponse = await stub.fetch(
    new Request('http://do/full-conversation')
  );
  const doData = await doResponse.json();
  
  // 3. Get notes from D1
  const notes = await db.prepare(`
    SELECT * FROM conversation_notes 
    WHERE conversation_id = ? 
    ORDER BY created_at DESC
  `).bind(conversationId).all();
  
  // 4. Get audit log from D1
  const auditLog = await db.prepare(`
    SELECT * FROM conversation_audit_log 
    WHERE conversation_id = ? 
    ORDER BY performed_at DESC
    LIMIT 50
  `).bind(conversationId).all();
  
  // 5. Merge all data
  return {
    // From D1 (metadata)
    id: metadata.id,
    firmId: metadata.firm_id,
    status: metadata.status,
    assignedTo: metadata.assigned_to,
    priority: metadata.priority,
    tags: JSON.parse(metadata.tags || '[]'),
    followUpDate: metadata.follow_up_date,
    
    // From DO (conversation data)
    messages: doData.messages,
    userIdentity: doData.userIdentity,
    phase: doData.phase,
    conflictStatus: doData.conflictCheck.status,
    dataGoals: doData.dataGoals,
    completedGoals: doData.completedGoals,
    
    // From D1 (admin data)
    internalNotes: notes.results,
    auditLog: auditLog.results,
    
    // Metrics
    messageCount: doData.messages.length,
    createdAt: metadata.created_at,
    lastActivity: metadata.last_message_at || metadata.updated_at
  };
}
```

### 7. Consistency Guarantees

1. **DO Version Tracking**: Each DO update increments version, D1 only updates if version is newer
2. **Idempotent Updates**: Same event processed multiple times has same result
3. **Eventually Consistent**: D1 may lag behind DO by seconds/minutes
4. **Admin Changes**: Don't affect DO state, only D1 metadata

### 8. Recovery Mechanisms

```typescript
// Periodic reconciliation job
async reconcileConversations() {
  // Find conversations with old sync times
  const stale = await db.prepare(`
    SELECT id, session_id, do_version 
    FROM conversations 
    WHERE last_sync_at < datetime('now', '-1 hour')
    LIMIT 100
  `).all();
  
  for (const conv of stale.results) {
    // Fetch current state from DO
    const stub = env.CONVERSATION_SESSION.get(
      env.CONVERSATION_SESSION.idFromName(conv.session_id)
    );
    
    const state = await stub.fetch(
      new Request('http://do/sync-state')
    ).then(r => r.json());
    
    // Update D1 if DO version is newer
    if (state.doVersion > conv.do_version) {
      await updateD1FromDOState(db, conv.id, state);
    }
  }
}
```

## Implementation Priority

1. **Phase 1**: Basic sync on creation and message events
2. **Phase 2**: Full event coverage and queue implementation  
3. **Phase 3**: Admin API endpoints using D1
4. **Phase 4**: Recovery and reconciliation jobs
5. **Phase 5**: Performance optimization and caching