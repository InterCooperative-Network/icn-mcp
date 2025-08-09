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

  it('agent claims an open task and reports run steps', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Bootstrap: add agent and task
    const reg = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'Worker', kind: 'ops' } });
    const token = (reg.json() as any).token;
    await app.inject({ method: 'POST', url: '/api/task/create', headers: { Authorization: `Bearer ${token}` }, payload: { title: 'Do work' } });

    const claim = await app.inject({ method: 'POST', url: '/api/task/claim', headers: { Authorization: `Bearer ${token}` } });
    expect(claim.statusCode).toBe(200);
    const body = claim.json() as any;
    expect(body.task_id).toBeTruthy();

    const run = await app.inject({ method: 'POST', url: '/api/task/run', headers: { Authorization: `Bearer ${token}` }, payload: { task_id: body.task_id, status: 'in_progress', notes: 'starting' } });
    expect(run.statusCode).toBe(200);

    const status = await app.inject({ method: 'GET', url: `/api/task/status?task_id=${encodeURIComponent(body.task_id)}` });
    expect(status.statusCode).toBe(200);
    const sbody = status.json() as any;
    expect(sbody.status === 'claimed' || sbody.status === 'open' || sbody.status === 'in_progress').toBe(true);

    await app.close();
  });
});


