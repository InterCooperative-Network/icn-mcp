import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '@/auth';
import { checkPolicy } from './policy.js';

// Schema for validating prompt name parameter
const PromptNameSchema = z.object({
  name: z.string().min(1),
});

// Schema for prompt arguments
const PromptArgsSchema = z.record(z.any()).optional();

/**
 * Register resources and prompts API routes
 */
export async function resourcesPromptsRoutes(f: FastifyInstance) {
  // Import the services here to avoid circular dependencies
  const { ResourceService, PromptService } = await import('../../mcp-node/src/services/index.js');
  
  const resourceService = new ResourceService();
  const promptService = new PromptService();

  // GET /resources - List all available resources
  f.get('/resources', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      // Check policy for reading resources
      const actor = req.agent?.name || 'unknown';
      const policyDecision = checkPolicy({ 
        actor, 
        changedPaths: ['resources'] 
      });
      
      if (!policyDecision.allow) {
        req.log.warn({ 
          reqId: req.id, 
          actor, 
          reasons: policyDecision.reasons 
        }, 'Policy denied resource list access');
        return reply.code(403).send({
          ok: false,
          error: 'forbidden',
          message: 'Policy denied access to resource list',
          reasons: policyDecision.reasons
        });
      }

      const resources = await resourceService.listResources();
      
      req.log.info({ 
        reqId: req.id, 
        actor, 
        resourceCount: resources.length 
      }, 'Listed resources');

      return reply.send({
        ok: true,
        data: {
          resources,
          count: resources.length
        },
        meta: {
          requestId: req.id
        }
      });
    } catch (error: any) {
      req.log.error({ error, reqId: req.id }, 'Error listing resources');
      return reply.code(500).send({
        ok: false,
        error: 'internal_error',
        message: 'Failed to list resources',
        meta: {
          requestId: req.id
        }
      });
    }
  });

  // GET /resources/:uri - Read a specific resource (using wildcard to handle URI with special chars)
  f.get('/resources/*', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      // Extract URI from the wildcard path
      const uri = (req.params as any)['*'];
      if (!uri) {
        return reply.code(400).send({
          ok: false,
          error: 'invalid_input',
          message: 'Resource URI is required',
          meta: {
            requestId: req.id
          }
        });
      }

      const actor = req.agent?.name || 'unknown';
      
      // Check policy for reading specific resource
      const policyDecision = checkPolicy({ 
        actor, 
        changedPaths: [`resources/${uri}`] 
      });
      
      if (!policyDecision.allow) {
        req.log.warn({ 
          reqId: req.id, 
          actor, 
          uri,
          reasons: policyDecision.reasons 
        }, 'Policy denied resource read access');
        return reply.code(403).send({
          ok: false,
          error: 'forbidden',
          message: 'Policy denied access to resource',
          uri,
          reasons: policyDecision.reasons
        });
      }

      const contents = await resourceService.readResource(uri);
      
      // Check if the resource returned an error (readResource always returns at least one item)
      if (!contents || contents.length === 0) {
        // This should never happen given current implementation, but kept for safety
        req.log.warn({ reqId: req.id, uri }, 'Resource not found');
        return reply.code(404).send({
          ok: false,
          error: 'not_found',
          message: `Resource not found: ${uri}`,
          uri,
          meta: {
            requestId: req.id
          }
        });
      }

      req.log.info({ 
        reqId: req.id, 
        actor, 
        uri, 
        contentLength: contents[0]?.text?.length || 0 
      }, 'Read resource');

      return reply.send({
        ok: true,
        data: {
          contents,
          uri
        },
        meta: {
          requestId: req.id
        }
      });
    } catch (error: any) {
      req.log.error({ error, reqId: req.id }, 'Error reading resource');
      return reply.code(500).send({
        ok: false,
        error: 'internal_error',
        message: 'Failed to read resource',
        meta: {
          requestId: req.id
        }
      });
    }
  });

  // GET /prompts - List all available prompts
  f.get('/prompts', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      const actor = req.agent?.name || 'unknown';
      
      // Check policy for reading prompts
      const policyDecision = checkPolicy({ 
        actor, 
        changedPaths: ['prompts'] 
      });
      
      if (!policyDecision.allow) {
        req.log.warn({ 
          reqId: req.id, 
          actor, 
          reasons: policyDecision.reasons 
        }, 'Policy denied prompt list access');
        return reply.code(403).send({
          ok: false,
          error: 'forbidden',
          message: 'Policy denied access to prompt list',
          reasons: policyDecision.reasons
        });
      }

      const prompts = await promptService.listPrompts();
      
      req.log.info({ 
        reqId: req.id, 
        actor, 
        promptCount: prompts.length 
      }, 'Listed prompts');

      return reply.send({
        ok: true,
        data: {
          prompts,
          count: prompts.length
        },
        meta: {
          requestId: req.id
        }
      });
    } catch (error: any) {
      req.log.error({ error, reqId: req.id }, 'Error listing prompts');
      return reply.code(500).send({
        ok: false,
        error: 'internal_error',
        message: 'Failed to list prompts',
        meta: {
          requestId: req.id
        }
      });
    }
  });

  // GET /prompts/:name - Get a specific prompt
  f.get('/prompts/:name', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      const { name } = PromptNameSchema.parse(req.params);
      const args = PromptArgsSchema.parse(req.query);
      const actor = req.agent?.name || 'unknown';
      
      // Check policy for reading specific prompt
      const policyDecision = checkPolicy({ 
        actor, 
        changedPaths: [`prompts/${name}`] 
      });
      
      if (!policyDecision.allow) {
        req.log.warn({ 
          reqId: req.id, 
          actor, 
          name,
          reasons: policyDecision.reasons 
        }, 'Policy denied prompt read access');
        return reply.code(403).send({
          ok: false,
          error: 'forbidden',
          message: 'Policy denied access to prompt',
          name,
          reasons: policyDecision.reasons
        });
      }

      const promptResponse = await promptService.getPrompt(name, args || {});
      
      req.log.info({ 
        reqId: req.id, 
        actor, 
        name,
        argsProvided: Object.keys(args || {}).length 
      }, 'Generated prompt');

      return reply.send({
        ok: true,
        data: promptResponse,
        meta: {
          requestId: req.id
        }
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          ok: false,
          error: 'invalid_input',
          message: 'Invalid prompt name or arguments',
          issues: error.issues,
          meta: {
            requestId: req.id
          }
        });
      }
      
      if (error.message.includes('not found')) {
        const { name } = req.params as { name: string };
        req.log.warn({ reqId: req.id, name }, 'Prompt not found');
        return reply.code(404).send({
          ok: false,
          error: 'not_found',
          message: error.message,
          name,
          meta: {
            requestId: req.id
          }
        });
      }
      
      req.log.error({ error, reqId: req.id }, 'Error getting prompt');
      return reply.code(500).send({
        ok: false,
        error: 'internal_error',
        message: 'Failed to get prompt',
        meta: {
          requestId: req.id
        }
      });
    }
  });
}