import { FastifyRequest, FastifyReply } from 'fastify';
import { countAgents, getAgentByToken } from '@/db';

export type AuthenticatedUser = {
  id: string;
  name: string;
  kind: string;
  role: 'agent' | 'maintainer';
};

declare module 'fastify' {
  interface FastifyRequest {
    agent?: AuthenticatedUser;
  }
}

// Environment-configurable maintainer tokens (read dynamically)
function getMaintainerTokens(): string[] {
  return process.env.MAINTAINER_TOKENS?.split(',').map(t => t.trim()).filter(Boolean) || [];
}

function getMaintainerAdminToken(): string | undefined {
  return process.env.MAINTAINER_ADMIN_TOKEN?.trim();
}

// Rate limiting configuration (read dynamically)
function getRateLimitConfig() {
  return {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per minute
    maxRequestsMaintainer: Number(process.env.RATE_LIMIT_MAX_REQUESTS_MAINTAINER) || 1000, // Higher limit for maintainers
  };
}

// In-memory rate limiting store
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Export for testing
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

// Cleanup expired entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 30000); // Clean up every 30 seconds

// Clear the interval on process exit to prevent memory leaks
process.on('exit', () => clearInterval(cleanupInterval));

export function checkRateLimit(identifier: string, isMaintainer: boolean = false): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const config = getRateLimitConfig();
  const maxRequests = isMaintainer ? config.maxRequestsMaintainer : config.maxRequests;
  
  const entry = rateLimitStore.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    // Reset or create new entry
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return { allowed: true };
  }
  
  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  entry.count++;
  return { allowed: true };
}

export function rateLimitMiddleware() {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    const ip = req.ip;
    const token = req.headers['authorization']?.replace('Bearer ', '').trim();
    
    // Use token if available, otherwise fall back to IP
    const identifier = token || ip;
    
    // Check if this is a maintainer (for higher limits)
    const isMaintainer = token ? !!validateMaintainerToken(token) : false;
    
    const rateCheck = checkRateLimit(identifier, isMaintainer);
    
    if (!rateCheck.allowed) {
      req.log.warn({
        reqId: req.id,
        ip,
        tokenPrefix: token?.slice(0, 8),
        retryAfter: rateCheck.retryAfter
      }, 'rate limit exceeded');
      
      reply.header('Retry-After', rateCheck.retryAfter!.toString());
      return reply.code(429).send({ 
        ok: false, 
        error: 'rate_limit_exceeded',
        retryAfter: rateCheck.retryAfter
      });
    }
  };
}

export function validateMaintainerToken(token: string): AuthenticatedUser | null {
  const adminToken = getMaintainerAdminToken();
  const maintainerTokens = getMaintainerTokens();
  
  if (adminToken && token === adminToken) {
    return {
      id: 'maintainer-admin',
      name: 'Admin Maintainer',
      kind: 'maintainer',
      role: 'maintainer'
    };
  }
  
  const tokenIndex = maintainerTokens.indexOf(token);
  if (tokenIndex >= 0) {
    return {
      id: `maintainer-${tokenIndex}`,
      name: `Maintainer ${tokenIndex + 1}`,
      kind: 'maintainer',
      role: 'maintainer'
    };
  }
  
  return null;
}

export function requireAuth(opts?: { allowIfNoAgents?: boolean, requireMaintainer?: boolean }) {
  const allowIfNoAgents = opts?.allowIfNoAgents === true;
  const requireMaintainer = opts?.requireMaintainer === true;
  
  return async function (req: FastifyRequest, reply: FastifyReply) {
    try {
      if (allowIfNoAgents && countAgents() === 0) {
        req.log.debug({ reqId: req.id }, 'allowing unauthenticated request - no agents registered');
        return;
      }
      
      const auth = req.headers['authorization'];
      if (!auth || !auth.startsWith('Bearer ')) {
        req.log.warn({ 
          reqId: req.id, 
          ip: req.ip,
          userAgent: req.headers['user-agent'] 
        }, 'auth failed: missing/invalid authorization header');
        return reply.code(401).send({ ok: false, error: 'unauthorized' });
      }
      
      const token = auth.slice('Bearer '.length).trim();
      
      // Try maintainer token first
      const maintainer = validateMaintainerToken(token);
      if (maintainer) {
        req.agent = maintainer;
        req.log.info({ 
          reqId: req.id, 
          user: { id: maintainer.id, role: maintainer.role, kind: maintainer.kind },
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }, 'authenticated maintainer request');
        return;
      }
      
      // If maintainer required but not found, reject
      if (requireMaintainer) {
        req.log.warn({ 
          reqId: req.id, 
          tokenPrefix: token.slice(0, 8),
          ip: req.ip 
        }, 'auth failed: maintainer access required');
        return reply.code(403).send({ ok: false, error: 'maintainer_access_required' });
      }
      
      // Try agent token
      const agent = getAgentByToken(token);
      if (!agent) {
        req.log.warn({ 
          reqId: req.id, 
          tokenPrefix: token.slice(0, 8),
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }, 'auth failed: token not recognized');
        return reply.code(401).send({ ok: false, error: 'unauthorized' });
      }
      
      req.agent = { 
        id: agent.id, 
        name: agent.name, 
        kind: agent.kind, 
        role: 'agent' as const 
      };
      req.log.debug({ 
        reqId: req.id, 
        user: req.agent,
        ip: req.ip 
      }, 'authenticated agent request');
    } catch (err) {
      req.log.error({ 
        err, 
        reqId: req.id,
        ip: req.ip 
      }, 'auth error');
      return reply.code(401).send({ ok: false, error: 'unauthorized' });
    }
  };
}


