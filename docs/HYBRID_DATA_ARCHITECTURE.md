# Hybrid Data Architecture: Durable Objects + D1

## Overview

The Lexara Engage platform uses a **hybrid data architecture** that combines the strengths of Cloudflare Durable Objects for real-time legal operations with D1 SQLite databases for analytical queries and reporting. This approach provides both strong consistency for active legal work and efficient querying for firm management dashboards.

## Architecture Principles

### 1. Primary Data Layer (Durable Objects)
**Purpose**: Source of truth for all active legal conversations and user sessions
- **Strong Consistency**: Immediate conflict detection and audit compliance
- **Real-time Performance**: Sub-millisecond response times for live legal work  
- **Geographic Distribution**: Auto-migrates to optimize user latency globally
- **Colocated Compute**: Business logic runs where data is stored

### 2. Query and Analytics Layer (D1)
**Purpose**: Eventually consistent indexes for datagrid queries and firm analytics
- **SQL Queries**: "All conversations for firm X" style queries for management dashboards
- **Cross-Conversation Analytics**: Relational queries for reporting and insights
- **Eventually Consistent**: Synced from Durable Objects for performance
- **Multi-tenant Isolation**: Separate databases per firm for data security

## Data Flow Strategy

### Write Flow: Durable Objects → D1 Indexes

```typescript
class ConversationSession {
  async addMessage(message: Message) {
    // 1. Update primary state (immediate, strongly consistent)
    this.state.messages.push(message);
    this.state.lastActivity = new Date();
    this.state.dataQualityScore = this.calculateQualityScore();
    
    // 2. Update D1 indexes (async, eventually consistent)
    this.env.ctx.waitUntil(this.updateIndexes());
    
    return this.state;
  }
  
  private async updateIndexes() {
    const indexData = this.extractIndexData();
    
    await this.env.FIRM_INDEX_DB.prepare(`
      INSERT OR REPLACE INTO conversation_index 
      (firmId, sessionId, userId, clientName, clientEmail, 
       practiceArea, status, phase, assignedTo, conflictStatus,
       goalsCompleted, goalsTotal, dataQualityScore, 
       createdAt, lastActivity, isDeleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      indexData.firmId, indexData.sessionId, indexData.userId,
      indexData.clientName, indexData.clientEmail, indexData.practiceArea,
      indexData.status, indexData.phase, indexData.assignedTo,
      indexData.conflictStatus, indexData.goalsCompleted, indexData.goalsTotal,
      indexData.dataQualityScore, indexData.createdAt, indexData.lastActivity,
      indexData.isDeleted
    ).run();
  }
}
```

### Read Flow: D1 for Lists, Durable Objects for Details

```typescript
// Fast SQL query for datagrid views
async function getFirmConversations(firmId: string, filters: ConversationFilters) {
  let query = `
    SELECT sessionId, userId, clientName, clientEmail, practiceArea,
           status, phase, assignedTo, conflictStatus, goalsCompleted,
           goalsTotal, dataQualityScore, lastActivity
    FROM conversation_index 
    WHERE firmId = ? AND isDeleted = FALSE
  `;
  
  const params = [firmId];
  
  if (filters.status) {
    query += ` AND status = ?`;
    params.push(filters.status);
  }
  
  if (filters.assignedTo) {
    query += ` AND assignedTo = ?`;
    params.push(filters.assignedTo);
  }
  
  if (filters.practiceArea) {
    query += ` AND practiceArea = ?`;
    params.push(filters.practiceArea);
  }
  
  query += ` ORDER BY lastActivity DESC LIMIT ?`;
  params.push(filters.limit || 50);
  
  return await db.prepare(query).bind(...params).all();
}

// Full details from Durable Object (source of truth)
async function getConversationDetails(sessionId: string) {
  const conversation = await env.CONVERSATION_SESSION
    .get(env.CONVERSATION_SESSION.idFromName(sessionId));
  
  return await conversation.getFullState();
}
```

## D1 Index Table Specifications

### conversation_index

**Purpose**: Provides indexed access for all conversation list views and filters

```sql
CREATE TABLE conversation_index (
  firmId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  userId TEXT,
  clientName TEXT,
  clientEmail TEXT,
  practiceArea TEXT,
  status TEXT, -- 'active', 'completed', 'terminated'
  phase TEXT,  -- 'pre_login', 'secured', etc.
  assignedTo TEXT,
  conflictStatus TEXT, -- 'clear', 'conflict_detected', 'pending'
  goalsCompleted INTEGER,
  goalsTotal INTEGER,
  dataQualityScore INTEGER, -- 0-100
  createdAt TEXT,
  lastActivity TEXT,
  isDeleted BOOLEAN DEFAULT FALSE,
  
  PRIMARY KEY (firmId, sessionId)
);

