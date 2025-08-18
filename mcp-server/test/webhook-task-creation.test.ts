import { describe, it, expect, beforeEach } from 'vitest';
import { insertTask, getTaskById } from '@/db';
import fs from 'node:fs';
import path from 'node:path';

describe('task creation with custom ID', () => {
  const testDb = path.resolve(process.cwd(), `var/test-${Date.now()}-${Math.random()}.sqlite`);

  beforeEach(() => {
    process.env.MCP_DB_PATH = testDb;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
  });

  it('can create task with custom ID', () => {
    const taskId = 'task_test123abc';
    const title = 'Test Task';
    const description = 'Test description';
    const createdBy = 'test-user';

    const result = insertTask({ id: taskId, title, description, created_by: createdBy });
    expect(result.id).toBe(taskId);

    const retrieved = getTaskById(taskId);
    expect(retrieved).toBeTruthy();
    expect(retrieved?.id).toBe(taskId);
    expect(retrieved?.title).toBe(title);
    expect(retrieved?.description).toBe(description);
  });

  it('creates task with generated ID when no ID provided', () => {
    const title = 'Generated ID Task';
    const result = insertTask({ title });
    expect(result.id).toMatch(/^task_/);

    const retrieved = getTaskById(result.id);
    expect(retrieved).toBeTruthy();
    expect(retrieved?.title).toBe(title);
  });
});