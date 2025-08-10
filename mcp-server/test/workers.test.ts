import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoute, apiRoutes } from '../src/api.js';
import fs from 'node:fs';
import path from 'node:path';

describe('workers protocol', () => {
  const testDb = path.resolve(process.cwd(), `var/test-${Date.now()}-${Math.random()}.sqlite`);
  beforeEach(() => {
    process.env.MCP_DB_PATH = testDb;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
  });

  it('complete worker lifecycle: claim → run → status', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Bootstrap: add agent and task
    const reg = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'Worker', kind: 'ops' } });
    const token = (reg.json() as any).token;
    await app.inject({ method: 'POST', url: '/api/task/create', headers: { Authorization: `Bearer ${token}` }, payload: { title: 'Do work' } });

    // Step 1: Claim task
    const claim = await app.inject({ method: 'POST', url: '/api/task/claim', headers: { Authorization: `Bearer ${token}` } });
    expect(claim.statusCode).toBe(200);
    const claimBody = claim.json() as any;
    expect(claimBody.task_id).toBeTruthy();
    expect(claimBody.title).toBe('Do work');

    // Step 2: Report run progress
    const run = await app.inject({ 
      method: 'POST', 
      url: '/api/task/run', 
      headers: { Authorization: `Bearer ${token}` }, 
      payload: { task_id: claimBody.task_id, status: 'in_progress', notes: 'starting work' } 
    });
    expect(run.statusCode).toBe(200);
    const runBody = run.json() as any;
    expect(runBody.ok).toBe(true);

    // Step 3: Check status
    const status = await app.inject({ method: 'GET', url: `/api/task/status?task_id=${encodeURIComponent(claimBody.task_id)}` });
    expect(status.statusCode).toBe(200);
    const statusBody = status.json() as any;
    expect(statusBody.id).toBe(claimBody.task_id);
    expect(statusBody.status).toBeTruthy();

    await app.close();
  });

  it('worker endpoint validation and error cases', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Test unauthorized access
    const claimUnauth = await app.inject({ method: 'POST', url: '/api/task/claim' });
    expect(claimUnauth.statusCode).toBe(401);

    const runUnauth = await app.inject({ method: 'POST', url: '/api/task/run', payload: { task_id: 'test', status: 'test' } });
    expect(runUnauth.statusCode).toBe(401);

    // Test status endpoint without task_id
    const statusNoId = await app.inject({ method: 'GET', url: '/api/task/status' });
    expect(statusNoId.statusCode).toBe(400);
    const errorBody = statusNoId.json() as any;
    expect(errorBody.error).toBe('task_id_required');

    // Test status endpoint with non-existent task
    const statusNotFound = await app.inject({ method: 'GET', url: '/api/task/status?task_id=nonexistent' });
    expect(statusNotFound.statusCode).toBe(404);
    const notFoundBody = statusNotFound.json() as any;
    expect(notFoundBody.error).toBe('not_found');

    await app.close();
  });

  it('claim returns no tasks when none available', async () => {
    // Use a unique DB path for this test to avoid interference
    const uniqueTestDb = path.resolve(process.cwd(), `var/test-notasks-${Date.now()}-${Math.random()}.sqlite`);
    process.env.MCP_DB_PATH = uniqueTestDb;
    try { fs.unlinkSync(uniqueTestDb); } catch {/* noop */}
    
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Create agent but no tasks - use bootstrap mode
    const reg = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'Worker', kind: 'ops' } });
    expect(reg.statusCode).toBe(200);
    const regBody = reg.json() as any;
    expect(regBody.token).toBeTruthy();

    const claim = await app.inject({ method: 'POST', url: '/api/task/claim', headers: { Authorization: `Bearer ${regBody.token}` } });
    expect(claim.statusCode).toBe(200);
    const body = claim.json() as any;
    expect(body.error).toBe('no_available_tasks');

    await app.close();
  });
});


