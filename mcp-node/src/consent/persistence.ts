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
    resource: row.resource ?? undefined,
    approved: row.approved === 1,
    message: row.message ?? undefined,
    riskLevel: row.risk_level,
    timestamp: row.timestamp,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at
  };
}

/**
 * Store a consent decision in the database
 */
export function persistConsentDecision(
  userId: string,
  toolName: string,
  resource: string | undefined,
  approved: boolean,
  message: string | undefined,
  riskLevel: 'low' | 'medium' | 'high',
  expiresAt?: number
): PersistedConsentDecision {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const normalizedResource = resource ?? null;
  const id = nanoid();
  
  const stmt = db.prepare(`
    INSERT INTO consent_decisions
      (id, user_id, tool_name, resource, approved, message, risk_level, timestamp, expires_at, created_at)
    VALUES
      (?,  ?,       ?,         ?,        ?,        ?,       ?,          ?,         ?,          ?)
    ON CONFLICT(user_id, tool_name, resource) DO UPDATE SET
      approved=excluded.approved,
      message=excluded.message,
      risk_level=excluded.risk_level,
      timestamp=excluded.timestamp,
      expires_at=excluded.expires_at,
      created_at=consent_decisions.created_at
  `);
  
  stmt.run(
    id,
    userId,
    toolName,
    normalizedResource,
    approved ? 1 : 0,
    message ?? null,
    riskLevel,
    now,
    expiresAt ?? null,
    now
  );

  const decision: PersistedConsentDecision = {
    id,
    userId,
    toolName,
    resource: normalizedResource ?? undefined,
    approved,
    message,
    riskLevel,
    timestamp: now,
    expiresAt,
    createdAt: now
  };
  
  return decision;
}

export function checkPersistedConsent(
  userId: string,
  toolName: string,
  resource?: string
): PersistedConsentDecision | null {
  const db = getDb();
  const normalizedResource = resource ?? null;

  // Exact resource match first
  let row = db.prepare(`
    SELECT * FROM consent_decisions
    WHERE user_id = ? AND tool_name = ? AND resource IS ?
    LIMIT 1
  `).get(userId, toolName, normalizedResource) as ConsentRow | undefined;

  // Fallback to general consent (resource NULL)
  if (!row && normalizedResource !== null) {
    row = db.prepare(`
      SELECT * FROM consent_decisions
      WHERE user_id = ? AND tool_name = ? AND resource IS NULL
      LIMIT 1
    `).get(userId, toolName) as ConsentRow | undefined;
  }

  if (!row) return null;

  // Expiration gate here
  const now = Math.floor(Date.now() / 1000);
  if (row.expires_at !== null && row.expires_at <= now) {
    return null;
  }
  return toDomain(row);
}

export function revokeConsent(
  userId: string,
  toolName: string,
  resource?: string
): boolean {
  const db = getDb();
  const normalizedResource = resource ?? null;
  
  const stmt = db.prepare(`
    UPDATE consent_decisions 
    SET approved = 0, timestamp = ?
    WHERE user_id = ? AND tool_name = ? AND resource IS ?
  `);
  
  const now = Math.floor(Date.now() / 1000);
  const result = stmt.run(now, userId, toolName, normalizedResource);
  
  return result.changes > 0;
}

export function getUserConsentHistory(userId: string): PersistedConsentDecision[] {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT * FROM consent_decisions 
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);
  
  const rows = stmt.all(userId) as ConsentRow[];
  
  return rows.map(toDomain);
}

export function cleanupExpiredConsent(): number {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  
  const stmt = db.prepare(`DELETE FROM consent_decisions WHERE expires_at IS NOT NULL AND expires_at <= ?`);
  const result = stmt.run(now);
  return result.changes;
}