import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Default to repo-root paths when running under workspace (cwd = mcp-server)
const defaultDbPath = path.resolve(process.cwd(), '../var/icn-mcp.sqlite');
const DB_PATH = process.env.MCP_DB_PATH || defaultDbPath;
const MIGRATIONS_PATH = path.resolve(process.cwd(), '../db/migrations/0001_init.sql');

export type InsertTaskInput = { title: string; description?: string; created_by?: string };
export type TaskRow = { id: string; title: string; description: string | null; status: string; created_at: string };
export type InsertRunInput = { task_id: string; agent: string; status: string; notes?: string };
export type InsertArtifactInput = { task_id: string; kind: string; path: string; meta?: unknown };

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  applyMigrations(db);
  dbInstance = db;
  return dbInstance;
}

function applyMigrations(db: Database.Database) {
  // Check for existence of core table; if missing, apply initial migration
  const hasTasks = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
    .get();
  if (!hasTasks) {
    const sql = fs.readFileSync(MIGRATIONS_PATH, 'utf8');
    db.exec(sql);
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

