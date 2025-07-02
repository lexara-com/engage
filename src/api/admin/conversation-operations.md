# Conversation Operations Design

## Overview
Conversations in Engage are created by the AI agent during user interactions. The admin API provides read-only access to conversation content and allows updates only to metadata and administrative fields.

## Data Flow Architecture

### 1. Conversation Creation (Agent-Initiated)
```
User → AI Agent → ConversationSession DO → Event: conversation.created → D1 Database
```

### 2. Conversation Updates (Admin-Initiated)
```
Admin → API → Auth Validation → D1 Database Update → Audit Log
```

## Storage Strategy

### Durable Objects (ConversationSession)
- **Purpose**: Live conversation state and message history
- **Data**: Full conversation transcript, active session data
- **Access**: By sessionId during active conversations

### D1 Database (conversation_metadata)
```sql
CREATE TABLE conversation_metadata (
  id TEXT PRIMARY KEY,              -- ULID
  firm_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  
  -- User Identity (denormalized for search)
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  
  -- Conversation State
  status TEXT DEFAULT 'active',     -- active, completed, terminated
  phase TEXT,                       -- pre_login, secured, etc.
  conflict_status TEXT,             -- pending, clear, conflict_detected
  
  -- Administrative Fields (updatable)
  assigned_to TEXT,                 -- Attorney/staff ID
  priority TEXT DEFAULT 'normal',   -- low, normal, high, urgent
  tags TEXT,                        -- JSON array of tags
  internal_notes TEXT,              -- Admin notes (append-only)
  follow_up_date DATETIME,
  
  -- Metrics
  message_count INTEGER DEFAULT 0,
  last_message_at DATETIME,
  completed_goals INTEGER DEFAULT 0,
  total_goals INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  completed_at DATETIME,
  
  -- Indexes
  INDEX idx_firm_status (firm_id, status),
  INDEX idx_firm_user (firm_id, user_email),
  INDEX idx_assigned (firm_id, assigned_to),
  INDEX idx_created (firm_id, created_at DESC)
);

CREATE TABLE conversation_audit_log (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  action TEXT NOT NULL,             -- status_change, assignment, note_added, etc.
  performed_by TEXT NOT NULL,       -- Admin user ID
  performed_at DATETIME NOT NULL,
  details TEXT,                     -- JSON with change details
  
  INDEX idx_conversation (conversation_id),
  INDEX idx_firm_audit (firm_id, performed_at DESC)
);
```

## API Operations

### GET /firms/{firmId}/conversations
- Query D1 for metadata
- Support filtering, pagination, sorting
- Return summary without full transcript

### GET /firms/{firmId}/conversations/{conversationId}
- Get metadata from D1
- Fetch full transcript from Durable Object if needed
- Include audit history

### PUT /firms/{firmId}/conversations/{conversationId}
**Allowed Updates:**
```json
{
  "status": "completed",
  "assigned_to": "attorney-123",
  "priority": "high",
  "tags": ["personal-injury", "auto-accident"],
  "follow_up_date": "2024-01-15T10:00:00Z"
}
```

**Not Allowed:**
- Modifying conversation messages
- Changing user identity
- Altering conflict status
- Modifying conversation phase

### POST /firms/{firmId}/conversations/{conversationId}/notes
**Add Internal Note:**
```json
{
  "note": "Client seems very motivated. Good case potential.",
  "type": "assessment"  // assessment, follow_up, general
}
```

### POST /firms/{firmId}/conversations/{conversationId}/actions
**Perform Admin Actions:**
```json
{
  "action": "assign",
  "attorney_id": "attorney-456",
  "note": "Assigning to Sarah - expert in this area"
}
```

## Event Flow

### When Agent Creates/Updates Conversation:
1. Agent writes to ConversationSession DO
2. DO emits event to event stream
3. Event processor updates D1 metadata
4. Maintains eventual consistency

### When Admin Updates Metadata:
1. API validates permissions
2. Updates D1 directly
3. Writes audit log entry
4. Optionally notifies assigned attorney

## Benefits of This Approach

1. **Separation of Concerns**: Live data in DOs, queryable metadata in D1
2. **Performance**: Fast queries without instantiating DOs
3. **Auditability**: Complete audit trail of admin actions
4. **Immutability**: Conversation content preserved for legal compliance
5. **Scalability**: D1 handles complex queries efficiently

## Implementation Notes

1. **Consistency**: Use event-driven updates from DO to D1
2. **Caching**: Consider caching frequently accessed metadata
3. **Permissions**: Implement role-based access (admin vs attorney vs staff)
4. **Retention**: Define data retention policies for compliance