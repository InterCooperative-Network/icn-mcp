import { FastifyInstance } from 'fastify';
import client from 'prom-client';

// Register default metrics
client.collectDefaultMetrics();

export const tasksTotal = new client.Counter({
  name: 'icn_mcp_tasks_total',
  help: 'Total tasks created'
});

export const policyDeniesTotal = new client.Counter({
  name: 'icn_mcp_policy_denies_total',
  help: 'Number of policy denies'
});

export const prCreatesTotal = new client.Counter({
  name: 'icn_mcp_pr_creates_total',
  help: 'Number of PR creations by mode',
  labelNames: ['mode'] as const
});

export const agentsTotal = new client.Gauge({
  name: 'icn_mcp_agents_total',
  help: 'Number of registered agents'
});

export async function metricsRoute(f: FastifyInstance) {
  f.get('/metrics', async (_req, reply) => {
    const metrics = await client.register.metrics();
    reply.header('Content-Type', client.register.contentType);
    return reply.send(metrics);
  });
}


