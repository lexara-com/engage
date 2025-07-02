-- Engage D1 Database Schema
-- Provides searchable index for conversations stored in Durable Objects

-- Conversations table - searchable metadata for DO-stored conversations
CREATE TABLE IF NOT EXISTS conversations (
  -- Primary identifiers
  id TEXT PRIMARY KEY,              -- ULID (matches DO conversation ID)
  firm_id TEXT NOT NULL,            -- Law firm identifier
  user_id TEXT NOT NULL,            -- User ULID from DO
  session_id TEXT NOT NULL UNIQUE,  -- Session ULID for DO access
  
  -- User identity (denormalized for search)
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  
  -- Conversation state
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated')),
  phase TEXT CHECK (phase IN ('pre_login', 'login_suggested', 'secured', 'conflict_check_complete', 'data_gathering', 'completed', 'terminated')),
  conflict_status TEXT CHECK (conflict_status IN ('pending', 'clear', 'conflict_detected')),
  
  -- Administrative fields (updatable via API)
  assigned_to TEXT,                 -- Attorney/staff ID
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  tags TEXT,                        -- JSON array of tags
  internal_notes TEXT,              -- JSON array of notes
  follow_up_date DATETIME,
  
  -- Metrics (updated by DO sync)
  message_count INTEGER DEFAULT 0,
  last_message_at DATETIME,
  completed_goals INTEGER DEFAULT 0,
  total_goals INTEGER DEFAULT 0,
  
  -- DO sync tracking
  do_version INTEGER DEFAULT 0,     -- Incremented on each DO update
  last_sync_at DATETIME,            -- When D1 was last synced from DO
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
  
  -- Timestamps
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  
  -- Indexes for common queries
  INDEX idx_firm_status (firm_id, status),
  INDEX idx_firm_created (firm_id, created_at DESC),
  INDEX idx_firm_user (firm_id, user_email),
  INDEX idx_assigned (firm_id, assigned_to),
  INDEX idx_priority (firm_id, priority, created_at DESC),
  INDEX idx_follow_up (firm_id, follow_up_date),
  INDEX idx_sync_status (sync_status, last_sync_at)
);

-- Audit log for admin actions
CREATE TABLE IF NOT EXISTS conversation_audit_log (
  id TEXT PRIMARY KEY,              -- ULID
  conversation_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('status_change', 'assignment', 'priority_change', 'tag_update', 'note_added', 'follow_up_set')),
  performed_by TEXT NOT NULL,       -- Admin user ID
  performed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details TEXT,                     -- JSON with change details
  
  INDEX idx_conversation_audit (conversation_id, performed_at DESC),
  INDEX idx_firm_audit (firm_id, performed_at DESC),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Internal notes (separate table for efficient queries)
CREATE TABLE IF NOT EXISTS conversation_notes (
  id TEXT PRIMARY KEY,              -- ULID
  conversation_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('assessment', 'follow_up', 'general')),
  note_content TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_conversation_notes (conversation_id, created_at DESC),
  INDEX idx_firm_notes (firm_id, created_at DESC),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Conversation sync events (for DO->D1 sync tracking)
CREATE TABLE IF NOT EXISTS sync_events (
  id TEXT PRIMARY KEY,              -- ULID
  conversation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT,                  -- JSON event details
  do_version INTEGER,               -- DO version at time of event
  processed BOOLEAN DEFAULT FALSE,
  processed_at DATETIME,
  error_message TEXT,               -- Error if sync failed
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_unprocessed_events (processed, created_at),
  INDEX idx_conversation_events (conversation_id, created_at DESC)
);

-- Firms table (basic info, detailed config in separate service)
CREATE TABLE IF NOT EXISTS firms (
  id TEXT PRIMARY KEY,              -- ULID
  name TEXT NOT NULL,
  domain TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  subscription_plan TEXT DEFAULT 'starter' CHECK (subscription_plan IN ('starter', 'professional', 'enterprise')),
  conversation_limit INTEGER DEFAULT 100,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_firm_status (status),
  INDEX idx_firm_domain (domain)
);

-- Usage tracking for billing
CREATE TABLE IF NOT EXISTS firm_usage (
  firm_id TEXT NOT NULL,
  month TEXT NOT NULL,              -- YYYY-MM format
  conversation_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  storage_bytes INTEGER DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (firm_id, month),
  FOREIGN KEY (firm_id) REFERENCES firms(id)
);

-- Create triggers for updated_at
CREATE TRIGGER update_conversations_timestamp 
AFTER UPDATE ON conversations
BEGIN
  UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_firms_timestamp
AFTER UPDATE ON firms
BEGIN
  UPDATE firms SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;