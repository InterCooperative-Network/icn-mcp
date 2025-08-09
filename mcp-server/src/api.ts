import { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function healthRoute(f: FastifyInstance) {
  f.get('/healthz', async () => ({ ok: true }));
}

const AgentRegister = z.object({
  agent_id: z.string().min(1),
  name: z.string(),
  version: z.string(),
  capabilities: z.array(z.string())
});

export async function apiRoutes(f: FastifyInstance) {
  f.post('/agent/register', async (req, reply) => {
    const body = AgentRegister.parse(req.body);
    // TODO: persist agent; emit event
    return reply.code(200).send({ registered: true, agent_id: body.agent_id });
  });

  f.post('/task/create', async (req, reply) => {
    // TODO: validate & insert task
    return reply.send({ ok: true, task_id: 'T-0001' });
  });

  f.get('/task/list', async (_req, reply) => {
    return reply.send({ tasks: [] });
  });
}

