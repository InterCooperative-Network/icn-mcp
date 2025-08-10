import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { apiRoutes, healthRoute } from '../src/api.js';
import fs from 'node:fs';
import path from 'node:path';

describe('policy check', () => {
  const testDb = path.resolve(process.cwd(), `var/test-${Date.now()}.sqlite`);
  beforeEach(() => {
    process.env.MCP_DB_PATH = testDb;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
  });

  it('denies when path not allowed and allows when allowed', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Bootstrap an architect agent and get token
    const reg = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'Arch', kind: 'architect' } });
    const token = (reg.json() as any).token;

    // Deny: planner cannot modify docs/** per default rules
    const denyRes = await app.inject({
      method: 'POST',
      url: '/api/policy/check',
      headers: { Authorization: `Bearer ${token}` },
      payload: { actor: 'planner', changedPaths: ['docs/api/readme.md'] }
    });
    expect(denyRes.statusCode).toBe(200);
    const deny = denyRes.json() as any;
    expect(deny.allow).toBe(false);

    // Allow: architect can modify docs/** (using a path that doesn't require special reviews)
    const allowRes = await app.inject({
      method: 'POST',
      url: '/api/policy/check',
      headers: { Authorization: `Bearer ${token}` },
      payload: { actor: 'architect', changedPaths: ['docs/api/readme.md'] }
    });
    expect(allowRes.statusCode).toBe(200);
    const allow = allowRes.json() as any;
    expect(allow.allow).toBe(true);

    await app.close();
  });
});