-- Indexes for common query patterns
CREATE INDEX idx_firm_status ON conversation_index(firmId, status);
CREATE INDEX idx_firm_assigned ON conversation_index(firmId, assignedTo);
CREATE INDEX idx_firm_activity ON conversation_index(firmId, lastActivity);
CREATE INDEX idx_firm_practice_area ON conversation_index(firmId, practiceArea);
CREATE INDEX idx_firm_conflict_status ON conversation_index(firmId, conflictStatus);
CREATE INDEX idx_firm_data_quality ON conversation_index(firmId, dataQualityScore);
```

### user_index

**Purpose**: User management dashboards and role-based queries

```sql
CREATE TABLE user_index (
  firmId TEXT NOT NULL,
  userId TEXT NOT NULL,
  auth0UserId TEXT,
  email TEXT,
  name TEXT,
  role TEXT,
  status TEXT, -- 'active', 'inactive', 'suspended'
  lastLogin TEXT,
  conversationCount INTEGER DEFAULT 0,
  assignedConversationCount INTEGER DEFAULT 0,
  createdAt TEXT,
  
  PRIMARY KEY (firmId, userId)
);

CREATE INDEX idx_firm_role ON user_index(firmId, role);
CREATE INDEX idx_firm_email ON user_index(firmId, email);
CREATE INDEX idx_firm_status ON user_index(firmId, status);
CREATE INDEX idx_firm_last_login ON user_index(firmId, lastLogin);
```

### case_assignment_index

**Purpose**: Attorney workload management and case tracking

```sql
CREATE TABLE case_assignment_index (
  firmId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  assignedTo TEXT NOT NULL,
  assignedBy TEXT,
  assignedAt TEXT,
  status TEXT, -- 'pending', 'active', 'completed', 'reassigned'
  priority TEXT, -- 'urgent', 'high', 'normal', 'low'
  dueDate TEXT,
  estimatedHours REAL,
  actualHours REAL,
  notes TEXT,
  
  PRIMARY KEY (firmId, sessionId, assignedTo)
);

CREATE INDEX idx_firm_assignee ON case_assignment_index(firmId, assignedTo, status);
CREATE INDEX idx_firm_priority ON case_assignment_index(firmId, priority, dueDate);
CREATE INDEX idx_firm_overdue ON case_assignment_index(firmId, dueDate) 
  WHERE status = 'active' AND dueDate < datetime('now');
```

### audit_log_index

**Purpose**: Compliance reporting and security audit trails

```sql
CREATE TABLE audit_log_index (
  firmId TEXT NOT NULL,
  auditId TEXT NOT NULL,
  userId TEXT,
  action TEXT, -- 'conversation_created', 'conflict_detected', etc.
  resourceType TEXT, -- 'conversation', 'user', 'firm_settings'
  resourceId TEXT,
  timestamp TEXT,
  ipAddress TEXT,
  userAgent TEXT,
  outcome TEXT, -- 'success', 'failure', 'blocked'
  details TEXT, -- JSON blob with additional context
  
  PRIMARY KEY (firmId, auditId)
);

CREATE INDEX idx_firm_audit_time ON audit_log_index(firmId, timestamp);
CREATE INDEX idx_firm_audit_user ON audit_log_index(firmId, userId, timestamp);
CREATE INDEX idx_firm_audit_action ON audit_log_index(firmId, action, timestamp);
CREATE INDEX idx_firm_audit_resource ON audit_log_index(firmId, resourceType, resourceId);
```

### conflict_detection_index

**Purpose**: Conflict management and resolution tracking

```sql
CREATE TABLE conflict_detection_index (
  firmId TEXT NOT NULL,
  conflictId TEXT NOT NULL,
  sessionId TEXT,
  conflictType TEXT, -- 'client', 'opposing_party', 'matter', 'entity'
  conflictEntity TEXT, -- Name or identifier that triggered conflict
  matchType TEXT, -- 'exact', 'fuzzy', 'phonetic', 'alias'
  confidence REAL, -- 0.0 to 1.0 confidence score
  detectedAt TEXT,
  detectedBy TEXT, -- 'system', 'manual'
  status TEXT, -- 'detected', 'reviewing', 'cleared', 'confirmed'
  resolvedAt TEXT,
  resolvedBy TEXT,
  resolution TEXT, -- 'waived', 'client_consented', 'no_conflict', 'cannot_represent'
  notes TEXT,
  
  PRIMARY KEY (firmId, conflictId)
);

CREATE INDEX idx_firm_conflicts ON conflict_detection_index(firmId, status);
CREATE INDEX idx_firm_unresolved ON conflict_detection_index(firmId, status) 
  WHERE status IN ('detected', 'reviewing');
