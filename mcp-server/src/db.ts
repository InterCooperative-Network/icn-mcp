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
export type AgentRow = { id: string; name: string; kind: string; token: string; created_at: string };
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
export function insertAgent(input: { id?: string; name: string; kind: string; token: string }): { id: string; token: string } {
  const db = getDb();
  const id = input.id ?? generateId('agent');
  db.prepare('INSERT INTO agents (id, name, kind, token) VALUES (?, ?, ?, ?)')
    .run(id, input.name, input.kind, input.token);
  return { id, token: input.token };
}

export function getAgentByToken(token: string): AgentRow | null {
  const db = getDb();
  const row = db.prepare('SELECT id, name, kind, token, created_at FROM agents WHERE token = ?').get(token);
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

