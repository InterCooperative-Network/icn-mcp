import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoute, apiRoutes } from '../src/api.js';
import { insertTask, insertDep } from '../src/db.js';
import fs from 'node:fs';
import path from 'node:path';

describe('context brief', () => {
  const testDb = path.resolve(process.cwd(), `var/test-${Date.now()}-${Math.random()}.sqlite`);
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

  it('404 for missing task', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: `/api/context/brief?task_id=task_missing` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});


