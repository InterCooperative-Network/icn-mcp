import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoute, apiRoutes } from '@/api';
import fs from 'node:fs';
import path from 'node:path';

describe('github issue create', () => {
  const testDb = path.resolve(process.cwd(), `var/test-${Date.now()}-${Math.random()}.sqlite`);
  beforeEach(() => {
    process.env.MCP_DB_PATH = testDb;
    delete process.env.GITHUB_TOKEN;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
    try { fs.rmSync(path.resolve(process.cwd(), 'artifacts'), { recursive: true, force: true }); } catch {/* noop */}
  });

  it('creates a local issue artifact when no GH token', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // register agent for auth
    const reg = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'Planner', kind: 'planner' } });
    const token = (reg.json() as any).token;

    const res = await app.inject({ method: 'POST', url: '/api/gh/issue/create', headers: { Authorization: `Bearer ${token}` }, payload: { title: 'Test issue', body: 'Body' } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('local');
    expect(typeof body.artifact).toBe('string');
    expect(fs.existsSync(body.artifact)).toBe(true);

    await app.close();
  });
});


