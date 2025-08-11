import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoute, apiRoutes } from '@/api';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function sign(body: string, secret: string): string {
  const h = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${h}`;
}

describe('github webhooks', () => {
  const testDb = path.resolve(process.cwd(), `var/test-${Date.now()}-${Math.random()}.sqlite`);
  const secret = `test_${Math.random().toString(36).slice(2)}`;

  beforeEach(() => {
    process.env.MCP_DB_PATH = testDb;
    process.env.WEBHOOK_SECRET = secret;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
  });

  it('rejects invalid signature', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const payload = JSON.stringify({ action: 'opened', repository: { full_name: 'InterCooperative-Network/icn-mcp' } });
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'x-github-event': 'issues',
        'x-github-delivery': 'd1',
        'x-hub-signature-256': 'sha256=deadbeef',
        'content-type': 'application/json'
      },
      payload
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('accepts valid signature and logs event', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const payload = JSON.stringify({ action: 'opened', repository: { full_name: 'InterCooperative-Network/icn-mcp' }, sender: { login: 'octocat' } });
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'x-github-event': 'issues',
        'x-github-delivery': 'd2',
        'x-hub-signature-256': sign(payload, secret),
        'content-type': 'application/json'
      },
      payload
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    await app.close();
  });
});


