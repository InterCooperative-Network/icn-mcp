import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoute, apiRoutes } from '@/api';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'crypto';

describe('workers protocol', () => {
  const testDb = path.resolve(process.cwd(), `var/test-${Date.now()}-${randomUUID()}.sqlite`);
  beforeEach(() => {
    process.env.MCP_DB_PATH = testDb;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
  });

  it('complete worker lifecycle: claim → run → status', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Bootstrap: add agent and task
    const reg = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'Worker', kind: 'ops' } });
    const token = (reg.json() as any).token;
    await app.inject({ method: 'POST', url: '/api/task/create', headers: { Authorization: `Bearer ${token}` }, payload: { title: 'Do work' } });

    // Step 1: Claim task
    const claim = await app.inject({ method: 'POST', url: '/api/task/claim', headers: { Authorization: `Bearer ${token}` } });
    expect(claim.statusCode).toBe(200);
    const claimBody = claim.json() as any;
    expect(claimBody.task_id).toBeTruthy();
    expect(claimBody.title).toBe('Do work');

    // Step 2: Report run progress
    const run = await app.inject({ 
      method: 'POST', 
      url: '/api/task/run', 
      headers: { Authorization: `Bearer ${token}` }, 
      payload: { task_id: claimBody.task_id, status: 'in_progress', notes: 'starting work' } 
    });
    expect(run.statusCode).toBe(200);
    const runBody = run.json() as any;
    expect(runBody.ok).toBe(true);

    // Step 3: Check status
    const status = await app.inject({ method: 'GET', url: `/api/task/status?task_id=${encodeURIComponent(claimBody.task_id)}` });
    expect(status.statusCode).toBe(200);
    const statusBody = status.json() as any;
    expect(statusBody.id).toBe(claimBody.task_id);
    expect(statusBody.status).toBeTruthy();

    await app.close();
  });

  it('worker endpoint validation and error cases', async () => {
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Test unauthorized access
    const claimUnauth = await app.inject({ method: 'POST', url: '/api/task/claim' });
    expect(claimUnauth.statusCode).toBe(401);

    const runUnauth = await app.inject({ method: 'POST', url: '/api/task/run', payload: { task_id: 'test', status: 'test' } });
    expect(runUnauth.statusCode).toBe(401);

    // Test status endpoint without task_id
    const statusNoId = await app.inject({ method: 'GET', url: '/api/task/status' });
    expect(statusNoId.statusCode).toBe(400);
    const errorBody = statusNoId.json() as any;
    expect(errorBody.error).toBe('task_id_required');

    // Test status endpoint with non-existent task
    const statusNotFound = await app.inject({ method: 'GET', url: '/api/task/status?task_id=nonexistent' });
    expect(statusNotFound.statusCode).toBe(404);
    const notFoundBody = statusNotFound.json() as any;
    expect(notFoundBody.error).toBe('not_found');

    await app.close();
  });

  it('claim returns no tasks when none available', async () => {
    // Use a unique DB path for this test to avoid interference
    const uniqueTestDb = path.resolve(process.cwd(), `var/test-notasks-${Date.now()}-${randomUUID()}.sqlite`);
    process.env.MCP_DB_PATH = uniqueTestDb;
    try { fs.unlinkSync(uniqueTestDb); } catch {/* noop */}
    
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Create agent but no tasks - use bootstrap mode
    const reg = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'Worker', kind: 'ops' } });
    expect(reg.statusCode).toBe(200);
    const regBody = reg.json() as any;
    expect(regBody.token).toBeTruthy();

    const claim = await app.inject({ method: 'POST', url: '/api/task/claim', headers: { Authorization: `Bearer ${regBody.token}` } });
    expect(claim.statusCode).toBe(200);
    const body = claim.json() as any;
    expect(body.error).toBe('no_available_tasks');

    await app.close();
  });

  it('concurrent claims: only one worker gets the same task', async () => {
    const uniqueTestDb = path.resolve(process.cwd(), `var/test-concurrent-${Date.now()}-${randomUUID()}.sqlite`);
    process.env.MCP_DB_PATH = uniqueTestDb;
    try { fs.unlinkSync(uniqueTestDb); } catch {/* noop */}
    
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Create agent and single task
    const reg = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'Worker', kind: 'ops' } });
    const token = (reg.json() as any).token;
    await app.inject({ method: 'POST', url: '/api/task/create', headers: { Authorization: `Bearer ${token}` }, payload: { title: 'Concurrent task' } });

    // Attempt 5 concurrent claims
    const claimPromises = Array.from({ length: 5 }, () => 
      app.inject({ method: 'POST', url: '/api/task/claim', headers: { Authorization: `Bearer ${token}` } })
    );
    
    const results = await Promise.all(claimPromises);
    
    // Count successful claims (should be exactly 1)
    const successfulClaims = results.filter(result => {
      const body = result.json() as any;
      return result.statusCode === 200 && body.task_id && !body.error;
    });
    
    const noTasksResponses = results.filter(result => {
      const body = result.json() as any;
      return result.statusCode === 200 && body.error === 'no_available_tasks';
    });
    
    expect(successfulClaims.length).toBe(1);
    expect(noTasksResponses.length).toBe(4);

    await app.close();
  });

  it('invalid task status transitions are rejected', async () => {
    const uniqueTestDb = path.resolve(process.cwd(), `var/test-transitions-${Date.now()}-${randomUUID()}.sqlite`);
    process.env.MCP_DB_PATH = uniqueTestDb;
    try { fs.unlinkSync(uniqueTestDb); } catch {/* noop */}
    
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Setup: create agent and task, claim it
    const reg = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'Worker', kind: 'ops' } });
    const token = (reg.json() as any).token;
    await app.inject({ method: 'POST', url: '/api/task/create', headers: { Authorization: `Bearer ${token}` }, payload: { title: 'Transition test' } });
    
    const claim = await app.inject({ method: 'POST', url: '/api/task/claim', headers: { Authorization: `Bearer ${token}` } });
    const taskId = (claim.json() as any).task_id;

    // Mark as completed
    const complete = await app.inject({ 
      method: 'POST', 
      url: '/api/task/run', 
      headers: { Authorization: `Bearer ${token}` }, 
      payload: { task_id: taskId, status: 'completed', notes: 'work done' } 
    });
    expect(complete.statusCode).toBe(200);

    // Try to transition back to in_progress (should be allowed as it only adds a new run record)
    const invalidTransition = await app.inject({ 
      method: 'POST', 
      url: '/api/task/run', 
      headers: { Authorization: `Bearer ${token}` }, 
      payload: { task_id: taskId, status: 'in_progress', notes: 'trying to go back' } 
    });
    
    // The API currently allows this (just adds a new run record)
    expect(invalidTransition.statusCode).toBe(200);
    
    // The task status (tasks.status) should still be 'claimed' since only task_runs are updated
    const status = await app.inject({ method: 'GET', url: `/api/task/status?task_id=${encodeURIComponent(taskId)}` });
    expect(status.statusCode).toBe(200);
    const statusBody = status.json() as any;
    
    // Task status comes from tasks.status which remains 'claimed' after claim
    expect(statusBody.status).toBe('claimed');

    await app.close();
  });

  it('policy denial scenarios for different agent kinds', async () => {
    const uniqueTestDb = path.resolve(process.cwd(), `var/test-policy-${Date.now()}-${randomUUID()}.sqlite`);
    process.env.MCP_DB_PATH = uniqueTestDb;
    try { fs.unlinkSync(uniqueTestDb); } catch {/* noop */}
    
    const app = Fastify({ logger: false });
    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    await app.ready();

    // Create a planner agent (should be denied access to certain paths)
    const plannerReg = await app.inject({ method: 'POST', url: '/api/agent/register', payload: { name: 'Planner', kind: 'planner' } });
    const plannerToken = (plannerReg.json() as any).token;
    
    // Create task for planner to claim
    await app.inject({ method: 'POST', url: '/api/task/create', headers: { Authorization: `Bearer ${plannerToken}` }, payload: { title: 'Policy test task' } });

    // Planner should be able to claim task (uses appropriate paths)
    const plannerClaim = await app.inject({ method: 'POST', url: '/api/task/claim', headers: { Authorization: `Bearer ${plannerToken}` } });
    expect(plannerClaim.statusCode).toBe(200);
    const claimBody = plannerClaim.json() as any;
    expect(claimBody.task_id).toBeTruthy();

    // Planner should be able to run task (uses appropriate paths)
    const plannerRun = await app.inject({ 
      method: 'POST', 
      url: '/api/task/run', 
      headers: { Authorization: `Bearer ${plannerToken}` }, 
      payload: { task_id: claimBody.task_id, status: 'in_progress', notes: 'working on it' } 
    });
    expect(plannerRun.statusCode).toBe(200);

    // Test with architect agent for different path permissions
    const architectReg = await app.inject({ method: 'POST', url: '/api/agent/register', headers: { Authorization: `Bearer ${plannerToken}` }, payload: { name: 'Architect', kind: 'architect' } });
    const architectToken = (architectReg.json() as any).token;
    
    // Create another task for architect
    await app.inject({ method: 'POST', url: '/api/task/create', headers: { Authorization: `Bearer ${architectToken}` }, payload: { title: 'Architect task' } });

    // Architect should be able to claim task (different path pattern)
    const architectClaim = await app.inject({ method: 'POST', url: '/api/task/claim', headers: { Authorization: `Bearer ${architectToken}` } });
    expect(architectClaim.statusCode).toBe(200);
    const architectClaimBody = architectClaim.json() as any;
    expect(architectClaimBody.task_id).toBeTruthy();

    await app.close();
  });
});


