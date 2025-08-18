import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Default to repo-root paths when running under workspace (cwd = mcp-server)
const defaultDbPath = path.resolve(process.cwd(), '../var/icn-mcp.sqlite');
const MIGRATIONS_DIR = path.resolve(process.cwd(), '../db/migrations');

export type InsertTaskInput = { title: string; description?: string; created_by?: string; id?: string };
export type TaskRow = { id: string; title: string; description: string | null; status: string; created_at: string };
export type InsertRunInput = { task_id: string; agent: string; status: string; notes?: string };
export type InsertArtifactInput = { task_id: string; kind: string; path: string; meta?: unknown };
export type AgentRow = { id: string; name: string; kind: string; token: string; created_at: string; expires_at?: string };
export type InsertWebhookEventInput = {
  event: string; delivery?: string; action?: string; repo?: string; sender?: string; payload?: unknown; task_id?: string;
};

let dbInstance: Database.Database | null = null;
let dbPathInUse: string | null = null;

// Database connection health checking
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// In-memory lock for database operations
const operationLocks = new Map<string, Promise<any>>();

export function getDb(): Database.Database {
  const resolvedPath = process.env.MCP_DB_PATH || defaultDbPath;
  if (dbInstance && dbPathInUse === resolvedPath) {
    // Perform periodic health check
    if (Date.now() - lastHealthCheck > HEALTH_CHECK_INTERVAL) {
      try {
        dbInstance.prepare('SELECT 1').get();
        lastHealthCheck = Date.now();
      } catch (error) {
        console.error('Database health check failed, reinitializing connection:', error);
        closeDb();
        dbInstance = null;
      }
    }
    if (dbInstance) return dbInstance;
  }
  
  // If switching DBs between tests, close previous
  if (dbInstance && dbPathInUse && dbPathInUse !== resolvedPath) {
    closeDb();
  }
  
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  const db = new Database(resolvedPath);
  
  // Configure SQLite for better concurrency and durability
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL'); 
  db.pragma('cache_size = 1000');
  db.pragma('temp_store = memory');
  db.pragma('busy_timeout = 30000'); // 30 second timeout
  
  applyMigrations(db);
  dbInstance = db;
  dbPathInUse = resolvedPath;
  lastHealthCheck = Date.now();
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (error) {
      console.error('Error closing database:', error);
    }
    dbInstance = null;
    dbPathInUse = null;
  }
}

function computeFileChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function applyMigrations(db: Database.Database) {
  try {
    // First ensure schema_migrations table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT
      )
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // Get already applied migrations
    const appliedMigrations = new Map(
      (db.prepare('SELECT version, checksum FROM schema_migrations').all() as Array<{version: string, checksum: string}>)
        .map(row => [row.version, row.checksum])
    );

    for (const file of files) {
      const version = path.basename(file, '.sql');
      const filePath = path.join(MIGRATIONS_DIR, file);
      const checksum = computeFileChecksum(filePath);
      
      if (appliedMigrations.has(version)) {
        // Verify checksum for integrity
        const existingChecksum = appliedMigrations.get(version);
        if (existingChecksum !== checksum) {
          throw new Error(
            `Migration ${version} checksum mismatch. Expected: ${existingChecksum}, Got: ${checksum}. ` +
            `Database migration integrity cannot be guaranteed. Manual intervention required.`
          );
        }
        continue;
      }

      console.log(`Applying migration: ${version}`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Apply migration in transaction
      db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)').run(version, checksum);
      })();
    }
  } catch (error) {
    console.error('Migration error:', error);
    // Fallback: apply initial schema if directory missing
    const initPath = path.resolve(process.cwd(), '../db/migrations/0001_init.sql');
    if (fs.existsSync(initPath)) {
      const sql = fs.readFileSync(initPath, 'utf8');
      db.exec(sql);
    }
  }
}

