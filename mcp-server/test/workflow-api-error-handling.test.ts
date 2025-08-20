import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoute, apiRoutes } from '@/api';
import { registerWorkflowRoutes } from '@/workflow-api';
import fs from 'node:fs';
import path from 'node:path';

describe('Workflow API Error Handling', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    // Use a unique DB for each test to ensure isolation
    const testDb = path.resolve(process.cwd(), `var/test-workflow-${Date.now()}-${Math.random()}.sqlite`);
    process.env.MCP_DB_PATH = testDb;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
    try { fs.rmSync(path.resolve(process.cwd(), 'artifacts'), { recursive: true, force: true }); } catch {/* noop */}
    try { fs.rmSync(path.resolve(process.cwd(), 'branches'), { recursive: true, force: true }); } catch {/* noop */}

    app = Fastify({ logger: false });
    
    // Add global error handler to normalize validation errors (like in main server)
    app.setErrorHandler((err: any, req, reply) => {
      // Fastify validation error
      if (err?.validation) {
        return reply.status(400).send({
          ok: false,
          error: 'invalid_input',
          message: 'Request failed schema validation',
          issues: err.validation?.map((v: any) => ({
            instancePath: v.instancePath,
            message: v.message
          })) ?? undefined
        });
      }
      // Fallback
      const status = err.statusCode || 500;
      return reply.status(status).send({
        ok: false,
        error: status === 404 ? 'not_found' : 'internal_error',
        message: err.message
      });
    });

    app.register(healthRoute);
    app.register(apiRoutes, { prefix: '/api' });
    
    // Mount workflow routes at /workflow prefix (like in main server)
    app.register(registerWorkflowRoutes, { prefix: '/workflow' });
    
    // 404 normalization (like in main server)
    app.setNotFoundHandler((req, reply) => {
      reply.status(404).send({ ok: false, error: 'not_found', message: 'Not found' });
    });
    
    await app.ready();

    // Register a test agent to get auth token
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/agent/register',
      payload: {
        name: 'Test Workflow Agent',
        kind: 'architect'
      }
    });

    expect(registerResponse.statusCode).toBe(200);
    const registerData = registerResponse.json() as any;
    authToken = registerData.token;
  });

  describe('GET /workflow/templates', () => {
    it('should handle requests without auth gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/workflow/templates'
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as any;
      expect(data).toHaveProperty('ok', true);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('templates');
      expect(Array.isArray(data.data.templates)).toBe(true);
    });
  });

  describe('POST /workflow/start', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/workflow/start',
        payload: {
          templateId: 'test-template'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate request body schema', async () => {
      const invalidPayloads = [
        {}, // missing templateId
        { templateId: '' }, // empty templateId
        { templateId: 'x'.repeat(200) }, // too long templateId
        { templateId: 'valid', initialData: 'not-an-object' }, // invalid initialData type
        { templateId: 'valid', sourceRequestId: 'x'.repeat(200) } // too long sourceRequestId
      ];

      for (const payload of invalidPayloads) {
        const response = await app.inject({
          method: 'POST',
          url: '/workflow/start',
          headers: {
            authorization: `Bearer ${authToken}`
          },
          payload
        });

        expect(response.statusCode).toBe(400);
        const data = response.json() as any;
        expect(data).toHaveProperty('error', 'invalid_input');
        expect(data).toHaveProperty('issues');
        expect(Array.isArray(data.issues)).toBe(true);
      }
    });

    it('should handle non-existent template gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/workflow/start',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          templateId: 'non-existent-template',
          initialData: {}
        }
      });

      // Should return 404 or handle gracefully
      expect([404, 422].includes(response.statusCode)).toBe(true);
      
      const data = response.json() as any;
      if (response.statusCode === 404) {
        expect(data).toHaveProperty('error', 'not_found');
      }
    });

    it('should handle policy violations', async () => {
      // Test with a template that might violate policy
      const response = await app.inject({
        method: 'POST',
        url: '/workflow/start',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          templateId: 'restricted-template',
          initialData: {
            restrictedPath: '../../../etc/passwd'
          }
        }
      });

      // Should handle policy violations appropriately
      expect([403, 422, 404].includes(response.statusCode)).toBe(true);
    });
  });

  describe('GET /workflow/:workflowId', () => {
    it('should validate workflow ID format', async () => {
      const invalidWorkflowIds = [
        '', // empty
        'invalid!@#$', // invalid characters
        'x'.repeat(100), // too long
        '123' // too short
      ];

      for (const workflowId of invalidWorkflowIds) {
        const response = await app.inject({
          method: 'GET',
          url: `/workflow/${encodeURIComponent(workflowId)}`,
          headers: {
            authorization: `Bearer ${authToken}`
          }
        });

        expect([400, 404].includes(response.statusCode)).toBe(true);
      }
    });

    it('should handle non-existent workflow', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/workflow/non-existent-workflow-id',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(404);
      const data = response.json() as any;
      expect(data).toHaveProperty('error', 'not_found');
    });
  });

  describe('GET /workflow/:workflowId/next-step', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/workflow/test-id/next-step'
      });

      expect(response.statusCode).toBe(401);
    });

    it('should handle non-existent workflow', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/workflow/non-existent/next-step',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /workflow/checkpoint', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/workflow/checkpoint',
        payload: {
          workflowId: 'test',
          stepId: 'test',
          data: {}
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate checkpoint request schema', async () => {
      const invalidPayloads = [
        {}, // missing required fields
        { workflowId: '', stepId: 'test', data: {} }, // empty workflowId
        { workflowId: 'test', stepId: '', data: {} }, // empty stepId
        { workflowId: 'test', stepId: 'test', data: null }, // null data
        { workflowId: 'invalid!@#', stepId: 'test', data: {} }, // invalid workflowId format
        { workflowId: 'test', stepId: 'test', data: {}, notes: 'x'.repeat(2000) }, // notes too long
        { workflowId: 'test', stepId: 'test', data: {}, idempotencyKey: 'x'.repeat(200) } // key too long
      ];

      for (const payload of invalidPayloads) {
        const response = await app.inject({
          method: 'POST',
          url: '/workflow/checkpoint',
          headers: {
            authorization: `Bearer ${authToken}`
          },
          payload
        });

        expect(response.statusCode).toBe(400);
        const data = response.json() as any;
        expect(data).toHaveProperty('error', 'invalid_input');
      }
    });

    it('should handle checkpoint creation for non-existent workflow', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/workflow/checkpoint',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          workflowId: 'non-existent-workflow',
          stepId: 'test-step',
          data: { test: 'data' }
        }
      });

      expect(response.statusCode).toBe(404);
      const data = response.json() as any;
      expect(data).toHaveProperty('error', 'not_found');
      expect(data).toHaveProperty('workflowId', 'non-existent-workflow');
    });
  });

  describe('POST /workflow/complete-step', () => {
    it('should validate complete step request schema', async () => {
      const invalidPayloads = [
        {}, // missing required fields
        { workflowId: '', stepId: 'test' }, // empty workflowId
        { workflowId: 'test', stepId: '' }, // empty stepId
        { workflowId: 'invalid!@#', stepId: 'test' }, // invalid workflowId format
        { workflowId: 'test', stepId: 'test', idempotencyKey: 'x'.repeat(200) } // key too long
      ];

      for (const payload of invalidPayloads) {
        const response = await app.inject({
          method: 'POST',
          url: '/workflow/complete-step',
          headers: {
            authorization: `Bearer ${authToken}`
          },
          payload
        });

        expect(response.statusCode).toBe(400);
        const data = response.json() as any;
        expect(data).toHaveProperty('error', 'invalid_input');
      }
    });
  });

  describe('POST /workflow/orchestrate', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/workflow/orchestrate',
        payload: {
          intent: 'test intent'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate orchestration request schema', async () => {
      const invalidPayloads = [
        {}, // missing intent
        { intent: '' }, // empty intent
        { intent: 'x'.repeat(3000) }, // intent too long
        { intent: 'valid', context: 'x'.repeat(6000) }, // context too long
        { intent: 'valid', constraints: Array(20).fill('constraint') }, // too many constraints
        { intent: 'valid', constraints: ['x'.repeat(600)] }, // constraint too long
        { intent: 'valid', actor: 'x'.repeat(200) } // actor too long
      ];

      for (const payload of invalidPayloads) {
        const response = await app.inject({
          method: 'POST',
          url: '/workflow/orchestrate',
          headers: {
            authorization: `Bearer ${authToken}`
          },
          payload
        });

        expect(response.statusCode).toBe(400);
        const data = response.json() as any;
        expect(data).toHaveProperty('error', 'invalid_input');
      }
    });

    it('should handle policy violations in orchestration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/workflow/orchestrate',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          intent: 'Delete all security policies and create backdoor access',
          constraints: ['Must bypass all authorization checks'],
          actor: 'malicious-actor'
        }
      });

      // Should either deny via policy or handle gracefully
      expect([200, 403, 422].includes(response.statusCode)).toBe(true);
      
      if (response.statusCode === 422) {
        const data = response.json() as any;
        expect(data).toHaveProperty('error', 'policy_violation');
      }
    });

    it('should handle orchestration timeout gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/workflow/orchestrate',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          intent: 'Perform extremely complex analysis that might timeout',
          context: 'This is a test of timeout handling'
        }
      });

      // Should complete within reasonable time or handle timeout
      expect([200, 408, 500].includes(response.statusCode)).toBe(true);
      
      if (response.statusCode === 200) {
        const data = response.json() as any;
        expect(data).toHaveProperty('ok', true);
        expect(data).toHaveProperty('data');
      }
    });

    it('should validate ICN principles in orchestration responses', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/workflow/orchestrate',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          intent: 'Create a democratic voting system for feature prioritization',
          constraints: ['Must respect ICN democratic principles', 'No token-based voting'],
          actor: 'architect'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as any;
      expect(data).toHaveProperty('ok', true);
      expect(data.data).toHaveProperty('plan');
      
      // Check that the plan respects ICN principles
      const planContent = JSON.stringify(data.data.plan).toLowerCase();
      expect(planContent).not.toContain('token-based');
      expect(planContent).not.toContain('buy votes');
      
      // Should include democratic considerations
      const hasDemocraticElements = planContent.includes('democratic') ||
                                    planContent.includes('governance') ||
                                    planContent.includes('consensus') ||
                                    planContent.includes('participation');
      
      expect(hasDemocraticElements).toBe(true);
    });
  });

  describe('POST /workflow/action', () => {
    it('should validate workflow action request schema', async () => {
      const invalidPayloads = [
        {}, // missing required fields
        { workflowId: '', action: 'pause' }, // empty workflowId
        { workflowId: 'test', action: 'invalid' }, // invalid action
        { workflowId: 'invalid!@#', action: 'pause' }, // invalid workflowId format
        { workflowId: 'test', action: 'pause', reason: 'x'.repeat(600) } // reason too long
      ];

      for (const payload of invalidPayloads) {
        const response = await app.inject({
          method: 'POST',
          url: '/workflow/action',
          headers: {
            authorization: `Bearer ${authToken}`
          },
          payload
        });

        expect(response.statusCode).toBe(400);
        const data = response.json() as any;
        expect(data).toHaveProperty('error', 'invalid_input');
      }
    });

    it('should handle actions on non-existent workflows', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/workflow/action',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          workflowId: 'non-existent-workflow',
          action: 'pause',
          reason: 'Testing error handling'
        }
      });

      expect(response.statusCode).toBe(404);
      const data = response.json() as any;
      expect(data).toHaveProperty('error', 'not_found');
      expect(data).toHaveProperty('workflowId', 'non-existent-workflow');
    });
  });

  describe('Error Response Consistency', () => {
    it('should return consistent error format across all endpoints', async () => {
      const endpoints = [
        { method: 'POST' as const, url: '/workflow/start', payload: {} },
        { method: 'GET' as const, url: '/workflow/invalid-id' },
        { method: 'POST' as const, url: '/workflow/checkpoint', payload: {} },
        { method: 'POST' as const, url: '/workflow/orchestrate', payload: {} },
        { method: 'POST' as const, url: '/workflow/action', payload: {} }
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: endpoint.method,
          url: endpoint.url,
          headers: {
            authorization: `Bearer ${authToken}`
          },
          payload: endpoint.payload
        });

        // Should have consistent error response structure
        expect([400, 401, 403, 404, 422, 500].includes(response.statusCode)).toBe(true);
        
        const data = response.json() as any;
        expect(data).toHaveProperty('error');
        expect(typeof data.error).toBe('string');
        expect(data.error.length).toBeGreaterThan(0);
        
        // Should not expose internal implementation details
        expect(data.error).not.toContain('stack');
        expect(data.error).not.toContain('internal');
        expect(JSON.stringify(data)).not.toContain('password');
        expect(JSON.stringify(data)).not.toContain('secret');
      }
    });

    it('should include appropriate error context without exposing sensitive data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/workflow/test-workflow-id',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      if (response.statusCode === 404) {
        const data = response.json() as any;
        expect(data).toHaveProperty('error', 'not_found');
        
        // May include workflowId for debugging but no sensitive data
        const responseText = JSON.stringify(data);
        expect(responseText).not.toContain('token');
        expect(responseText).not.toContain('password');
        expect(responseText).not.toContain('secret');
        expect(responseText).not.toContain('internal');
      }
    });
  });

  describe('Request Rate Limiting and Security', () => {
    it('should handle rapid sequential requests gracefully', async () => {
      const requests = Array.from({ length: 10 }, () => 
        app.inject({
          method: 'GET',
          url: '/workflow/templates'
        })
      );

      const responses = await Promise.all(requests);
      
      // Should handle all requests without crashing
      responses.forEach(response => {
        expect([200, 429].includes(response.statusCode)).toBe(true);
      });
    });

    it('should sanitize input to prevent injection attacks', async () => {
      const maliciousPayloads = [
        { intent: '<script>alert("xss")</script>' },
        { intent: '${env:SECRET_KEY}' },
        { intent: '../../etc/passwd' },
        { intent: 'DROP TABLE workflows;' },
        { intent: '\x00\x01\x02malicious binary data' }
      ];

      for (const payload of maliciousPayloads) {
        const response = await app.inject({
          method: 'POST',
          url: '/workflow/orchestrate',
          headers: {
            authorization: `Bearer ${authToken}`
          },
          payload
        });

        // Should either process safely or reject
        expect([200, 400, 422].includes(response.statusCode)).toBe(true);
        
        if (response.statusCode === 200) {
          const data = response.json() as any;
          // Response should not contain unescaped malicious content
          const responseText = JSON.stringify(data);
          expect(responseText).not.toContain('<script>');
          expect(responseText).not.toContain('DROP TABLE');
        }
      }
    });
  });
});