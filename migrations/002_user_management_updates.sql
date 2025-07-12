-- Add columns for Auth0 sync and soft delete
ALTER TABLE firm_users ADD COLUMN last_synced_at DATETIME;
ALTER TABLE firm_users ADD COLUMN deleted_at DATETIME;
ALTER TABLE firm_users ADD COLUMN deletion_reason TEXT;

-- Create audit log table for user actions
CREATE TABLE IF NOT EXISTS user_audit_logs (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'blocked', 'unblocked', 'role_changed', 'password_reset')),
  details TEXT, -- JSON string with action details
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE
);

-- Create index for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_firm_id ON user_audit_logs(firm_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON user_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON user_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON user_audit_logs(created_at);

-- Add index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_firm_users_deleted_at ON firm_users(deleted_at);

-- Update the firm_users role check to include new Auth0-compatible roles
-- Note: This requires recreating the table due to CHECK constraint
-- In production, this would be handled differently

-- Create temporary table with new schema
CREATE TABLE firm_users_new (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL,
  auth0_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('firm:admin', 'firm:lawyer', 'firm:staff', 'firm:viewer')),
  is_active BOOLEAN DEFAULT 1,
  last_synced_at DATETIME,
  deleted_at DATETIME,
  deletion_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE
);

-- Copy existing data with role mapping
INSERT INTO firm_users_new (id, firm_id, auth0_user_id, email, name, role, is_active, created_at, updated_at)
SELECT 
  id, 
  firm_id, 
  auth0_user_id, 
  email, 
  name,
  CASE 
    WHEN role = 'admin' THEN 'firm:admin'
    WHEN role = 'lawyer' THEN 'firm:lawyer'
    WHEN role = 'staff' THEN 'firm:staff'
    WHEN role = 'viewer' THEN 'firm:viewer'
    ELSE role
  END as role,
  is_active,
  created_at,
  updated_at
FROM firm_users;

-- Drop old table and rename new one
DROP TABLE firm_users;
ALTER TABLE firm_users_new RENAME TO firm_users;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_firm_users_firm_id ON firm_users(firm_id);
CREATE INDEX IF NOT EXISTS idx_firm_users_email ON firm_users(email);
CREATE INDEX IF NOT EXISTS idx_firm_users_deleted_at ON firm_users(deleted_at);