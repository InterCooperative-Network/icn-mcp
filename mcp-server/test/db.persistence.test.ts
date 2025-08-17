import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  getDb, 
  insertTask,
  claimTask
} from '@/db';
import fs from 'node:fs';
import path from 'node:path';

describe('Database Persistence and Concurrency', () => {
  const testDbPath = path.resolve(process.cwd(), 'test-db-concurrency.sqlite');
  
  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    process.env.MCP_DB_PATH = testDbPath;
  });

  afterEach(() => {
    // Don't call closeDb since it doesn't exist in the JS version
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    delete process.env.MCP_DB_PATH;
  });

  it('should create database file and apply migrations', () => {
    const db = getDb();
    expect(fs.existsSync(testDbPath)).toBe(true);
    
    // Check that basic tables exist  
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'").all();
    expect(tables).toHaveLength(1);
  });

  it('should handle concurrent task claiming safely', () => {
    // Create a task
    const task = insertTask({ title: 'Test Concurrent Task', description: 'Testing concurrency' });
    const agentId1 = 'agent1';
    const agentId2 = 'agent2';

    // Both agents try to claim the same task
    const claim1 = claimTask(task.id, agentId1);
    const claim2 = claimTask(task.id, agentId2);

    // Only one should succeed
    expect(claim1 !== claim2).toBe(true);
    expect(claim1 || claim2).toBe(true);
  });

  it('should perform basic database operations', () => {
    const db = getDb();
    
    // First call should be healthy
    expect(() => getDb()).not.toThrow();
    
    // Multiple calls should reuse connection
    const db2 = getDb();
    expect(db2).toBe(db);
  });
});