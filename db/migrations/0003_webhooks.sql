CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  delivery TEXT,
  action TEXT,
  repo TEXT,
  sender TEXT,
  payload TEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


