-- Add token expiration to agents table
ALTER TABLE agents ADD COLUMN expires_at DATETIME;

-- Set existing tokens to expire in 24 hours from now
UPDATE agents SET expires_at = datetime('now', '+24 hours') WHERE expires_at IS NULL;