CREATE INDEX idx_firm_conflict_entity ON conflict_detection_index(firmId, conflictEntity);
CREATE INDEX idx_firm_conflict_session ON conflict_detection_index(firmId, sessionId);
```

## Query Examples and Usage Patterns

### Firm Dashboard Queries

```typescript
// Active conversations requiring attention
async function getActiveConversationsRequiringAttention(firmId: string) {
  return await db.prepare(`
    SELECT c.sessionId, c.clientName, c.practiceArea, c.lastActivity,
           c.goalsCompleted, c.goalsTotal, c.dataQualityScore,
           u.name as assignedToName
    FROM conversation_index c
    LEFT JOIN user_index u ON c.assignedTo = u.userId AND c.firmId = u.firmId
    WHERE c.firmId = ? 
      AND c.status = 'active'
      AND (c.assignedTo IS NULL OR c.lastActivity < datetime('now', '-24 hours'))
    ORDER BY c.lastActivity ASC
    LIMIT 20
  `).bind(firmId).all();
}

// Attorney workload analysis
async function getAttorneyWorkload(firmId: string) {
  return await db.prepare(`
    SELECT u.userId, u.name, u.role,
           COUNT(c.sessionId) as activeConversations,
           AVG(c.dataQualityScore) as avgDataQuality,
           COUNT(ca.sessionId) as assignedCases,
           AVG(ca.estimatedHours) as avgEstimatedHours
    FROM user_index u
    LEFT JOIN conversation_index c ON u.userId = c.assignedTo 
      AND u.firmId = c.firmId AND c.status = 'active'
    LEFT JOIN case_assignment_index ca ON u.userId = ca.assignedTo 
      AND u.firmId = ca.firmId AND ca.status = 'active'
    WHERE u.firmId = ? AND u.status = 'active'
    GROUP BY u.userId, u.name, u.role
    ORDER BY activeConversations DESC
  `).bind(firmId).all();
}

// Practice area performance
async function getPracticeAreaMetrics(firmId: string, timeRange: string) {
  return await db.prepare(`
    SELECT c.practiceArea,
           COUNT(*) as totalConversations,
           COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completedConversations,
           AVG(c.dataQualityScore) as avgDataQuality,
           AVG(CASE WHEN c.status = 'completed' 
               THEN (julianday(c.lastActivity) - julianday(c.createdAt)) * 24 
               END) as avgCompletionHours
    FROM conversation_index c
    WHERE c.firmId = ? 
      AND c.createdAt >= datetime('now', ?)
      AND c.isDeleted = FALSE
    GROUP BY c.practiceArea
    ORDER BY totalConversations DESC
  `).bind(firmId, timeRange).all();
}
```

### Compliance and Audit Queries

```typescript
// Conflict detection report
async function getConflictDetectionReport(firmId: string, startDate: string, endDate: string) {
  return await db.prepare(`
    SELECT cd.conflictType, cd.matchType, cd.status,
           COUNT(*) as conflictCount,
           AVG(cd.confidence) as avgConfidence,
           COUNT(CASE WHEN cd.status = 'confirmed' THEN 1 END) as confirmedConflicts,
           COUNT(CASE WHEN cd.status = 'cleared' THEN 1 END) as clearedConflicts
    FROM conflict_detection_index cd
    WHERE cd.firmId = ?
      AND cd.detectedAt BETWEEN ? AND ?
    GROUP BY cd.conflictType, cd.matchType, cd.status
    ORDER BY conflictCount DESC
  `).bind(firmId, startDate, endDate).all();
}

// Audit trail for specific conversation
async function getConversationAuditTrail(firmId: string, sessionId: string) {
  return await db.prepare(`
    SELECT al.timestamp, al.action, al.outcome,
           u.name as userName, u.role as userRole,
           al.ipAddress, al.details
    FROM audit_log_index al
    LEFT JOIN user_index u ON al.userId = u.userId AND al.firmId = u.firmId
    WHERE al.firmId = ? 
      AND al.resourceType = 'conversation'
      AND al.resourceId = ?
    ORDER BY al.timestamp ASC
  `).bind(firmId, sessionId).all();
}

