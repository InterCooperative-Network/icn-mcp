import { getDb } from './db.js';

export function getNextOpenTask(): { id: string; title: string } | null {
  const db = getDb();
  const row = db.prepare("SELECT id, title FROM tasks WHERE status = 'open' ORDER BY created_at ASC LIMIT 1").get();
  if (!row) return null;
  return row as any;
}

export function markTaskClaimed(taskId: string, agentId: string): void {
  const db = getDb();
  db.prepare("UPDATE tasks SET status = 'claimed' WHERE id = ?").run(taskId);
  db.prepare('INSERT INTO task_runs (id, task_id, agent, status, notes) VALUES (?, ?, ?, ?, ?)')
    .run(`run_${Date.now()}`, taskId, agentId, 'claimed', null);
}

export function getTaskStatus(taskId: string): { id: string; status: string } | null {
  const db = getDb();
  const row = db.prepare('SELECT id, status FROM tasks WHERE id = ?').get(taskId) as any;
  return row ?? null;
}


