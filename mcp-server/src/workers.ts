import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getNextOpenTask, markTaskClaimed, getTaskStatus } from './workers_db.js';
import { insertRun } from './db.js';
import { requireAuth } from './auth.js';
import { checkPolicy } from './policy.js';
import { policyDeniesTotal, claimsTotal, runsTotal } from './metrics.js';

function getAgentPaths(agentKind: string, taskId: string): string[] {
  switch (agentKind) {
    case 'planner':
      return [`tasks/${taskId}`, `docs/tasks/${taskId}.md`];
    case 'architect':
      return [`docs/architecture/${taskId}.md`, `mcp-server/src/types.ts`];
    case 'reviewer':
      return [`docs/${taskId}.md`, `.github/workflows/${taskId}.yml`];
    case 'ops':
      return [`.github/workflows/${taskId}.yml`, `tools/ci/${taskId}.js`];
    default:
      return [`docs/${taskId}.md`];
  }
}

export async function workersRoute(f: FastifyInstance) {
  const Claim = z.object({});
  f.post('/task/claim', { preHandler: requireAuth() }, async (req, reply) => {
    Claim.parse(req.body ?? {});
    
    if (!req.agent?.id || !req.agent?.kind) {
      return reply.code(401).send({ ok: false, error: 'unauthorized' });
    }
    
    const task = getNextOpenTask();
    if (!task) return reply.code(200).send({ error: 'no_available_tasks' });
    
    // Policy check before claiming the task (use appropriate paths based on agent kind)
    const simulatedPaths = getAgentPaths(req.agent.kind, task.id);
    const decision = checkPolicy({ actor: req.agent.kind, changedPaths: simulatedPaths });
    
    if (!decision.allow) {
      policyDeniesTotal.inc();
      req.log.info({ decision, taskId: task.id, agent: req.agent.kind }, 'policy denied task claim');
      return reply.send({ error: 'policy_denied', reasons: decision.reasons });
    }
    
    markTaskClaimed(task.id, req.agent.id);
    claimsTotal.inc({ agent_kind: req.agent.kind, task_kind: 'unknown' });
    req.log.info({ taskId: task.id, agent: req.agent.name, agentKind: req.agent.kind }, 'task claimed');
    return reply.send({ task_id: task.id, title: task.title });
  });

  const Run = z.object({ 
    task_id: z.string(), 
    status: z.enum(['claimed', 'in_progress', 'completed', 'failed']), 
    notes: z.string().optional(),
    task_kind: z.string().optional()
  });
  f.post('/task/run', { preHandler: requireAuth() }, async (req, reply) => {
    const body = Run.parse(req.body);
    
    if (!req.agent?.id || !req.agent?.kind) {
      return reply.code(401).send({ ok: false, error: 'unauthorized' });
    }
    
    // Policy check on task execution (use appropriate paths based on agent kind)
    const simulatedPaths = getAgentPaths(req.agent.kind, body.task_id);
    const decision = checkPolicy({ actor: req.agent.kind, changedPaths: simulatedPaths });
    
    if (!decision.allow) {
      policyDeniesTotal.inc();
      req.log.info({ decision, taskId: body.task_id, agent: req.agent.kind, status: body.status }, 'policy denied task execution');
      return reply.code(403).send({ ok: false, error: 'policy_denied', reasons: decision.reasons });
    }
    
    insertRun({ task_id: body.task_id, agent: req.agent.id, status: body.status, notes: body.notes });
    runsTotal.inc({ status: body.status, agent_kind: req.agent.kind, task_kind: body.task_kind ?? 'unknown' });
    req.log.info({ taskId: body.task_id, status: body.status, agent: req.agent.name }, 'task run updated');
    return reply.send({ ok: true });
  });

  f.get('/task/status', async (req, reply) => {
    const taskId = (req.query as any)?.task_id as string | undefined;
    if (!taskId) return reply.code(400).send({ ok: false, error: 'task_id_required' });
    const status = getTaskStatus(taskId);
    if (!status) return reply.code(404).send({ ok: false, error: 'not_found' });
    return reply.send(status);
  });
}


