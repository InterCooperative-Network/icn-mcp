-- Add index on webhook_events.task_id for efficient task linkage queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_task_id ON webhook_events(task_id) WHERE task_id IS NOT NULL;