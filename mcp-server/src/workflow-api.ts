import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { checkPolicy } from './policy.js';
import { 
  workflowsStartedTotal, 
  workflowsCompletedTotal, 
  workflowStepsTotal, 
  workflowCheckpointsTotal,
  workflowActiveGauge,
  // workflowStepDurationHistogram
} from './metrics.js';

// Import MCP workflow tools
import {
  icnListWorkflowTemplates,
  icnStartWorkflow,
  icnGetNextStep,
  icnCheckpoint,
  // icnWorkflow, // TODO: Will be used when implementing full orchestration
  icnGetWorkflowState,
  icnPauseWorkflow,
  icnResumeWorkflow,
  icnFailWorkflow,
  type AuthContext
} from '../../mcp-node/src/tools/icn_workflow.js';

// Sanitization utilities
function sanitizeText(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // SQL injection patterns
    .replace(/DROP\s+TABLE/gi, 'REDACTED')
    .replace(/DELETE\s+FROM/gi, 'REDACTED')
    .replace(/INSERT\s+INTO/gi, 'REDACTED')
    .replace(/UPDATE\s+SET/gi, 'REDACTED')
    .replace(/UNION\s+SELECT/gi, 'REDACTED')
    // ICN principle violations
    .replace(/token-based/gi, 'contribution-based')
    .replace(/buy\s+votes/gi, 'earn participation');
}

function sanitizeDeep(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDeep);
  }
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeDeep(value);
    }
    return sanitized;
  }
  return obj;
}

// Helper function to check if workflow exists
async function workflowExists(workflowId: string): Promise<boolean> {
  try {
    await icnGetWorkflowState({ workflowId });
    return true;
  } catch {
    return false;
  }
}

// Enhanced validation schemas with size limits
const StartWorkflowRequest = z.object({
  templateId: z.string().min(1).max(100),
  initialData: z.record(z.string(), z.any()).optional(),
  sourceRequestId: z.string().max(100).optional()
});

const CreateCheckpointRequest = z.object({
  workflowId: z.string().min(8).max(64).regex(/^[a-z0-9-]+$/),
  stepId: z.string().min(1).max(100),
  data: z.record(z.string(), z.any()),
  notes: z.string().max(1000).optional(),
  completeStep: z.boolean().optional(),
  sourceRequestId: z.string().max(100).optional(),
  idempotencyKey: z.string().max(100).optional()
});

const CompleteStepRequest = z.object({
  workflowId: z.string().min(8).max(64).regex(/^[a-z0-9-]+$/),
  stepId: z.string().min(1).max(100),
  outputs: z.record(z.string(), z.any()).optional(),
  sourceRequestId: z.string().max(100).optional(),
  idempotencyKey: z.string().max(100).optional()
});

const WorkflowActionRequest = z.object({
  workflowId: z.string().min(8).max(64).regex(/^[a-z0-9-]+$/),
  action: z.enum(['pause', 'resume', 'fail']),
  reason: z.string().max(500).optional()
});

const OrchestrationRequest = z.object({
  intent: z.string().min(1).max(2000),
  context: z.string().max(5000).optional(),
  constraints: z.array(z.string().max(500)).max(10).optional(),
  actor: z.string().max(100).optional()
});

// Helper function to build consistent auth context
function buildAuthContext(req: any): AuthContext {
  return {
    actor: req.agent?.name ?? null,
    bearer: req.authContext?.bearer ?? null,
    roles: req.authContext?.roles ?? [],
    scopes: req.authContext?.scopes ?? [],
    tenantId: req.authContext?.tenantId ?? null
  };
}

// Helper function to handle workflow errors consistently
function handleWorkflowError(error: any, reply: any, context: { workflowId?: string; stepId?: string } = {}) {
  if (error.name === 'ZodError') {
    return reply.code(400).send({ 
      error: 'invalid_input', 
      issues: error.issues 
    });
  }
  
  if (error.code === 'AUTH_REQUIRED') {
    return reply.code(401).send({ error: 'auth_required' });
  }
  
  if (error.code === 'FORBIDDEN') {
    return reply.code(403).send({ error: 'forbidden' });
  }
  
  if (error.code === 'WORKFLOW_POLICY_VIOLATION') {
    return reply.code(422).send({ 
      error: 'policy_violation', 
      detail: error.message 
    });
  }
  
  if (error.message?.includes('not found')) {
    return reply.code(404).send({ 
      error: 'not_found', 
      ...context 
    });
  }
  
  // Log error without sensitive data
  const logContext = {
    error: error.message,
    ...context,
    errorCode: error.code
  };
  reply.log.error(logContext, 'workflow endpoint failed');
  
  return reply.code(500).send({ error: 'internal_error' });
}

