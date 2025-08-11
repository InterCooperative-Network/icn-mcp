-- Add task_id column to webhook_events table to link webhooks to tasks
ALTER TABLE webhook_events ADD COLUMN task_id TEXT;

-- Add index for efficient task_id lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_task_id ON webhook_events(task_id);