// Concurrency-safe database operation wrapper
export async function withLock<T>(lockKey: string, operation: () => T): Promise<T> {
  // Wait for any existing operation with the same lock key
  const existingLock = operationLocks.get(lockKey);
  if (existingLock) {
    await existingLock;
  }

  // Create new lock for this operation
  const lockPromise = Promise.resolve().then(operation);
  operationLocks.set(lockKey, lockPromise);

  try {
    const result = await lockPromise;
    return result;
  } finally {
    operationLocks.delete(lockKey);
  }
}

// Helper function for async sleep to avoid blocking event loop
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Database-level write transaction wrapper using BEGIN IMMEDIATE for concurrency safety
function withWriteTransaction<T>(db: Database.Database, operation: () => T): T {
  // Use BEGIN IMMEDIATE to acquire write lock immediately
  // This provides database-level concurrency control across processes
  return db.transaction(operation).immediate();
}

// Database transaction wrapper with retry logic (exported for potential future use)
export async function withTransaction<T>(db: Database.Database, operation: () => T, maxRetries = 3): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return db.transaction(operation)();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a database busy error that we should retry
      if (lastError.message.includes('SQLITE_BUSY') && attempt < maxRetries) {
        // Exponential backoff: 50ms, 100ms, 200ms
        const delay = 50 * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
      
      throw lastError;
    }
  }
  
  throw lastError || new Error('Transaction failed after retries');
}

