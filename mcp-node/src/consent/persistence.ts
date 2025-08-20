/**
 * Database access layer for consent decisions
 */

import Database from 'better-sqlite3';
import { PersistedConsentDecision } from './types.js';
import { nanoid } from 'nanoid';
import fs from 'node:fs';
import path from 'node:path';

// Use the same database path resolution logic as the main server
const defaultDbPath = process.env.MCP_DB_PATH || path.resolve(process.cwd(), '../var/icn-mcp.sqlite');

let dbInstance: Database.Database | null = null;

function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }
  
  // Ensure directory exists
  const dbDir = path.dirname(defaultDbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Initialize database
  dbInstance = new Database(defaultDbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');
  
  // Create consent_decisions table if it doesn't exist (for standalone usage)
  try {
    dbInstance.prepare(`
      CREATE TABLE IF NOT EXISTS consent_decisions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        resource TEXT,
        approved INTEGER NOT NULL,
        message TEXT,
        risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
        timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
        expires_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(user_id, tool_name, resource)
      )
    `).run();
    
    // Create indexes if they don't exist
    dbInstance.prepare('CREATE INDEX IF NOT EXISTS idx_consent_decisions_lookup ON consent_decisions(user_id, tool_name, resource)').run();
    dbInstance.prepare('CREATE INDEX IF NOT EXISTS idx_consent_decisions_tool ON consent_decisions(tool_name)').run();
    dbInstance.prepare('CREATE INDEX IF NOT EXISTS idx_consent_decisions_user ON consent_decisions(user_id)').run();
    dbInstance.prepare('CREATE INDEX IF NOT EXISTS idx_consent_decisions_expires ON consent_decisions(expires_at)').run();
  } catch (err) {
    console.error('Error initializing consent_decisions table or indexes:', err);
    throw err;
  }
  
  return dbInstance;
}

/**
 * Reset database instance (for testing)
 */
export function resetDbInstance(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore close errors
    }
    dbInstance = null;
  }
}

// Database row mapping interface
interface ConsentRow {
  id: string;
  user_id: string;
  tool_name: string;
  resource: string | null;
  approved: number;
  message: string | null;
  risk_level: 'low' | 'medium' | 'high';
  timestamp: number;
  expires_at: number | null;
  created_at: number;
}

function toDomain(row: ConsentRow): PersistedConsentDecision {
  return {
    id: row.id,
    userId: row.user_id,
    toolName: row.tool_name,
    resource: row.resource ?? null,
    approved: row.approved === 1,
    message: row.message ?? null,
    riskLevel: row.risk_level,
    timestamp: row.timestamp,
    expiresAt: row.expires_at,     // null when absent (never undefined)
    createdAt: row.created_at
  };
}

// Always normalize to NULL for "no resource"
const normRes = (res?: string | null) => (res ?? null);

// Return the *actual* row id (existing or newly inserted)
export function persistConsentDecision(
  userId: string,
  toolName: string,
  resource?: string | null,
  approved?: boolean,
  message?: string | null,
  riskLevel?: 'low' | 'medium' | 'high',
  expiresAt?: number | null
): PersistedConsentDecision {
  const db = getDb();
  const r = normRes(resource);
  const now = Math.floor(Date.now() / 1000);

  // See if a row already exists for (user, tool, resource)
  const existing = db.prepare(`
    SELECT * FROM consent_decisions
    WHERE user_id = ? AND tool_name = ? AND resource IS ?
    LIMIT 1
  `).get(userId, toolName, r) as ConsentRow | undefined;

  const id = existing?.id ?? nanoid();

  if (existing) {
    // Update existing record, but ensure timestamp changes
    const updatedTimestamp = Math.max(now, existing.timestamp + 1);
    db.prepare(`
      UPDATE consent_decisions SET
        approved = ?,
        message = ?,
        risk_level = ?,
        timestamp = ?,
        expires_at = ?
      WHERE id = ?
    `).run(
      approved === undefined ? existing.approved : (approved ? 1 : 0),
      message === undefined ? existing.message : (message ?? null),
      riskLevel ?? existing.risk_level,
      updatedTimestamp,
      expiresAt === undefined ? existing.expires_at : (expiresAt ?? null),
      id
    );
  } else {
    // Insert new record
    db.prepare(`
      INSERT INTO consent_decisions
        (id, user_id, tool_name, resource, approved, message, risk_level, timestamp, expires_at, created_at)
      VALUES
        (?,  ?,       ?,         ?,        ?,        ?,       ?,          ?,         ?,          ?)
    `).run(
      id,
      userId,
      toolName,
      r,
      approved ? 1 : 0,
      message ?? null,
      riskLevel ?? 'low',
      now,
      expiresAt ?? null,
      now
    );
  }

  // Return the updated/created record
  const finalRow = db.prepare(`
    SELECT * FROM consent_decisions WHERE id = ?
  `).get(id) as ConsentRow;

  return toDomain(finalRow);
}

