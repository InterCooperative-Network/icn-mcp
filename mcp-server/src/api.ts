import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { insertTask, listTasks, insertDep, insertAgent, countAgents, refreshAgentToken, getAgentById, cleanupExpiredTokens } from './db.js';
import { checkPolicy, initPolicyWatcher } from './policy.js';
import { createPr } from './github.js';
import { requireAuth } from './auth.js';
import { tasksTotal, policyDeniesTotal, prCreatesTotal, agentsTotal } from './metrics.js';
import crypto from 'node:crypto';
import { webhooksRoute } from './webhooks.js';
import { buildTaskBrief } from './context.js';
import { workersRoute } from './workers.js';

export async function healthRoute(f: FastifyInstance) {
  f.get('/healthz', async () => ({ ok: true }));
}

const AgentRegister = z.object({
  name: z.string(),
  kind: z.enum(['planner', 'architect', 'reviewer', 'ops']),
  version: z.string().optional()
});

const TaskCreate = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  created_by: z.string().optional(),
  depends_on: z.array(z.string()).optional()
});

export async function apiRoutes(f: FastifyInstance) {
  // Validation error handling wrapper
  f.setErrorHandler((error, _request, reply) => {
    if ((error as any).issues) {
      const zerr = error as any;
      return reply.code(400).send({ ok: false, error: 'validation_error', issues: zerr.issues });
    }
    f.log.error(error);
    return reply.code(500).send({ ok: false, error: 'internal_error' });
  });

  f.post('/agent/register', { preHandler: requireAuth({ allowIfNoAgents: true }) }, async (req, reply) => {
    const body = AgentRegister.parse(req.body);
    const token = crypto.randomBytes(32).toString('hex');
    const { id } = insertAgent({ name: body.name, kind: body.kind, token });
    agentsTotal.set(countAgents());
    req.log.info({ reqId: req.id, agentId: id, agentName: body.name, agentKind: body.kind }, 'agent registered');
    return reply.code(200).send({ ok: true, id, token });
  });

  f.post('/agent/refresh', { preHandler: requireAuth() }, async (req, reply) => {
    if (!req.agent?.id) {
      return reply.code(401).send({ ok: false, error: 'unauthorized' });
    }
    
    // Clean up expired tokens first
    const expired = cleanupExpiredTokens();
    if (expired > 0) {
      req.log.info({ expiredCount: expired }, 'cleaned up expired tokens');
    }
    
    const newToken = crypto.randomBytes(32).toString('hex');
    const refreshed = refreshAgentToken(req.agent.id, newToken);
    
    if (!refreshed) {
      return reply.code(404).send({ ok: false, error: 'agent not found' });
    }
    
    req.log.info({ reqId: req.id, agentId: req.agent.id }, 'token refreshed');
    return reply.send({ ok: true, token: newToken });
  });

  f.post('/task/create', { preHandler: requireAuth() }, async (req, reply) => {
    const body = TaskCreate.parse(req.body);
    const { id } = insertTask({ title: body.title, description: body.description, created_by: body.created_by });
    if (body.depends_on && body.depends_on.length > 0) {
      for (const dep of body.depends_on) insertDep({ task_id: id, depends_on: dep });
    }
    tasksTotal.inc();
    req.log.info({ reqId: req.id, taskId: id, title: body.title, agent: req.agent?.name }, 'task created');
    return reply.send({ ok: true, id });
  });

  f.get('/task/list', async (_req, reply) => {
    const tasks = listTasks();
    return reply.send(tasks);
  });

  // Policy engine endpoints
  initPolicyWatcher(() => f.log.info('policy rules reloaded'));
  const PolicyCheck = z.object({ actor: z.string(), changedPaths: z.array(z.string()) });
  f.post('/policy/check', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      const body = PolicyCheck.parse(req.body);
      const decision = checkPolicy({ actor: body.actor, changedPaths: body.changedPaths });
      f.log.info({ decision }, 'policy decision');
      if (!decision.allow) policyDeniesTotal.inc();
      return reply.send(decision);
    } catch (err: any) {
      f.log.error({ err }, 'policy check error');
      return reply.code(200).send({ allow: false, reasons: [String(err?.message || err)] });
    }
  });

  // PR adapter
  const PrCreate = z.object({
    task_id: z.string(),
    title: z.string(),
    body: z.string(),
    files: z.array(z.object({ path: z.string(), content: z.string() }))
  });
  f.post('/pr/create', { preHandler: requireAuth() }, async (req, reply) => {
    const body = PrCreate.parse(req.body);
    // Policy check before PR
    const paths = body.files.map((f) => f.path);
    const decision = checkPolicy({ actor: req.agent?.kind ?? 'unknown', changedPaths: paths });
    f.log.info({ decision, reqId: req.id }, 'policy decision for pr/create');
    if (!decision.allow) {
      policyDeniesTotal.inc();
      return reply.code(200).send({ allow: false, reasons: decision.reasons });
    }
    const res = await createPr(body);
    prCreatesTotal.inc({ mode: res.mode });
    f.log.info({ mode: (res as any).mode, branch_hint: body.task_id, reqId: req.id }, 'pr create');
    return reply.send({ ok: true, ...res });
  });

  // Issue orchestration
  const IssueCreateSchema = z.object({ title: z.string(), body: z.string().optional(), labels: z.array(z.string()).optional() });
  f.post('/gh/issue/create', { preHandler: requireAuth() }, async (req, reply) => {
    const body = IssueCreateSchema.parse(req.body);
    const { createIssue } = await import('./github.js');
    const res = await createIssue(body as any);
    return reply.send({ ok: true, ...res });
  });

  // Webhooks
  await webhooksRoute(f);

  // Context briefing
  f.get('/context/brief', async (req, reply) => {
    const taskId = (req.query as any)?.task_id as string | undefined;
    if (!taskId) return reply.code(400).send({ ok: false, error: 'task_id_required' });
    try {
      const brief = buildTaskBrief(taskId);
      return reply.send(brief);
    } catch (err: any) {
      f.log.warn({ err, reqId: req.id }, 'brief generation failed');
      return reply.code(404).send({ ok: false, error: 'not_found' });
    }
  });

  // Workers protocol
  await workersRoute(f);
}

