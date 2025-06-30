-- Authorization System Database Schema
-- This schema replaces Auth0 metadata with proper database tables
-- for enterprise-grade user management

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Firms table
CREATE TABLE IF NOT EXISTS firms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'starter',
    settings TEXT DEFAULT '{}', -- JSON string for firm-specific settings
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Users table - single source of truth for user data
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    auth0_id TEXT UNIQUE NOT NULL, -- Link to Auth0 for authentication only
    firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive', 'suspended')),
    permissions TEXT DEFAULT '{}', -- JSON string for user-specific permissions
    invited_by TEXT REFERENCES users(id), -- Track who invited this user
    last_login INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    
    -- Ensure email uniqueness within firm
    UNIQUE(firm_id, email)
);

-- User sessions table for JWT token management
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL, -- SHA-256 hash of JWT token for revocation
    permissions TEXT DEFAULT '{}', -- Cached permissions at time of session creation
    ip_address TEXT,
    user_agent TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Audit log for permission changes
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    firm_id TEXT REFERENCES firms(id),
    action TEXT NOT NULL, -- 'user_created', 'role_changed', 'permission_granted', etc.
    target_user_id TEXT REFERENCES users(id), -- User being acted upon
    details TEXT DEFAULT '{}', -- JSON details of the change
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_firm_id ON users(firm_id);
CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_firm_id ON audit_log(firm_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Triggers to maintain updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_firms_timestamp 
    AFTER UPDATE ON firms
BEGIN
    UPDATE firms SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Sample data for development (will be removed in production)
-- INSERT OR IGNORE INTO firms (id, name, domain, plan) VALUES 
--     ('firm-example-com', 'Example Law Firm', 'example.com', 'professional');

-- INSERT OR IGNORE INTO users (id, auth0_id, firm_id, email, first_name, last_name, role, status) VALUES 
--     ('user-admin-1', 'auth0|example123', 'firm-example-com', 'admin@example.com', 'John', 'Admin', 'admin', 'active');