function generateId(prefix: string): string {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${now}_${rand}`;
}

export function insertTask(input: InsertTaskInput): { id: string } {
  const db = getDb();
  console.log('insertTask input:', input);
  console.log('input.id:', input.id);
  console.log('typeof input.id:', typeof input.id);
  const id = input.id || generateId('task');
  console.log('final id:', id);
  
  return withWriteTransaction(db, () => {
    const stmt = db.prepare(
      "INSERT INTO tasks (id, title, description, status, created_by) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(id, input.title, input.description ?? null, 'open', input.created_by ?? null);
    return { id };
  });
}

// Create a separate task creation function that accepts custom ID for webhooks
export function insertTaskWithCustomId(id: string, title: string, description: string, createdBy: string): { id: string } {
  const db = getDb();
  
  return withWriteTransaction(db, () => {
    const stmt = db.prepare(
      "INSERT INTO tasks (id, title, description, status, created_by) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(id, title, description, 'open', createdBy);
    return { id };
  });
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
  
  return withWriteTransaction(db, () => {
    db.prepare('INSERT INTO agents (id, name, kind, token, expires_at) VALUES (?, ?, ?, ?, datetime(\'now\', \'+\' || ? || \' hours\'))')
      .run(id, input.name, input.kind, input.token, expiresInHours);
    return { id, token: input.token };
  });
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
    const row = db.prepare('SELECT COUNT(1) as c FROM agents WHERE expires_at IS NULL OR expires_at > datetime(\'now\')').get() as { c?: number };
    return Number(row?.c ?? 0);
  } catch {
    // If table does not exist yet during bootstrap, treat as zero agents
    return 0;
  }
}

export function insertAgentBootstrap(input: { name: string; kind: string; token: string; expiresInHours?: number }): { id: string; token: string } | null {
  const db = getDb();
  
  // Use write transaction with immediate lock for concurrency safety
  return withWriteTransaction(db, () => {
    // Check if any agents exist (double-check inside transaction)
    const existingCount = db.prepare('SELECT COUNT(1) as c FROM agents WHERE expires_at IS NULL OR expires_at > datetime(\'now\')').get() as { c?: number };
    if (Number(existingCount?.c ?? 0) > 0) {
      // Someone else already registered, fail this registration
      return null;
    }
    
    // Safe to proceed with first registration
    const id = generateId('agent');
    const expiresInHours = input.expiresInHours ?? 24; // Default 24 hours
    db.prepare('INSERT INTO agents (id, name, kind, token, expires_at) VALUES (?, ?, ?, ?, datetime(\'now\', \'+\' || ? || \' hours\'))')
      .run(id, input.name, input.kind, input.token, expiresInHours);
    return { id, token: input.token };
  });
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
  
  // Use write transaction with immediate lock for concurrency safety
  return withWriteTransaction(db, () => {
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
  });
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

export function insertAgentEmergencyBootstrap(input: { name: string; kind: string; token: string; expiresInHours?: number }, emergencyToken: string): { id: string; token: string } | null {
  // Only allow emergency bootstrap when agents table is empty or all disabled
  const activeCount = countAgents();
  if (activeCount > 0) {
    return null; // Emergency bootstrap only when no active agents
  }
  
  // Verify emergency token
  const expectedToken = process.env.MCP_BOOTSTRAP_TOKEN;
  if (!expectedToken || emergencyToken !== expectedToken) {
    return null; // Invalid emergency token
  }
  
  const db = getDb();
  const id = generateId('agent');
  const expiresInHours = input.expiresInHours ?? 24;
  db.prepare('INSERT INTO agents (id, name, kind, token, expires_at) VALUES (?, ?, ?, ?, datetime(\'now\', \'+\' || ? || \' hours\'))')
    .run(id, input.name, input.kind, input.token, expiresInHours);
  
  // Clear the emergency token after use (by unsetting the env var)
  // Note: This won't persist across restarts but provides single-use semantics
  delete process.env.MCP_BOOTSTRAP_TOKEN;
  
  return { id, token: input.token };
}
export function insertWebhookEvent(input: InsertWebhookEventInput): { id: string } {
  const db = getDb();
  const id = generateId('wh');
  const stmt = db.prepare(
    'INSERT INTO webhook_events (id, event, delivery, action, repo, sender, payload, task_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  stmt.run(
    id,
    input.event,
    input.delivery ?? null,
    input.action ?? null,
    input.repo ?? null,
    input.sender ?? null,
    input.payload ? JSON.stringify(input.payload) : null,
    input.task_id ?? null
  );
  return { id };
}

// Database backup and recovery functions
export async function createBackup(backupPath?: string): Promise<string> {
  const db = getDb();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const finalBackupPath = backupPath || path.resolve(process.cwd(), `../var/backup-${timestamp}.sqlite`);
  
  const backupDir = path.dirname(finalBackupPath);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  // Use SQLite backup API wrapped in Promise to avoid blocking event loop
  await new Promise<void>((resolve, reject) => {
    try {
      db.backup(finalBackupPath);
      // Add a small delay to ensure file is written to disk
      setTimeout(() => {
        if (fs.existsSync(finalBackupPath)) {
          resolve();
        } else {
          reject(new Error(`Backup file was not created: ${finalBackupPath}`));
        }
      }, 100);
    } catch (error) {
      reject(error);
    }
  });
  
  console.log(`Database backup created: ${finalBackupPath}`);
  return finalBackupPath;
}

export function restoreFromBackup(backupPath: string): void {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }
  
  const currentDbPath = process.env.MCP_DB_PATH || defaultDbPath;
  
  // Close current connection
  closeDb();
  
  // Copy backup to current database location
  fs.copyFileSync(backupPath, currentDbPath);
  
  console.log(`Database restored from backup: ${backupPath}`);
}

// Database health and diagnostics
export function getDatabaseInfo(): {
  path: string;
  size: number;
  tables: Array<{ name: string; count: number }>;
  lastBackup?: string;
  migrations: Array<{ version: string; applied_at: string }>;
} {
  const db = getDb();
  const currentDbPath = dbPathInUse || defaultDbPath;
  
  const info = {
    path: currentDbPath,
    size: fs.existsSync(currentDbPath) ? fs.statSync(currentDbPath).size : 0,
    tables: [] as Array<{ name: string; count: number }>,
    migrations: [] as Array<{ version: string; applied_at: string }>
  };
  
  // Get table information
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>;
  for (const table of tables) {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
      info.tables.push({ name: table.name, count: count.count });
    } catch (error) {
      console.warn(`Could not get count for table ${table.name}:`, error);
    }
  }
  
  // Get migration information
  try {
    info.migrations = db.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY applied_at').all() as Array<{ version: string; applied_at: string }>;
  } catch (error) {
    console.warn('Could not get migration information:', error);
  }
  
  return info;
}

