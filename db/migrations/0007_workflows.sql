-- Workflow orchestration tables
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  template_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'failed', 'paused')),
  current_step_id TEXT,
  step_data TEXT NOT NULL DEFAULT '{}', -- JSON
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_by TEXT -- agent/user who started the workflow
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'completed', 'failed', 'skipped')),
  sequence INTEGER NOT NULL,
  completed_at INTEGER,
  outputs TEXT DEFAULT '{}', -- JSON
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  UNIQUE(workflow_id, step_id),
  UNIQUE(workflow_id, sequence)
);

CREATE TABLE IF NOT EXISTS workflow_checkpoints (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  data TEXT NOT NULL DEFAULT '{}', -- JSON
  notes TEXT,
  source_request_id TEXT, -- for idempotency
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  UNIQUE(workflow_id, step_id, sequence)
);

CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  hash TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  tags TEXT DEFAULT '[]', -- JSON array
  steps TEXT NOT NULL, -- JSON
  metadata TEXT DEFAULT '{}', -- JSON
  loaded_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(id, version)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_template ON workflows(template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_workflow ON workflow_checkpoints(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_request ON workflow_checkpoints(source_request_id);