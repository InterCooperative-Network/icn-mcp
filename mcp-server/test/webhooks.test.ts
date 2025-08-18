import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoute, apiRoutes } from '@/api';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getTaskById } from '@/db';

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

  it('creates task from webhook with Task-ID marker in issue', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const taskId = 'task_abc123def';
    const payload = JSON.stringify({
      action: 'opened',
      repository: { full_name: 'InterCooperative-Network/icn-mcp' },
      sender: { login: 'octocat' },
      issue: {
        title: 'Test Issue',
        body: `This is a test issue.\n\nTask-ID: ${taskId}\n\nMore content here.`,
        html_url: 'https://github.com/test/repo/issues/123',
        number: 123
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'x-github-event': 'issues',
        'x-github-delivery': 'd3',
        'x-hub-signature-256': sign(payload, secret),
        'content-type': 'application/json'
      },
      payload
    });

    expect(res.statusCode).toBe(200);
    
    // Add small delay for database operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that task was created
    const task = getTaskById(taskId);
    expect(task).toBeTruthy();
    expect(task?.title).toBe('[ISSUES] Test Issue');
    expect(task?.description).toContain('Automated task created from issues event');
    expect(task?.description).toContain('octocat');
    
    await app.close();
  });

  it('creates task from PR webhook with Task-ID marker', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const taskId = 'task_pr_456ghi';
    const payload = JSON.stringify({
      action: 'opened',
      repository: { full_name: 'InterCooperative-Network/icn-mcp' },
      sender: { login: 'developer' },
      pull_request: {
        title: 'Feature: Add new functionality',
        body: `This PR adds new functionality.\n\nTask-ID: ${taskId}`,
        html_url: 'https://github.com/test/repo/pull/456',
        number: 456
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'x-github-event': 'pull_request',
        'x-github-delivery': 'd4',
        'x-hub-signature-256': sign(payload, secret),
        'content-type': 'application/json'
      },
      payload
    });

    expect(res.statusCode).toBe(200);
    
    // Check that task was created
    const task = getTaskById(taskId);
    expect(task).toBeTruthy();
    expect(task?.title).toBe('[PULL_REQUEST] Feature: Add new functionality');
    expect(task?.description).toContain('Automated task created from pull_request event');
    
    await app.close();
  });

  it('handles comment webhook with Task-ID marker', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const taskId = 'task_comment_789jkl';
    const payload = JSON.stringify({
      action: 'created',
      repository: { full_name: 'InterCooperative-Network/icn-mcp' },
      sender: { login: 'commenter' },
      issue: {
        title: 'Original Issue Title',
        html_url: 'https://github.com/test/repo/issues/789',
        number: 789
      },
      comment: {
        body: `Great idea! Let's track this.\n\nTask-ID: ${taskId}`,
        html_url: 'https://github.com/test/repo/issues/789#comment-123456'
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'x-github-event': 'issue_comment',
        'x-github-delivery': 'd5',
        'x-hub-signature-256': sign(payload, secret),
        'content-type': 'application/json'
      },
      payload
    });

    expect(res.statusCode).toBe(200);
    
    // Check that task was created
    const task = getTaskById(taskId);
    expect(task).toBeTruthy();
    expect(task?.title).toBe('[ISSUE_COMMENT] Comment on: Original Issue Title');
    expect(task?.description).toContain('Automated task created from issue_comment event');
    
    await app.close();
  });

  it('handles push webhook for existing task', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const taskId = 'task_push_999xyz';
    
    // First create a task
    const createPayload = JSON.stringify({
      action: 'opened',
      repository: { full_name: 'InterCooperative-Network/icn-mcp' },
      sender: { login: 'dev' },
      issue: {
        title: 'Task for push test',
        body: `Issue body\n\nTask-ID: ${taskId}`
      }
    });

    await app.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'x-github-event': 'issues',
        'x-github-delivery': 'd6a',
        'x-hub-signature-256': sign(createPayload, secret),
        'content-type': 'application/json'
      },
      payload: createPayload
    });

    // Now send push webhook
    const pushPayload = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { full_name: 'InterCooperative-Network/icn-mcp' },
      sender: { login: 'dev' },
      after: 'abc123def456',
      head_commit: {
        id: 'abc123def456',
        message: `Fix implementation\n\nTask-ID: ${taskId}`
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'x-github-event': 'push',
        'x-github-delivery': 'd6b',
        'x-hub-signature-256': sign(pushPayload, secret),
        'content-type': 'application/json'
      },
      payload: pushPayload
    });

    expect(res.statusCode).toBe(200);
    
    // Task should still exist
    const task = getTaskById(taskId);
    expect(task).toBeTruthy();
    
    await app.close();
  });

  it('does not create duplicate tasks for same Task-ID', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const taskId = 'task_duplicate_test';
    const payload = JSON.stringify({
      action: 'opened',
      repository: { full_name: 'InterCooperative-Network/icn-mcp' },
      sender: { login: 'octocat' },
      issue: {
        title: 'Test Issue',
        body: `Task-ID: ${taskId}`
      }
    });

    // Send first webhook
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'x-github-event': 'issues',
        'x-github-delivery': 'd7a',
        'x-hub-signature-256': sign(payload, secret),
        'content-type': 'application/json'
      },
      payload
    });

    // Send second webhook with same Task-ID
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'x-github-event': 'issues',
        'x-github-delivery': 'd7b',
        'x-hub-signature-256': sign(payload, secret),
        'content-type': 'application/json'
      },
      payload
    });

    expect(res.statusCode).toBe(200);
    
    // Should only have one task
    const task = getTaskById(taskId);
    expect(task).toBeTruthy();
    
    await app.close();
  });

  it('handles webhook without Task-ID gracefully', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    const payload = JSON.stringify({
      action: 'opened',
      repository: { full_name: 'InterCooperative-Network/icn-mcp' },
      sender: { login: 'octocat' },
      issue: {
        title: 'Issue without task ID',
        body: 'This issue has no Task-ID marker'
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'x-github-event': 'issues',
        'x-github-delivery': 'd8',
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


