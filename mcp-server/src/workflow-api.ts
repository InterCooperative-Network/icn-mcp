import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { checkPolicy } from './policy.js';
import { 
  workflowsStartedTotal, 
  // workflowsCompletedTotal, 
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
  icnWorkflow,
  icnGetWorkflowState,
  type AuthContext
} from '@mcp-node/tools/icn_workflow';

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

export function registerWorkflowRoutes(f: FastifyInstance) {
  // Workflow management endpoints - these will integrate with MCP tools
  
  // List workflow templates
  f.get('/workflow/templates', async (req, reply) => {
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
  f.post('/workflow/start', { preHandler: requireAuth() }, async (req, reply) => {
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
  f.get('/workflow/:workflowId', {
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
  f.get('/workflow/:workflowId/next-step', {
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
  f.post('/workflow/checkpoint', { 
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
  f.post('/workflow/complete-step', { 
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
  f.post('/workflow/orchestrate', { 
    preHandler: requireAuth()
  }, async (req, reply) => {
    try {
      const body = OrchestrationRequest.parse(req.body);
      const authContext = buildAuthContext(req);
      
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

      // Call MCP tool icn_workflow for orchestration
      const result = await icnWorkflow({
        intent: body.intent,
        context: body.context,
        constraints: body.constraints,
        actor: body.actor || req.agent!.name,
        authContext
      });
      
      f.log.info({ 
        intentLength: body.intent.length,
        planId: result.plan.id,
        complexity: result.plan.complexity,
        stepsCount: result.plan.steps.length,
        actor: req.agent!.name
      }, 'workflow orchestration completed');

      return reply.header('Cache-Control', 'no-store').send({
        ok: true,
        data: result,
        meta: { 
          planId: result.plan.id,
          version: 'v1' 
        }
      });
    } catch (error: any) {
      return handleWorkflowError(error, reply);
    }
  });

  // Workflow actions (pause, resume, fail)
  f.post('/workflow/action', { 
    preHandler: requireAuth()
  }, async (req, reply) => {
    try {
      const body = WorkflowActionRequest.parse(req.body);
      const authContext = buildAuthContext(req);
      
      // TODO: Use authContext when implementing actual workflow action MCP tools
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _authContext = authContext;
      
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

      // TODO: Call appropriate MCP tools for workflow actions
      f.log.info({ 
        workflowId: body.workflowId, 
        action: body.action,
        actor: req.agent!.name
      }, 'workflow action requested');

      return reply.header('Cache-Control', 'no-store').send({
        ok: true,
        data: {
          message: 'Workflow API ready - will integrate with MCP tools',
          workflowId: body.workflowId,
          action: body.action,
          actor: req.agent!.name
        },
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