-- Test data setup for Admin API testing

-- Insert test firm
INSERT INTO firms (id, name, domain, status, subscription_plan, conversation_limit)
VALUES ('01HK8Z1X2Y3V4W5A6B7C8D9E0F', 'Test Law Firm', 'testfirm.com', 'active', 'professional', 1000);

-- Insert test conversations
INSERT INTO conversations (
  id, firm_id, user_id, session_id,
  user_name, user_email, user_phone,
  status, phase, conflict_status,
  assigned_to, priority, tags,
  message_count, completed_goals, total_goals,
  created_at, last_message_at
) VALUES 
(
  '01HK8Z2X3Y4V5W6A7B8C9D0E1F',
  '01HK8Z1X2Y3V4W5A6B7C8D9E0F',
  '01HK8Z3X4Y5V6W7A8B9C0D1E2F',
  '01HK8Z2X3Y4V5W6A7B8C9D0E1F',
  'John Doe',
  'john.doe@example.com',
  '555-0123',
  'active',
  'data_gathering',
  'clear',
  NULL,
  'normal',
  '["personal-injury", "auto-accident"]',
  5,
  2,
  5,
  datetime('now', '-2 hours'),
  datetime('now', '-30 minutes')
),
(
  '01HK8Z4X5Y6V7W8A9B0C1D2E3F',
  '01HK8Z1X2Y3V4W5A6B7C8D9E0F',
  '01HK8Z5X6Y7V8W9A0B1C2D3E4F',
  '01HK8Z4X5Y6V7W8A9B0C1D2E3F',
  'Jane Smith',
  'jane.smith@example.com',
  '555-0456',
  'completed',
  'completed',
  'clear',
  'attorney-123',
  'high',
  '["contract-dispute"]',
  12,
  5,
  5,
  datetime('now', '-1 day'),
  datetime('now', '-6 hours')
),
(
  '01HK8Z6X7Y8V9W0A1B2C3D4E5F',
  '01HK8Z1X2Y3V4W5A6B7C8D9E0F',
  '01HK8Z7X8Y9V0W1A2B3C4D5E6F',
  '01HK8Z6X7Y8V9W0A1B2C3D4E5F',
  NULL,
  NULL,
  NULL,
  'active',
  'pre_login',
  'pending',
  NULL,
  'low',
  '[]',
  2,
  0,
  3,
  datetime('now', '-15 minutes'),
  datetime('now', '-5 minutes')
);

-- Insert test notes
INSERT INTO conversation_notes (
  id, conversation_id, firm_id, note_type, note_content, created_by
) VALUES (
  '01HK8Z8X9Y0V1W2A3B4C5D6E7F',
  '01HK8Z2X3Y4V5W6A7B8C9D0E1F',
  '01HK8Z1X2Y3V4W5A6B7C8D9E0F',
  'assessment',
  'Client has a strong case for personal injury claim. Multiple witnesses.',
  'attorney-456'
);

-- Insert test audit log entries
INSERT INTO conversation_audit_log (
  id, conversation_id, firm_id, action, performed_by, details
) VALUES 
(
  '01HK8Z9X0Y1V2W3A4B5C6D7E8F',
  '01HK8Z4X5Y6V7W8A9B0C1D2E3F',
  '01HK8Z1X2Y3V4W5A6B7C8D9E0F',
  'assignment',
  'admin-789',
  '{"assignedTo": "attorney-123", "note": "Assigning to senior attorney"}'
),
(
  '01HK8ZAX1Y2V3W4A5B6C7D8E9F',
  '01HK8Z4X5Y6V7W8A9B0C1D2E3F',
  '01HK8Z1X2Y3V4W5A6B7C8D9E0F',
  'status_change',
  'attorney-123',
  '{"from": "active", "to": "completed", "reason": "Case resolved"}'
);

-- Create rate limit table for testing
CREATE TABLE IF NOT EXISTS rate_limit_log (
  key TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  INDEX idx_key_timestamp (key, timestamp)
);