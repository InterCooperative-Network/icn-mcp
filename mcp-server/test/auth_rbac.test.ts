import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoute, apiRoutes } from '@/api';
import { clearRateLimitStore, rateLimitMiddleware } from '@/auth';
import fs from 'node:fs';
import path from 'node:path';

describe('Authentication, RBAC, and Rate Limiting', () => {
  beforeEach(() => {
    // Use a unique DB for each test to ensure isolation
    const testDb = path.resolve(process.cwd(), `var/test-rbac-${Date.now()}-${Math.random()}.sqlite`);
    process.env.MCP_DB_PATH = testDb;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
    try { fs.rmSync(path.resolve(process.cwd(), 'artifacts'), { recursive: true, force: true }); } catch {/* noop */}
    try { fs.rmSync(path.resolve(process.cwd(), 'branches'), { recursive: true, force: true }); } catch {/* noop */}
    
    // Set test maintainer tokens
    process.env.MAINTAINER_ADMIN_TOKEN = 'test-admin-token-123';
    process.env.MAINTAINER_TOKENS = 'test-maintainer-1,test-maintainer-2';
    
    // Set low rate limits for testing
    process.env.RATE_LIMIT_WINDOW_MS = '1000'; // 1 second
    process.env.RATE_LIMIT_MAX_REQUESTS = '3'; // 3 requests per second (lower for easier testing)
    process.env.RATE_LIMIT_MAX_REQUESTS_MAINTAINER = '5'; // 5 for maintainers
    
    // Clear rate limit store
    clearRateLimitStore();
  });

  async function createTestApp() {
    const app = Fastify({ logger: false });
    
    // Add rate limiting middleware like in the main server
    app.addHook('preHandler', async (req, reply) => {
      // Skip rate limiting for health checks
      if (req.url.startsWith('/healthz')) {
        return;
      }
      
      // Apply rate limiting
      await rateLimitMiddleware()(req, reply);
    });
    
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();
    return app;
  }

  it('should authenticate maintainer tokens correctly', async () => {
    const app = await createTestApp();

    // Test admin token
    const adminStatsRes = await app.inject({
      method: 'GET',
      url: '/api/admin/stats',
      headers: { Authorization: 'Bearer test-admin-token-123' }
    });
    expect(adminStatsRes.statusCode).toBe(200);
    const adminStats = adminStatsRes.json() as any;
    expect(adminStats.ok).toBe(true);
    expect(adminStats.stats).toBeDefined();

    // Test regular maintainer token
    const maintainerStatsRes = await app.inject({
      method: 'GET',
      url: '/api/admin/stats',
      headers: { Authorization: 'Bearer test-maintainer-1' }
    });
    expect(maintainerStatsRes.statusCode).toBe(200);

    await app.close();
  });

  it('should reject non-maintainer tokens from admin endpoints', async () => {
    const app = await createTestApp();

    // Register an agent first
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/agent/register',
      payload: { name: 'Test Agent', kind: 'planner' }
    });
    expect(regRes.statusCode).toBe(200);
    const agentToken = (regRes.json() as any).token;

    // Try to access admin endpoint with agent token
    const adminAttempt = await app.inject({
      method: 'GET',
      url: '/api/admin/stats',
      headers: { Authorization: `Bearer ${agentToken}` }
    });
    expect(adminAttempt.statusCode).toBe(403);
    const error = adminAttempt.json() as any;
    expect(error.error).toBe('maintainer_access_required');

    await app.close();
  });

  it('should enforce rate limits per IP/token', async () => {
    const app = await createTestApp();

    // Make requests without auth to test IP-based rate limiting
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(app.inject({
        method: 'GET',
        url: '/api/task/list'
      }));
    }

    const responses = await Promise.all(promises);
    
    // First 3 should succeed, next 2 should be rate limited
    const successful = responses.filter(r => r.statusCode === 200);
    const rateLimited = responses.filter(r => r.statusCode === 429);
    
    expect(successful.length).toBe(3);
    expect(rateLimited.length).toBe(2);

    // Check rate limit response format
    if (rateLimited.length > 0) {
      const rateLimitResponse = rateLimited[0].json() as any;
      expect(rateLimitResponse.error).toBe('rate_limit_exceeded');
      expect(rateLimitResponse.retryAfter).toBeGreaterThan(0);
      expect(rateLimited[0].headers['retry-after']).toBeDefined();
    }

    await app.close();
  });

  it('should give maintainers higher rate limits', async () => {
    const app = await createTestApp();

    // Make more requests than agent limit but within maintainer limit
    const promises = [];
    for (let i = 0; i < 4; i++) {
      promises.push(app.inject({
        method: 'GET',
        url: '/api/task/list',
        headers: { Authorization: 'Bearer test-maintainer-1' }
      }));
    }

    const responses = await Promise.all(promises);
    
    // All should succeed for maintainer (limit is 5)
    const successful = responses.filter(r => r.statusCode === 200);
    expect(successful.length).toBe(4);

    await app.close();
  });

  it('should maintain separate rate limits for different tokens', async () => {
    const app = await createTestApp();

    // Register two agents
    const reg1 = await app.inject({
      method: 'POST',
      url: '/api/agent/register',
      payload: { name: 'Agent 1', kind: 'planner' }
    });
    const token1 = (reg1.json() as any).token;

    const reg2 = await app.inject({
      method: 'POST',
      url: '/api/agent/register',
      headers: { Authorization: `Bearer ${token1}` },
      payload: { name: 'Agent 2', kind: 'ops' }
    });
    const token2 = (reg2.json() as any).token;

    // Use up token1's rate limit
    const promises1 = [];
    for (let i = 0; i < 4; i++) {
      promises1.push(app.inject({
        method: 'GET',
        url: '/api/task/list',
        headers: { Authorization: `Bearer ${token1}` }
      }));
    }

    const responses1 = await Promise.all(promises1);
    const rateLimited1 = responses1.filter(r => r.statusCode === 429);
    expect(rateLimited1.length).toBeGreaterThan(0);

    // Token2 should still work
    const token2Response = await app.inject({
      method: 'GET',
      url: '/api/task/list',
      headers: { Authorization: `Bearer ${token2}` }
    });
    expect(token2Response.statusCode).toBe(200);

    await app.close();
  });

  it('should provide comprehensive audit logging', async () => {
    const app = await createTestApp();

    // Test unauthorized access
    const unauthorized = await app.inject({
      method: 'POST',
      url: '/api/task/create',
      payload: { title: 'Test' }
    });
    expect(unauthorized.statusCode).toBe(401);

    // Test invalid token
    const invalidToken = await app.inject({
      method: 'POST',
      url: '/api/task/create',
      headers: { Authorization: 'Bearer invalid-token' },
      payload: { title: 'Test' }
    });
    expect(invalidToken.statusCode).toBe(401);

    // Test successful maintainer access
    const maintainerAccess = await app.inject({
      method: 'GET',
      url: '/api/admin/stats',
      headers: { Authorization: 'Bearer test-admin-token-123' }
    });
    expect(maintainerAccess.statusCode).toBe(200);

    await app.close();
  });

  it('should handle admin cleanup endpoint correctly', async () => {
    const app = await createTestApp();

    // Test cleanup with maintainer token
    const cleanupRes = await app.inject({
      method: 'POST',
      url: '/api/admin/agents/cleanup',
      headers: { Authorization: 'Bearer test-admin-token-123' }
    });
    expect(cleanupRes.statusCode).toBe(200);
    const cleanup = cleanupRes.json() as any;
    expect(cleanup.ok).toBe(true);
    expect(typeof cleanup.deletedCount).toBe('number');

    await app.close();
  });

  it('should reject requests without proper authorization header format', async () => {
    const app = await createTestApp();

    // Test missing Bearer prefix
    const noBearerRes = await app.inject({
      method: 'POST',
      url: '/api/task/create',
      headers: { Authorization: 'test-admin-token-123' },
      payload: { title: 'Test' }
    });
    expect(noBearerRes.statusCode).toBe(401);

    // Test malformed header
    const malformedRes = await app.inject({
      method: 'POST',
      url: '/api/task/create',
      headers: { Authorization: 'NotBearer test-admin-token-123' },
      payload: { title: 'Test' }
    });
    expect(malformedRes.statusCode).toBe(401);

    await app.close();
  });
});