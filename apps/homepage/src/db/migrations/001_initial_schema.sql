-- Migration 001: Initial Authorization Schema
-- Creates the foundation tables for enterprise authorization system
-- Run Date: 2025-06-24

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS firms;

-- Firms table
CREATE TABLE firms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'starter',
    settings TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    auth0_id TEXT UNIQUE NOT NULL,
    firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive', 'suspended')),
    permissions TEXT DEFAULT '{}',
    invited_by TEXT REFERENCES users(id),
    last_login INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    
    UNIQUE(firm_id, email)
);

-- User sessions table
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    permissions TEXT DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Audit log table
CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    firm_id TEXT REFERENCES firms(id),
    action TEXT NOT NULL,
    target_user_id TEXT REFERENCES users(id),
    details TEXT DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Create indexes
CREATE INDEX idx_users_firm_id ON users(firm_id);
CREATE INDEX idx_users_auth0_id ON users(auth0_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_firm_id ON audit_log(firm_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- Create triggers
CREATE TRIGGER update_firms_timestamp 
    AFTER UPDATE ON firms
BEGIN
    UPDATE firms SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_users_timestamp 
    AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = unixepoch() WHERE id = NEW.id;
END;