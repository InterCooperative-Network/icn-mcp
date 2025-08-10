import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Default to repo-root paths when running under workspace (cwd = mcp-server)
const defaultDbPath = path.resolve(process.cwd(), '../var/icn-mcp.sqlite');
const MIGRATIONS_DIR = path.resolve(process.cwd(), '../db/migrations');

export type InsertTaskInput = { title: string; description?: string; created_by?: string };
export type TaskRow = { id: string; title: string; description: string | null; status: string; created_at: string };
export type InsertRunInput = { task_id: string; agent: string; status: string; notes?: string };
export type InsertArtifactInput = { task_id: string; kind: string; path: string; meta?: unknown };
export type AgentRow = { id: string; name: string; kind: string; token: string; created_at: string; expires_at?: string };
export type InsertWebhookEventInput = {
  event: string; delivery?: string; action?: string; repo?: string; sender?: string; payload?: unknown
};

let dbInstance: Database.Database | null = null;
let dbPathInUse: string | null = null;

export function getDb(): Database.Database {
  const resolvedPath = process.env.MCP_DB_PATH || defaultDbPath;
  if (dbInstance && dbPathInUse === resolvedPath) return dbInstance;
  // If switching DBs between tests, close previous
  if (dbInstance && dbPathInUse && dbPathInUse !== resolvedPath) {
    try { dbInstance.close(); } catch {/* ignore */}
    dbInstance = null;
  }
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(resolvedPath);
  applyMigrations(db);
  dbInstance = db;
  dbPathInUse = resolvedPath;
  return dbInstance;
}

function applyMigrations(db: Database.Database) {
  try {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      db.exec(sql);
    }
  } catch {
    // Fallback: apply initial schema if directory missing
    const initPath = path.resolve(process.cwd(), '../db/migrations/0001_init.sql');
    if (fs.existsSync(initPath)) {
      const sql = fs.readFileSync(initPath, 'utf8');
      db.exec(sql);
    }
  }
}