export function checkPersistedConsent(
  userId: string,
  toolName: string,
  resource?: string | null
): PersistedConsentDecision | null {
  const db = getDb();
  const r = normRes(resource);

  // Exact match
  let row = db.prepare(`
    SELECT * FROM consent_decisions
    WHERE user_id = ? AND tool_name = ? AND resource IS ?
    LIMIT 1
  `).get(userId, toolName, r) as ConsentRow | undefined;

  // Fallback to general (resource NULL) only if:
  // 1. No exact match found
  // 2. We're looking for a specific resource (r !== null)
  // 3. There are NO other specific resource consents for this user/tool
  if (!row && r !== null) {
    const hasSpecificConsents = db.prepare(`
      SELECT COUNT(*) as count FROM consent_decisions
      WHERE user_id = ? AND tool_name = ? AND resource IS NOT NULL
    `).get(userId, toolName) as { count: number };
    
    if (hasSpecificConsents.count === 0) {
      // No specific resource consents exist, safe to fallback to general
      row = db.prepare(`
        SELECT * FROM consent_decisions
        WHERE user_id = ? AND tool_name = ? AND resource IS NULL
        LIMIT 1
      `).get(userId, toolName) as ConsentRow | undefined;
    }
  }

  if (!row) return null;

  // Honor expiration
  const now = Math.floor(Date.now() / 1000);
  if (row.expires_at !== null && row.expires_at <= now) return null;

  return toDomain(row);
}

export function revokeConsent(
  userId: string,
  toolName: string,
  resource?: string | null
): boolean {
  const db = getDb();
  const r = normRes(resource);
  
  const stmt = db.prepare(`
    UPDATE consent_decisions 
    SET approved = 0, timestamp = ?
    WHERE user_id = ? AND tool_name = ? AND resource IS ?
  `);
  
  const now = Math.floor(Date.now() / 1000);
  const result = stmt.run(now, userId, toolName, r);
  
  return result.changes > 0;
}

// Only latest per (tool, resource) for the user
export function getUserConsentHistory(userId: string): PersistedConsentDecision[] {
  const db = getDb();
  
  // Use a window function to get the latest record per (tool, resource) group
  const rows = db.prepare(`
    SELECT * FROM (
      SELECT cd.*,
             ROW_NUMBER() OVER (
               PARTITION BY tool_name, IFNULL(resource, '') 
               ORDER BY timestamp DESC, id DESC
             ) as rn
      FROM consent_decisions cd
      WHERE cd.user_id = ?
    )
    WHERE rn = 1
    ORDER BY timestamp DESC
  `).all(userId) as ConsentRow[];
  
  return rows.map(toDomain);
}

export function cleanupExpiredConsent(): number {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  
  const stmt = db.prepare(`DELETE FROM consent_decisions WHERE expires_at IS NOT NULL AND expires_at <= ?`);
  const result = stmt.run(now);
  return result.changes;
}

export function deleteAllConsentsForUser(userId: string): number {
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM consent_decisions WHERE user_id = ?`);
  const result = stmt.run(userId);
  return result.changes;
}