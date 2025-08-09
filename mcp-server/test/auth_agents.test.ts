import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoute, apiRoutes } from '../src/api.js';
import fs from 'node:fs';
import path from 'node:path';

describe('agents and auth middleware', () => {
  const testDb = path.resolve(process.cwd(), `var/test-${Date.now()}-${Math.random()}.sqlite`);
  beforeEach(() => {
    process.env.MCP_DB_PATH = testDb;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
    try { fs.rmSync(path.resolve(process.cwd(), 'artifacts'), { recursive: true, force: true }); } catch {/* noop */}
    try { fs.rmSync(path.resolve(process.cwd(), 'branches'), { recursive: true, force: true }); } catch {/* noop */}
  });

  it('bootstrap register returns token; subsequent mutating calls require token', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Bootstrap: register without token
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/agent/register',
      payload: { name: 'Test Planner', kind: 'planner' }
    });
    expect(regRes.statusCode).toBe(200);
    const reg = regRes.json() as any;
    expect(reg.ok).toBe(true);
    expect(reg.token).toBeTruthy();

    // Now mutating endpoint without token should be unauthorized
    const noAuthTask = await app.inject({ method: 'POST', url: '/api/task/create', payload: { title: 'Nope' } });
    expect(noAuthTask.statusCode).toBe(401);

    // With token should work
    const okTask = await app.inject({
      method: 'POST',
      url: '/api/task/create',
      headers: { Authorization: `Bearer ${reg.token}` },
      payload: { title: 'Yay' }
    });
    expect(okTask.statusCode).toBe(200);
    const created = okTask.json() as any;
    expect(created.id).toBeTruthy();

    // Second register now requires token
    const reg2NoAuth = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'A2', kind: 'ops' } });
    expect(reg2NoAuth.statusCode).toBe(401);

    const reg2 = await app.inject({
      method: 'POST',
      url: '/api/agent/register',
      headers: { Authorization: `Bearer ${reg.token}` },
      payload: { name: 'Agent 2', kind: 'ops' }
    });
    expect(reg2.statusCode).toBe(200);
    const reg2Json = reg2.json() as any;
    expect(reg2Json.token).toBeTruthy();

    await app.close();
  });
});


