import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoute, apiRoutes } from '../src/api.js';
import fs from 'node:fs';
import path from 'node:path';

describe('task api', () => {
  const testDb = path.resolve(process.cwd(), `var/test-${Date.now()}.sqlite`);
  beforeEach(() => {
    process.env.MCP_DB_PATH = testDb;
    try { fs.unlinkSync(testDb); } catch {}
  });

  it('creates and lists tasks', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/task/create',
      payload: { title: 'Test Task' }
    });
    expect(createRes.statusCode).toBe(200);
    const created = createRes.json() as any;
    expect(created.id).toBeTruthy();

    const listRes = await app.inject({ method: 'GET', url: '/api/task/list' });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as any[];
    expect(list.some((t) => t.id === created.id)).toBe(true);

    await app.close();
  });
});


