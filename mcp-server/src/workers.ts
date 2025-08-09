import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getNextOpenTask, markTaskClaimed, getTaskStatus } from './workers_db.js';
import { insertRun } from './db.js';
import { requireAuth } from './auth.js';

export async function workersRoute(f: FastifyInstance) {
  const Claim = z.object({});
  f.post('/task/claim', { preHandler: requireAuth() }, async (req, reply) => {
    const _ = Claim.parse(req.body || {});
    const task = getNextOpenTask();
    if (!task) return reply.code(200).send({ error: 'no_available_tasks' });
    markTaskClaimed(task.id, req.agent!.id);
    return reply.send({ task_id: task.id, title: task.title });
  });

  const Run = z.object({ task_id: z.string(), status: z.string(), notes: z.string().optional() });
  f.post('/task/run', { preHandler: requireAuth() }, async (req, reply) => {
    const body = Run.parse(req.body);
    insertRun({ task_id: body.task_id, agent: req.agent!.id, status: body.status, notes: body.notes });
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


