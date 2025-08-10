import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoute, apiRoutes } from '../src/api.js';
import { insertTask, insertDep } from '../src/db.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'crypto';

describe('context brief', () => {
  const testDb = path.resolve(process.cwd(), `var/test-${Date.now()}-${randomUUID()}.sqlite`);
  beforeEach(() => {
    process.env.MCP_DB_PATH = testDb;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
  });

  it('returns a brief for a valid task id', async () => {
    const { id } = insertTask({ title: 'Demo', description: 'Implement feature X' });
    insertDep({ task_id: id, depends_on: 'RFC-123' });

    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: `/api/context/brief?task_id=${encodeURIComponent(id)}` });
    expect(res.statusCode).toBe(200);
    const brief = res.json() as any;
    expect(brief.task.id).toBe(id);
    expect(Array.isArray(brief.steps)).toBe(true);

    await app.close();
  });

  it('returns complete brief structure with all required fields', async () => {
    // Use a unique DB path for this test to avoid interference
    const uniqueTestDb = path.resolve(process.cwd(), `var/test-brief-${Date.now()}-${randomUUID()}.sqlite`);
    process.env.MCP_DB_PATH = uniqueTestDb;
    try { fs.unlinkSync(uniqueTestDb); } catch {/* noop */}
    
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Create task via API instead of direct DB call to avoid readonly issue
    const reg = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'Tester', kind: 'architect' } });
    expect(reg.statusCode).toBe(200);
    const token = (reg.json() as any).token;
    const taskRes = await app.inject({ 
      method: 'POST', 
      url: '/api/task/create', 
      headers: { Authorization: `Bearer ${token}` }, 
      payload: { title: 'Test Task', description: 'A test task for validation' } 
    });
    expect(taskRes.statusCode).toBe(200);
    const taskId = (taskRes.json() as any).id;
    expect(taskId).toBeTruthy();

    const res = await app.inject({ method: 'GET', url: `/api/context/brief?task_id=${encodeURIComponent(taskId)}` });
    if (res.statusCode !== 200) {
      console.log('Brief error response:', res.json());
    }
    expect(res.statusCode).toBe(200);
    
    const brief = res.json() as any;
    
    // Validate task section
    expect(brief.task).toBeTruthy();
    expect(brief.task.id).toBe(taskId);
    expect(brief.task.title).toBe('Test Task');
    expect(Array.isArray(brief.task.acceptance)).toBe(true);
    
    // Validate repo section
    expect(brief.repo).toBeTruthy();
    expect(brief.repo.owner).toBeTruthy();
    expect(brief.repo.repo).toBeTruthy();
    expect(Array.isArray(brief.repo.paths)).toBe(true);
    
    // Validate starter_files section
    expect(Array.isArray(brief.starter_files)).toBe(true);
    if (brief.starter_files.length > 0) {
      expect(brief.starter_files[0]).toHaveProperty('path');
      expect(brief.starter_files[0]).toHaveProperty('hint');
    }
    
    // Validate policy section
    expect(brief.policy).toBeTruthy();
    expect(Array.isArray(brief.policy.caps_required)).toBe(true);
    expect(Array.isArray(brief.policy.write_scopes)).toBe(true);
    
    // Validate steps section
    expect(Array.isArray(brief.steps)).toBe(true);
    expect(brief.steps.length).toBeGreaterThan(0);
    
    // Validate conventions section
    expect(brief.conventions).toBeTruthy();
    expect(brief.conventions.commit_format).toBeTruthy();
    expect(Array.isArray(brief.conventions.test_patterns)).toBe(true);

    await app.close();
  });

  it('404 for missing task', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: `/api/context/brief?task_id=task_missing` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('400 when task_id parameter is missing', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: `/api/context/brief` });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.error).toBe('task_id_required');
    
    await app.close();
  });
});


