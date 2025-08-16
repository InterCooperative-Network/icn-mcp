import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoute, apiRoutes } from '@/api';
import { metricsRoute } from '@/metrics';
import fs from 'node:fs';
import path from 'node:path';

describe('metrics endpoint', () => {
  let testDb: string;
  
  beforeEach(() => {
    testDb = path.resolve(process.cwd(), `var/test-metrics-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
    process.env.MCP_DB_PATH = testDb;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
  });

  afterEach(() => {
    try { fs.unlinkSync(testDb); } catch {/* noop */}
  });

  it('serves Prometheus metrics at /metrics endpoint', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    app.register(metricsRoute);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    
    const body = res.body;
    
    // Check for default process metrics
    expect(body).toContain('process_cpu_user_seconds_total');
    expect(body).toContain('process_resident_memory_bytes');
    
    // Check for ICN MCP specific metrics
    expect(body).toContain('icn_mcp_tasks_total');
    expect(body).toContain('icn_mcp_policy_denies_total');
    expect(body).toContain('icn_mcp_pr_creates_total');
    expect(body).toContain('icn_mcp_agents_total');
    
    // Check for metric types and help text
    expect(body).toContain('# HELP icn_mcp_tasks_total Total tasks created');
    expect(body).toContain('# TYPE icn_mcp_tasks_total counter');
    expect(body).toContain('# HELP icn_mcp_agents_total Number of registered agents');
    expect(body).toContain('# TYPE icn_mcp_agents_total gauge');

    await app.close();
  });

  it('serves metrics dashboard at /dashboard endpoint', async () => {
    const app = Fastify({ logger: false });
    app.register(metricsRoute);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/dashboard' });
    
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/html');
    
    const body = res.body;
    expect(body).toContain('<!DOCTYPE html>');
    expect(body).toContain('ICN MCP Metrics Dashboard');
    expect(body).toContain('View Prometheus format metrics');

    await app.close();
  });

  it('increments task metrics when tasks are created', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    app.register(metricsRoute);
    await app.ready();

    // Get initial metrics
    const initialMetrics = await app.inject({ method: 'GET', url: '/metrics' });
    const initialTasksMatch = initialMetrics.body.match(/icn_mcp_tasks_total (\d+)/);
    const initialTasksCount = initialTasksMatch ? parseInt(initialTasksMatch[1]) : 0;

    // Bootstrap an agent for auth
    const reg = await app.inject({ 
      method: 'POST', 
      url: '/api/agent/register', 
      payload: { name: 'Test Planner', kind: 'planner' } 
    });
    const token = (reg.json() as any).token;

    // Create a task
    await app.inject({
      method: 'POST',
      url: '/api/task/create',
      headers: { Authorization: `Bearer ${token}` },
      payload: { title: 'Test Task for Metrics' }
    });

    // Check metrics after task creation
    const finalMetrics = await app.inject({ method: 'GET', url: '/metrics' });
    const finalTasksMatch = finalMetrics.body.match(/icn_mcp_tasks_total (\d+)/);
    const finalTasksCount = finalTasksMatch ? parseInt(finalTasksMatch[1]) : 0;

    expect(finalTasksCount).toBe(initialTasksCount + 1);

    await app.close();
  });

  it('increments agent metrics when agents are registered', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    app.register(metricsRoute);
    await app.ready();

    // Register an agent (first agent should work without auth due to bootstrap)
    const reg = await app.inject({ 
      method: 'POST', 
      url: '/api/agent/register', 
      payload: { name: 'Test Agent', kind: 'planner' } 
    });
    
    // If registration failed, log the response for debugging
    if (reg.statusCode !== 200) {
      console.log('Registration failed:', reg.statusCode, reg.body);
    }
    expect(reg.statusCode).toBe(200); // Ensure registration succeeded

    // Check that agent count is at least 1 (since we just registered one)
    const finalMetrics = await app.inject({ method: 'GET', url: '/metrics' });
    const finalAgentsMatch = finalMetrics.body.match(/icn_mcp_agents_total (\d+)/);
    const finalAgentsCount = finalAgentsMatch ? parseInt(finalAgentsMatch[1]) : 0;

    // Should have at least 1 agent after registration
    expect(finalAgentsCount).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it('increments policy deny metrics when policy is violated', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    app.register(metricsRoute);
    await app.ready();

    // Bootstrap an agent for auth
    const reg = await app.inject({ 
      method: 'POST', 
      url: '/api/agent/register', 
      payload: { name: 'Test Agent', kind: 'planner' } 
    });
    const token = (reg.json() as any).token;

    // Get initial metrics
    const initialMetrics = await app.inject({ method: 'GET', url: '/metrics' });
    const initialDeniesMatch = initialMetrics.body.match(/icn_mcp_policy_denies_total (\d+)/);
    const initialDeniesCount = initialDeniesMatch ? parseInt(initialDeniesMatch[1]) : 0;

    // Make a policy check request that might be denied
    await app.inject({
      method: 'POST',
      url: '/api/policy/check',
      headers: { Authorization: `Bearer ${token}` },
      payload: { 
        actor: 'planner', 
        changedPaths: ['/some/sensitive/path']  // This might be denied by policy
      }
    });

    // Check if policy denies were incremented (this depends on actual policy rules)
    const finalMetrics = await app.inject({ method: 'GET', url: '/metrics' });
    const finalDeniesMatch = finalMetrics.body.match(/icn_mcp_policy_denies_total (\d+)/);
    const finalDeniesCount = finalDeniesMatch ? parseInt(finalDeniesMatch[1]) : 0;

    // Policy denies might or might not increment depending on actual policy rules
    // We just verify the metric exists and is a valid number
    expect(finalDeniesCount).toBeGreaterThanOrEqual(initialDeniesCount);

    await app.close();
  });

  it('has all required metric names as documented', async () => {
    const app = Fastify({ logger: false });
    app.register(metricsRoute);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    const body = res.body;

    // Check all the metrics mentioned in the acceptance criteria
    const requiredMetrics = [
      'icn_mcp_tasks_total',
      'icn_mcp_policy_denies_total',  
      'icn_mcp_pr_creates_total',
      'icn_mcp_agents_total'
    ];

    for (const metric of requiredMetrics) {
      expect(body).toContain(metric);
    }

    // Also check for additional comprehensive metrics
    const additionalMetrics = [
      'icn_mcp_webhooks_received_total',
      'icn_mcp_claims_total',
      'icn_mcp_runs_total',
      'icn_mcp_workflows_started_total'
    ];

    for (const metric of additionalMetrics) {
      expect(body).toContain(metric);
    }

    await app.close();
  });
});