// Data access monitoring
async function getDataAccessReport(firmId: string, userId?: string) {
  let query = `
    SELECT DATE(al.timestamp) as accessDate,
           al.userId, u.name as userName, u.role as userRole,
           COUNT(*) as accessCount,
           COUNT(DISTINCT al.resourceId) as uniqueResourcesAccessed,
           COUNT(CASE WHEN al.outcome = 'blocked' THEN 1 END) as blockedAttempts
    FROM audit_log_index al
    LEFT JOIN user_index u ON al.userId = u.userId AND al.firmId = u.firmId
    WHERE al.firmId = ?
      AND al.action LIKE 'access_%'
      AND al.timestamp >= datetime('now', '-30 days')
  `;
  
  const params = [firmId];
  
  if (userId) {
    query += ` AND al.userId = ?`;
    params.push(userId);
  }
  
  query += `
    GROUP BY DATE(al.timestamp), al.userId, u.name, u.role
    ORDER BY accessDate DESC, accessCount DESC
  `;
  
  return await db.prepare(query).bind(...params).all();
}
```

## Index Consistency and Reconciliation

### Eventually Consistent Strategy

**Normal Operation**: D1 indexes are updated asynchronously after Durable Object state changes
- **Performance**: Immediate response to users without waiting for index updates
- **Reliability**: Index failures don't block primary legal work
- **Consistency**: Indexes eventually catch up, typically within seconds

### Index Reconciliation

```typescript
// Periodic index verification and repair
async function reconcileConversationIndexes(firmId: string) {
  // 1. Get all conversation sessions for the firm
  const conversations = await getAllConversationsForFirm(firmId);
  
  // 2. Compare with D1 index
  const indexedConversations = await db.prepare(`
    SELECT sessionId, lastActivity FROM conversation_index WHERE firmId = ?
  `).bind(firmId).all();
  
  const indexMap = new Map(
    indexedConversations.map(c => [c.sessionId, c.lastActivity])
  );
  
  // 3. Find and repair inconsistencies
  for (const conversation of conversations) {
    const indexedActivity = indexMap.get(conversation.sessionId);
    
    if (!indexedActivity || indexedActivity !== conversation.lastActivity) {
      // Repair index entry
      await updateConversationIndex(conversation);
    }
  }
  
  // 4. Remove orphaned index entries
  for (const [sessionId] of indexMap) {
    if (!conversations.find(c => c.sessionId === sessionId)) {
      await db.prepare(`
        DELETE FROM conversation_index WHERE firmId = ? AND sessionId = ?
      `).bind(firmId, sessionId).run();
    }
  }
}

// Run reconciliation nightly via Cron Triggers
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    if (event.cron === '0 2 * * *') { // 2 AM daily
      const firms = await getAllActiveFirms();
      
      for (const firm of firms) {
        await reconcileConversationIndexes(firm.firmId);
      }
    }
  }
};
```

## Benefits of Hybrid Approach

### ✅ Performance Optimization
- **Hot Data**: Active conversations in Durable Objects (millisecond access)
- **Query Layer**: Indexed metadata in D1 (sub-second complex queries)
- **No N+1 Problems**: Single SQL query retrieves datagrid data
- **Geographic Performance**: DOs migrate globally, D1 provides consistent query speed

### ✅ Legal Compliance
- **Strong Consistency**: Critical legal data in Durable Objects with immediate consistency
- **Audit Trails**: Real-time audit logging in DOs, reportable summaries in D1
- **Data Integrity**: Source of truth never depends on eventually consistent indexes
- **Conflict Detection**: Immediate conflict checking with permanent result caching

### ✅ Scalability and Cost Efficiency
- **Per-Conversation Scaling**: Each legal matter scales independently in DOs
- **Efficient Analytics**: SQL aggregations in D1 vs expensive DO iterations
- **Resource Optimization**: Compute-heavy operations in DOs, query-heavy in D1
- **Cost Control**: D1 provides cost-effective storage for historical and analytical data

### ✅ Developer Experience
- **SQL Familiarity**: Developers can use standard SQL for complex reporting
- **Type Safety**: TypeScript interfaces ensure data consistency across layers
- **Clear Separation**: Real-time logic in DOs, analytical logic in D1
- **Testing**: Easy to test both real-time operations and analytical queries

## Implementation Guidelines

### When to Use Durable Objects
- ✅ Active legal conversations with frequent updates
- ✅ Real-time conflict detection and user session management
- ✅ Business logic requiring strong consistency
- ✅ Data requiring immediate global availability

### When to Use D1 Indexes
- ✅ Datagrid queries ("show all conversations for firm X")
- ✅ Cross-conversation analytics and reporting
- ✅ User management and role-based queries
- ✅ Audit trails and compliance reporting

### Index Update Strategy
- **Immediate Updates**: Update DO state first (blocking)
- **Async Index Updates**: Use `ctx.waitUntil()` for D1 sync (non-blocking)
- **Error Handling**: Log index update failures for manual reconciliation
- **Batch Operations**: Group multiple index updates when possible

This hybrid architecture provides the best of both worlds: the strong consistency and real-time performance of Durable Objects for active legal work, combined with the analytical power and cost efficiency of D1 for firm management and reporting needs.