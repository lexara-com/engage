-- Firms table
CREATE TABLE IF NOT EXISTS firms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  domain TEXT UNIQUE,
  subscription_tier TEXT DEFAULT 'trial',
  subscription_status TEXT DEFAULT 'active',
  trial_ends_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Firm users table
CREATE TABLE IF NOT EXISTS firm_users (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL,
  auth0_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'lawyer', 'staff', 'viewer')),
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE
);

-- User invitations table
CREATE TABLE IF NOT EXISTS user_invitations (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('firm:admin', 'firm:lawyer', 'firm:staff', 'firm:viewer')),
  practice_areas TEXT, -- JSON array stored as text
  invited_by TEXT NOT NULL,
  invited_by_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  personal_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_firm_users_firm_id ON firm_users(firm_id);
CREATE INDEX IF NOT EXISTS idx_firm_users_email ON firm_users(email);
CREATE INDEX IF NOT EXISTS idx_invitations_firm_id ON user_invitations(firm_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON user_invitations(status);

-- Insert test firm if not exists
INSERT OR IGNORE INTO firms (id, name, email, domain) 
VALUES ('firm_test_001', 'Test Law Firm', 'admin@testlawfirm.com', 'testlawfirm.com');