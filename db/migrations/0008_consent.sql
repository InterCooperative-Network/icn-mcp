-- Consent decisions storage
CREATE TABLE IF NOT EXISTS consent_decisions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  resource TEXT, -- optional, for specific file/resource context
  approved INTEGER NOT NULL, -- 1 for approved, 0 for denied
  message TEXT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER, -- optional expiration timestamp
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, tool_name, resource)
);

-- Index for efficient consent lookups
CREATE INDEX IF NOT EXISTS idx_consent_decisions_lookup ON consent_decisions(user_id, tool_name, resource);
CREATE INDEX IF NOT EXISTS idx_consent_decisions_tool ON consent_decisions(tool_name);
CREATE INDEX IF NOT EXISTS idx_consent_decisions_user ON consent_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_decisions_expires ON consent_decisions(expires_at);