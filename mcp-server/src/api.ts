import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { insertTask, listTasks, insertRun, insertDep } from './db.js';
import { checkPolicy, initPolicyWatcher } from './policy.js';
import { createLocalPr } from './github.js';

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

  f.post('/agent/register', async (req, reply) => {
    const body = AgentRegister.parse(req.body);
    // Store as a run with status 'register'
    const run = insertRun({ task_id: 'agent-registry', agent: body.kind, status: 'register', notes: body.name });
    return reply.code(200).send({ ok: true, run_id: run.id });
  });

  f.post('/task/create', async (req, reply) => {
    const body = TaskCreate.parse(req.body);
    const { id } = insertTask({ title: body.title, description: body.description, created_by: body.created_by });
    if (body.depends_on && body.depends_on.length > 0) {
      for (const dep of body.depends_on) insertDep({ task_id: id, depends_on: dep });
    }
    return reply.send({ ok: true, id });
  });

  f.get('/task/list', async (_req, reply) => {
    const tasks = listTasks();
    return reply.send(tasks);
  });

  // Policy engine endpoints
  initPolicyWatcher(() => f.log.info('policy rules reloaded'));
  const PolicyCheck = z.object({ actor: z.string(), changedPaths: z.array(z.string()) });
  f.post('/policy/check', async (req, reply) => {
    const body = PolicyCheck.parse(req.body);
    const decision = checkPolicy({ actor: body.actor, changedPaths: body.changedPaths });
    f.log.info({ decision }, 'policy decision');
    return reply.send(decision);
  });

  // Local PR adapter
  const PrCreate = z.object({
    task_id: z.string(),
    title: z.string(),
    body: z.string(),
    files: z.array(z.object({ path: z.string(), content: z.string() }))
  });
  f.post('/pr/create', async (req, reply) => {
    const body = PrCreate.parse(req.body);
    const res = await createLocalPr(body);
    return reply.send(res);
  });
}

