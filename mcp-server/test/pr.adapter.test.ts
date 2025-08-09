import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { apiRoutes, healthRoute } from '../src/api.js';
import fs from 'node:fs';
import path from 'node:path';

describe('PR adapter', () => {
  const testDb = path.resolve(process.cwd(), `var/test-${Date.now()}-${Math.random()}.sqlite`);
  beforeEach(() => {
    process.env.MCP_DB_PATH = testDb;
    delete process.env.GITHUB_TOKEN;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
    try { fs.rmSync(path.resolve(process.cwd(), 'artifacts'), { recursive: true, force: true }); } catch {/* noop */}
    try { fs.rmSync(path.resolve(process.cwd(), 'branches'), { recursive: true, force: true }); } catch {/* noop */}
  });

  it('falls back to local artifact when GH env not set', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Register architect agent for policy allow on docs/**
    const reg = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'Arch', kind: 'architect' } });
    const token = (reg.json() as any).token;

    const taskId = 'task_test';
    const prRes = await app.inject({
      method: 'POST',
      url: '/api/pr/create',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        task_id: taskId,
        title: 'Update docs file',
        body: 'Testing local PR artifact',
        files: [{ path: 'docs/example.md', content: '# Example' }]
      }
    });
    expect(prRes.statusCode).toBe(200);
    const body = prRes.json() as any;
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('local');
    expect(typeof body.artifact).toBe('string');
    expect(fs.existsSync(body.artifact)).toBe(true);

    await app.close();
  });
});