function generateId(prefix: string): string {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${now}_${rand}`;
}

export function insertTask(input: InsertTaskInput): { id: string } {
  const db = getDb();
  const id = generateId('task');
  const stmt = db.prepare(
    "INSERT INTO tasks (id, title, description, status, created_by) VALUES (?, ?, ?, ?, ?)"
  );
  stmt.run(id, input.title, input.description ?? null, 'open', input.created_by ?? null);
  return { id };
}

export function listTasks(): TaskRow[] {
  const db = getDb();
  const rows = db.prepare('SELECT id, title, description, status, created_at FROM tasks ORDER BY created_at DESC').all();
  return rows as TaskRow[];
}

export function getTaskById(id: string): TaskRow | null {
  const db = getDb();
  const row = db.prepare('SELECT id, title, description, status, created_at FROM tasks WHERE id = ?').get(id);
  return (row as TaskRow) ?? null;
}

export function getTaskDeps(id: string): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT depends_on FROM task_deps WHERE task_id = ?').all(id) as Array<{ depends_on: string }>;
  return rows.map((r) => r.depends_on);
}

export function insertRun(input: InsertRunInput): { id: string } {
  const db = getDb();
  const id = generateId('run');
  db.prepare('INSERT INTO task_runs (id, task_id, agent, status, notes) VALUES (?, ?, ?, ?, ?)')
    .run(id, input.task_id, input.agent, input.status, input.notes ?? null);
  return { id };
}

export function insertArtifact(input: InsertArtifactInput): { id: string } {
  const db = getDb();
  const id = generateId('artifact');
  db.prepare('INSERT INTO artifacts (id, task_id, kind, path, meta) VALUES (?, ?, ?, ?, ?)')
    .run(id, input.task_id, input.kind, input.path, input.meta ? JSON.stringify(input.meta) : null);
  return { id };
}

export function insertDep(input: { task_id: string; depends_on: string }): void {
  const db = getDb();
  db.prepare('INSERT INTO task_deps (task_id, depends_on) VALUES (?, ?)')
    .run(input.task_id, input.depends_on);
}

// Agents
export function insertAgent(input: { id?: string; name: string; kind: string; token: string; expiresInHours?: number }): { id: string; token: string } {
  const db = getDb();
  const id = input.id ?? generateId('agent');
  const expiresInHours = input.expiresInHours ?? 24; // Default 24 hours
  db.prepare('INSERT INTO agents (id, name, kind, token, expires_at) VALUES (?, ?, ?, ?, datetime(\'now\', \'+\' || ? || \' hours\'))')
    .run(id, input.name, input.kind, input.token, expiresInHours);
  return { id, token: input.token };
}

export function getAgentByToken(token: string): AgentRow | null {
  const db = getDb();
  // Only return agents with valid (non-expired) tokens
  const row = db.prepare('SELECT id, name, kind, token, created_at, expires_at FROM agents WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime(\'now\'))').get(token);
  return (row as AgentRow) ?? null;
}

export function countAgents(): number {
  try {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(1) as c FROM agents').get() as { c?: number };
    return Number(row?.c ?? 0);
  } catch {
    // If table does not exist yet during bootstrap, treat as zero agents
    return 0;
  }
}

export function refreshAgentToken(agentId: string, newToken: string, expiresInHours: number = 24): boolean {
  const db = getDb();
  const result = db.prepare('UPDATE agents SET token = ?, expires_at = datetime(\'now\', \'+\' || ? || \' hours\') WHERE id = ?')
    .run(newToken, expiresInHours, agentId);
  return result.changes > 0;
}

export function getAgentById(agentId: string): AgentRow | null {
  const db = getDb();
  const row = db.prepare('SELECT id, name, kind, token, created_at, expires_at FROM agents WHERE id = ?').get(agentId);
  return (row as AgentRow) ?? null;
}

export function cleanupExpiredTokens(): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM agents WHERE expires_at IS NOT NULL AND expires_at <= datetime(\'now\')').run();
  return result.changes;
}

// Task claiming and status
export function getAvailableTask(): TaskRow | null {
  const db = getDb();
  // Get tasks that are open and not claimed by anyone, with no unmet dependencies
  const row = db.prepare(`
    SELECT t.id, t.title, t.description, t.status, t.created_at 
    FROM tasks t 
    WHERE t.status = 'open' 
      AND t.id NOT IN (
        SELECT DISTINCT task_id FROM task_runs 
        WHERE status IN ('claimed', 'in_progress')
      )
      AND NOT EXISTS (
        SELECT 1 FROM task_deps td 
        WHERE td.task_id = t.id 
          AND td.depends_on NOT IN (
            SELECT task_id FROM task_runs WHERE status = 'completed'
          )
      )
    ORDER BY t.created_at ASC 
    LIMIT 1
  `).get();
  return (row as TaskRow) ?? null;
}

export function claimTask(taskId: string, agentId: string): boolean {
  const db = getDb();
  // First check if task is still available
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND status = \'open\'').get(taskId);
  if (!task) return false;
  
  // Check if task is already claimed
  const existing = db.prepare('SELECT id FROM task_runs WHERE task_id = ? AND status IN (\'claimed\', \'in_progress\')').get(taskId);
  if (existing) return false;
  
  // Create a run record to claim the task
  const runId = generateId('run');
  db.prepare('INSERT INTO task_runs (id, task_id, agent, status, notes) VALUES (?, ?, ?, \'claimed\', ?)')
    .run(runId, taskId, agentId, `Task claimed by agent`);
  
  return true;
}

export function updateTaskRun(taskId: string, agentId: string, status: string, notes?: string): boolean {
  const db = getDb();
  // Update the most recent run for this task and agent
  const result = db.prepare(`
    UPDATE task_runs 
    SET status = ?, notes = ?, created_at = CURRENT_TIMESTAMP
    WHERE task_id = ? AND agent = ? 
      AND id = (SELECT id FROM task_runs WHERE task_id = ? AND agent = ? ORDER BY created_at DESC LIMIT 1)
  `).run(status, notes ?? null, taskId, agentId, taskId, agentId);
  
  // If the task is completed, update the main task status
  if (status === 'completed' && result.changes > 0) {
    db.prepare('UPDATE tasks SET status = \'completed\' WHERE id = ?').run(taskId);
  }
  
  return result.changes > 0;
}

export function getTaskStatus(taskId: string): { id: string; status: string; agent?: string; notes?: string } | null {
  const db = getDb();
  const taskRow = db.prepare('SELECT id, status FROM tasks WHERE id = ?').get(taskId) as { id: string; status: string } | null;
  if (!taskRow) return null;
  
  // Get the latest run information
  const runRow = db.prepare(`
    SELECT agent, status, notes FROM task_runs 
    WHERE task_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(taskId) as { agent: string; status: string; notes: string } | null;
  
  return {
    id: taskRow.id,
    status: runRow?.status || taskRow.status,
    agent: runRow?.agent,
    notes: runRow?.notes
  };
}

export function insertWebhookEvent(input: InsertWebhookEventInput): { id: string } {
  const db = getDb();
  const id = generateId('wh');
  const stmt = db.prepare(
    'INSERT INTO webhook_events (id, event, delivery, action, repo, sender, payload) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  stmt.run(
    id,
    input.event,
    input.delivery ?? null,
    input.action ?? null,
    input.repo ?? null,
    input.sender ?? null,
    input.payload ? JSON.stringify(input.payload) : null
  );
  return { id };
}

