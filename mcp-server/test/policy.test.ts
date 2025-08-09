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

    // Deny: planner cannot modify docs/** per default rules
    const denyRes = await app.inject({
      method: 'POST',
      url: '/api/policy/check',
      payload: { actor: 'planner', changedPaths: ['docs/protocols/x.md'] }
    });
    expect(denyRes.statusCode).toBe(200);
    const deny = denyRes.json() as any;
    expect(deny.allow).toBe(false);

    // Allow: architect can modify docs/**
    const allowRes = await app.inject({
      method: 'POST',
      url: '/api/policy/check',
      payload: { actor: 'architect', changedPaths: ['docs/protocols/x.md'] }
    });
    expect(allowRes.statusCode).toBe(200);
    const allow = allowRes.json() as any;
    expect(allow.allow).toBe(true);

    await app.close();
  });
});


