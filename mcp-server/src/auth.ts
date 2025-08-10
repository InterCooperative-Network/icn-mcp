import { FastifyRequest, FastifyReply } from 'fastify';
import { countAgents, getAgentByToken } from './db.js';

export type AuthenticatedAgent = {
  id: string;
  name: string;
  kind: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    agent?: AuthenticatedAgent;
  }
}

export function requireAuth(opts?: { allowIfNoAgents?: boolean }) {
  const allowIfNoAgents = opts?.allowIfNoAgents === true;
  return async function (req: FastifyRequest, reply: FastifyReply) {
    try {
      if (allowIfNoAgents && countAgents() === 0) {
        req.log.debug({ reqId: req.id }, 'allowing unauthenticated request - no agents registered');
        return;
      }
      const auth = req.headers['authorization'];
      if (!auth || !auth.startsWith('Bearer ')) {
        req.log.warn({ reqId: req.id, headers: req.headers }, 'auth failed: missing/invalid authorization header');
        return reply.code(401).send({ ok: false, error: 'unauthorized' });
      }
      const token = auth.slice('Bearer '.length).trim();
      const agent = getAgentByToken(token);
      if (!agent) {
        req.log.warn({ reqId: req.id, tokenPrefix: token.slice(0, 8) }, 'auth failed: token not recognized');
        return reply.code(401).send({ ok: false, error: 'unauthorized' });
      }
      req.agent = { id: agent.id, name: agent.name, kind: agent.kind };
      req.log.debug({ reqId: req.id, agent: req.agent }, 'authenticated request');
    } catch (err) {
      req.log.error({ err, reqId: req.id }, 'auth error');
      return reply.code(401).send({ ok: false, error: 'unauthorized' });
    }
  };
}


