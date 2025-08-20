/**
 * Database access layer for consent decisions
 */

import Database from 'better-sqlite3';
import { PersistedConsentDecision } from './types.js';
import { nanoid } from 'nanoid';

// Use the same database path resolution logic as the main server
const defaultDbPath = process.env.MCP_DB_PATH || '../var/icn-mcp.sqlite';

let dbInstance: Database.Database | null = null;

function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }
  
  // Initialize database
  dbInstance = new Database(defaultDbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');
  
  return dbInstance;
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
  const id = nanoid();
  
  const decision: PersistedConsentDecision = {
    id,
    userId,
    toolName,
    resource,
    approved,
    message,
    riskLevel,
    timestamp: now,
    expiresAt,
    createdAt: now
  };
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO consent_decisions 
    (id, user_id, tool_name, resource, approved, message, risk_level, timestamp, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    decision.id,
    decision.userId,
    decision.toolName,
    decision.resource || null,
    decision.approved ? 1 : 0,
    decision.message || null,
    decision.riskLevel,
    decision.timestamp,
    decision.expiresAt || null,
    decision.createdAt
  );
  
  return decision;
}

/**
 * Check if consent exists for a specific user, tool, and resource
 */
export function checkPersistedConsent(
  userId: string,
  toolName: string,
  resource?: string
): PersistedConsentDecision | null {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  
  const stmt = db.prepare(`
    SELECT id, user_id, tool_name, resource, approved, message, risk_level, timestamp, expires_at, created_at
    FROM consent_decisions 
    WHERE user_id = ? AND tool_name = ? AND (resource = ? OR (resource IS NULL AND ? IS NULL))
    AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY created_at DESC
    LIMIT 1
  `);
  
  const row = stmt.get(userId, toolName, resource || null, resource || null, now) as any;
  
  if (!row) {
    return null;
  }
  
  return {
    id: row.id,
    userId: row.user_id,
    toolName: row.tool_name,
    resource: row.resource,
    approved: row.approved === 1,
    message: row.message,
    riskLevel: row.risk_level,
    timestamp: row.timestamp,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

/**
 * Revoke consent for a specific tool and user
 */
export function revokeConsent(
  userId: string,
  toolName: string,
  resource?: string
): boolean {
  const db = getDb();
  
  const stmt = db.prepare(`
    UPDATE consent_decisions 
    SET approved = 0, timestamp = ?
    WHERE user_id = ? AND tool_name = ? AND (resource = ? OR (resource IS NULL AND ? IS NULL))
  `);
  
  const now = Math.floor(Date.now() / 1000);
  const result = stmt.run(now, userId, toolName, resource || null, resource || null);
  
  return result.changes > 0;
}

/**
 * Get all consent decisions for a user
 */
export function getUserConsentHistory(userId: string): PersistedConsentDecision[] {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT id, user_id, tool_name, resource, approved, message, risk_level, timestamp, expires_at, created_at
    FROM consent_decisions 
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);
  
  const rows = stmt.all(userId) as any[];
  
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    toolName: row.tool_name,
    resource: row.resource,
    approved: row.approved === 1,
    message: row.message,
    riskLevel: row.risk_level,
    timestamp: row.timestamp,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  }));
}

/**
 * Clean up expired consent decisions
 */
export function cleanupExpiredConsent(): number {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  
  const stmt = db.prepare(`
    DELETE FROM consent_decisions 
    WHERE expires_at IS NOT NULL AND expires_at <= ?
  `);
  
  const result = stmt.run(now);
  return result.changes;
}