export async function registerWorkflowRoutes(f: FastifyInstance) {
  // Workflow management endpoints - these will integrate with MCP tools
  
  // List workflow templates
  f.get('/templates', async (req, reply) => {
    try {
      const authContext = buildAuthContext(req);
      const result = await icnListWorkflowTemplates({ authContext });
      
      return reply.header('Cache-Control', 'no-store').send({
        ok: true,
        data: result,
        meta: { version: 'v1' }
      });
    } catch (error: any) {
      return handleWorkflowError(error, reply);
    }
  });

  // Start a new workflow
  f.post('/start', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      const body = StartWorkflowRequest.parse(req.body);
      const authContext = buildAuthContext(req);
      
      // Policy check for workflow creation
      const policyDecision = checkPolicy({
        actor: req.agent!.name,
        changedPaths: ['workflows/'] // Generic workflow creation permission
      });
      
      if (!policyDecision.allow) {
        f.log.warn({ 
          actor: req.agent!.name, 
          reasons: policyDecision.reasons 
        }, 'workflow start denied by policy');
        return reply.code(403).send({ 
          error: 'forbidden', 
          reasons: policyDecision.reasons 
        });
      }

      // Call MCP tool icn_start_workflow
      const result = await icnStartWorkflow({
        templateId: body.templateId,
        initialData: body.initialData,
        sourceRequestId: body.sourceRequestId,
        authContext
      });

      workflowsStartedTotal.inc({ template_id: body.templateId });
      workflowActiveGauge.inc({ template_id: body.templateId });
      
      f.log.info({ 
        templateId: body.templateId, 
        workflowId: result.workflowId,
        actor: req.agent!.name
      }, 'workflow started successfully');

      return reply.header('Cache-Control', 'no-store').send({
        ok: true,
        data: result,
        meta: { workflowId: result.workflowId, version: 'v1' }
      });
    } catch (error: any) {
      return handleWorkflowError(error, reply);
    }
  });

  // Get workflow state  
  f.get('/:workflowId', {
    preHandler: requireAuth(),
    schema: {
      params: {
        type: 'object',
        properties: {
          workflowId: {
            type: 'string',
            minLength: 8,
            maxLength: 64,
            pattern: '^[a-z0-9-]+$'
          }
        },
        required: ['workflowId']
      }
    }
  }, async (req, reply) => {
    try {
      const { workflowId } = req.params as { workflowId: string };
      const authContext = buildAuthContext(req);
      
      // Call MCP tool icn_get_workflow_state
      const result = await icnGetWorkflowState({ workflowId, authContext });
      
      if (!result) {
        return reply.code(404).send({ 
          error: 'not_found', 
          workflowId 
        });
      }
      
      f.log.info({ 
        workflowId, 
        actor: req.agent!.name 
      }, 'workflow state retrieved');

      return reply.header('Cache-Control', 'no-store').send({
        ok: true,
        data: result,
        meta: { workflowId, version: 'v1' }
      });
    } catch (error: any) {
      return handleWorkflowError(error, reply, { workflowId: (req.params as any)?.workflowId });
    }
  });

  // Get next step in workflow
  f.get('/:workflowId/next-step', {
    onRequest: [requireAuth()],
    schema: {
      params: {
        type: 'object',
        properties: {
          workflowId: {
            type: 'string',
            minLength: 8,
            maxLength: 64,
            pattern: '^[a-z0-9-]+$'
          }
        },
        required: ['workflowId']
      }
    }
  }, async (req, reply) => {
    try {
      const { workflowId } = req.params as { workflowId: string };
      const authContext = buildAuthContext(req);
      
      // Call MCP tool icn_get_next_step
      const result = await icnGetNextStep({ workflowId, authContext });
      
      f.log.info({ 
        workflowId, 
        actor: req.agent!.name 
      }, 'workflow next step retrieved');

      return reply.header('Cache-Control', 'no-store').send({
        ok: true,
        data: result,
        meta: { workflowId, version: 'v1' }
      });
    } catch (error: any) {
      return handleWorkflowError(error, reply, { workflowId: (req.params as any)?.workflowId });
    }
  });

  // Create checkpoint
  f.post('/checkpoint', { 
    preHandler: requireAuth()
  }, async (req, reply) => {
    try {
      const body = CreateCheckpointRequest.parse(req.body);
      const authContext = buildAuthContext(req);
      
      // Policy check for workflow modification
      const policyDecision = checkPolicy({
        actor: req.agent!.name,
        changedPaths: [`workflows/${body.workflowId}`]
      });
      
      if (!policyDecision.allow) {
        f.log.warn({ 
          actor: req.agent!.name, 
          reasons: policyDecision.reasons 
        }, 'workflow checkpoint denied by policy');
        return reply.code(403).send({ 
          error: 'forbidden', 
          reasons: policyDecision.reasons 
        });
      }

      // Call MCP tool icn_checkpoint
      const result = await icnCheckpoint({
        workflowId: body.workflowId,
        stepId: body.stepId,
        data: body.data,
        notes: body.notes,
        completeStep: body.completeStep,
        sourceRequestId: body.sourceRequestId,
        idempotencyKey: body.idempotencyKey,
        authContext
      });

      workflowCheckpointsTotal.inc({ 
        template_id: result.state.templateId || 'unknown',
        status_class: '2xx'
      });
      
      f.log.info({ 
        workflowId: body.workflowId, 
        stepId: body.stepId,
        checkpointId: result.checkpoint.id,
        actor: req.agent!.name,
        payloadSize: JSON.stringify(body.data).length
      }, 'workflow checkpoint created successfully');

      return reply.header('Cache-Control', 'no-store').send({
        ok: true,
        data: result,
        meta: { 
          workflowId: body.workflowId, 
          stepId: body.stepId,
          version: 'v1' 
        }
      });
    } catch (error: any) {
      return handleWorkflowError(error, reply, { 
        workflowId: (req.body as any)?.workflowId, 
        stepId: (req.body as any)?.stepId 
      });
    }
  });

  // Complete workflow step - forces completeStep=true server-side
  f.post('/complete-step', { 
    preHandler: requireAuth()
  }, async (req, reply) => {
    try {
      const body = CompleteStepRequest.parse(req.body);
      const authContext = buildAuthContext(req);
      
      // Policy check for workflow modification
      const policyDecision = checkPolicy({
        actor: req.agent!.name,
        changedPaths: [`workflows/${body.workflowId}`]
      });
      
      if (!policyDecision.allow) {
        f.log.warn({ 
          actor: req.agent!.name, 
          reasons: policyDecision.reasons 
        }, 'workflow step completion denied by policy');
        return reply.code(403).send({ 
          error: 'forbidden', 
          reasons: policyDecision.reasons 
        });
      }

      // Use icn_checkpoint with completeStep=true forced server-side
      const result = await icnCheckpoint({
        workflowId: body.workflowId,
        stepId: body.stepId,
        data: body.outputs || {},
        completeStep: true, // Force true server-side
        sourceRequestId: body.sourceRequestId,
        idempotencyKey: body.idempotencyKey,
        authContext
      });

      workflowStepsTotal.inc({ 
        template_id: result.state.templateId || 'unknown', 
        step_id: body.stepId,
        status_class: '2xx'
      });
      
      f.log.info({ 
        workflowId: body.workflowId, 
        stepId: body.stepId,
        checkpointId: result.checkpoint.id,
        actor: req.agent!.name,
        outputsSize: JSON.stringify(body.outputs || {}).length
      }, 'workflow step completed successfully');

      return reply.header('Cache-Control', 'no-store').send({
        ok: true,
        data: result,
        meta: { 
          workflowId: body.workflowId, 
          stepId: body.stepId,
          version: 'v1' 
        }
      });
    } catch (error: any) {
      return handleWorkflowError(error, reply, { 
        workflowId: (req.body as any)?.workflowId, 
        stepId: (req.body as any)?.stepId 
      });
    }
  });

  // Orchestrate ad-hoc intents
  f.post('/orchestrate', { 
    preHandler: requireAuth()
  }, async (req, reply) => {
    try {
      const body = OrchestrationRequest.parse(req.body);
      // NOTE: authContext would be used with icnWorkflow MCP tool when fully implemented
      // const authContext = buildAuthContext(req);
      
      // Policy check for workflow orchestration
      const policyDecision = checkPolicy({
        actor: req.agent!.name,
        changedPaths: ['workflows/'] // Generic workflow orchestration permission
      });
      
      if (!policyDecision.allow) {
        f.log.warn({ 
          actor: req.agent!.name, 
          reasons: policyDecision.reasons 
        }, 'workflow orchestration denied by policy');
        return reply.code(403).send({ 
          error: 'forbidden', 
          reasons: policyDecision.reasons 
        });
      }

      // Create a sanitized plan that respects ICN principles
      const plan = {
        id: `orch_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        intent: sanitizeText(body.intent),
        steps: [] as any[],
        expectedDuration: '30-60 seconds',
        complexity: 'low'
      };
      const data = {
        plan: sanitizeDeep(plan),
        execution: {
          stepResults: {},
          currentStep: 0,
          status: 'completed',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }
      };
      
      f.log.info({ 
        intentLength: body.intent.length,
        planId: plan.id,
        complexity: plan.complexity,
        stepsCount: plan.steps.length,
        actor: req.agent!.name
      }, 'workflow orchestration completed');

      return reply.header('Cache-Control', 'no-store').send({
        ok: true,
        data,
        meta: { 
          planId: plan.id,
          version: 'v1' 
        }
      });
    } catch (error: any) {
      return handleWorkflowError(error, reply);
    }
  });

  // Workflow actions (pause, resume, fail)
  f.post('/action', { 
    preHandler: requireAuth()
  }, async (req, reply) => {
    try {
      const body = WorkflowActionRequest.parse(req.body);
      const authContext = buildAuthContext(req);
      
      // Check if workflow exists
      if (!(await workflowExists(body.workflowId))) {
        return reply.code(404).send({ 
          ok: false, 
          error: 'not_found', 
          message: 'Workflow not found',
          workflowId: body.workflowId
        });
      }
      
      // Policy check for workflow modification
      const policyDecision = checkPolicy({
        actor: req.agent!.name,
        changedPaths: [`workflows/${body.workflowId}`]
      });
      
      if (!policyDecision.allow) {
        f.log.warn({ 
          actor: req.agent!.name, 
          reasons: policyDecision.reasons 
        }, 'workflow action denied by policy');
        return reply.code(403).send({ 
          error: 'forbidden', 
          reasons: policyDecision.reasons 
        });
      }

      // Call appropriate MCP tool for workflow action
      let result;
      try {
        switch (body.action) {
          case 'pause':
            result = await icnPauseWorkflow({
              workflowId: body.workflowId,
              action: body.action,
              reason: body.reason,
              authContext
            });
            // Update metrics: decrease active workflow count
            workflowActiveGauge.dec({ template_id: 'unknown' });
            break;
          case 'resume':
            result = await icnResumeWorkflow({
              workflowId: body.workflowId,
              action: body.action,
              reason: body.reason,
              authContext
            });
            // Update metrics: increase active workflow count
            workflowActiveGauge.inc({ template_id: 'unknown' });
            break;
          case 'fail':
            result = await icnFailWorkflow({
              workflowId: body.workflowId,
              action: body.action,
              reason: body.reason,
              authContext
            });
            // Update metrics: decrease active workflow count and increment completed count
            workflowActiveGauge.dec({ template_id: 'unknown' });
            workflowsCompletedTotal.inc({ template_id: 'unknown', status: 'failed' });
            break;
          default:
            return reply.code(400).send({
              error: 'invalid_action',
              message: `Unsupported action: ${body.action}`
            });
        }
      } catch (error: any) {
        if (error.message.includes('Cannot pause workflow') || 
            error.message.includes('Cannot resume workflow') || 
            error.message.includes('already in failed state')) {
          return reply.code(422).send({
            error: 'invalid_state',
            message: error.message,
            workflowId: body.workflowId,
            action: body.action
          });
        }
        throw error; // Re-throw for general error handling
      }

      f.log.info({ 
        workflowId: body.workflowId, 
        action: body.action,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        actor: req.agent!.name
      }, 'workflow action completed successfully');

      return reply.header('Cache-Control', 'no-store').send({
        ok: true,
        data: result,
        meta: { 
          workflowId: body.workflowId,
          version: 'v1' 
        }
      });
    } catch (error: any) {
      return handleWorkflowError(error, reply, { workflowId: (req.body as any)?.workflowId });
    }
  });
}