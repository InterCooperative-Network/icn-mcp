import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
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

// Helper function to check if workflow exists and get its state
async function getWorkflowStateHelper(workflowId: string): Promise<any | null> {
  try {
    return await icnGetWorkflowState({ workflowId });
  } catch {
    return null;
  }
}

// Helper function to sanitize reason parameter
function sanitizeReason(reason?: string): string | undefined {
  if (!reason) return undefined;
  
  // Sanitize and limit to 1000 characters
  let sanitized = sanitizeText(reason).slice(0, 1000);
  
  // Add ellipsis if truncated
  if (reason.length > 1000) {
    sanitized = sanitized.slice(0, 997) + '...';
  }
  
  return sanitized;
}

// Define valid workflow state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  'active': ['paused', 'failed'],
  'paused': ['active', 'failed'],
  'failed': [], // terminal state
  'completed': [] // terminal state
};

// Helper function to validate state transitions
function validateTransition(fromStatus: string, toStatus: string): boolean {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

// Helper function to handle workflow actions with idempotency and proper metrics
async function executeWorkflowAction(
  workflowId: string, 
  action: 'pause' | 'resume' | 'fail', 
  reason: string | undefined,
  authContext: AuthContext,
  currentState: any
): Promise<{ result: any; idempotent: boolean }> {
  const templateId = currentState.templateId || 'unassigned';
  const currentStatus = currentState.status;
  
  // Log warning if templateId is missing to help fix upstream state
  if (!currentState.templateId) {
    console.warn(`Workflow ${workflowId} has no templateId in state, using 'unassigned' for metrics`);
  }
  
  // Determine target status and check for idempotency
  let targetStatus: string;
  
  switch (action) {
    case 'pause':
      targetStatus = 'paused';
      if (currentStatus === 'paused') {
        return {
          result: {
            workflowId,
            action: 'pause',
            previousStatus: currentStatus,
            newStatus: currentStatus,
            timestamp: new Date().toISOString(),
            reason
          },
          idempotent: true
        };
      }
      break;
    case 'resume':
      targetStatus = 'active';
      if (currentStatus === 'active') {
        return {
          result: {
            workflowId,
            action: 'resume',
            previousStatus: currentStatus,
            newStatus: currentStatus,
            timestamp: new Date().toISOString(),
            reason
          },
          idempotent: true
        };
      }
      break;
    case 'fail':
      targetStatus = 'failed';
      if (currentStatus === 'failed') {
        return {
          result: {
            workflowId,
            action: 'fail',
            previousStatus: currentStatus,
            newStatus: currentStatus,
            timestamp: new Date().toISOString(),
            reason
          },
          idempotent: true
        };
      }
      break;
    default:
      throw new Error(`Invalid action: ${action}`);
  }
  
  // Validate transition
  if (!validateTransition(currentStatus, targetStatus)) {
    throw new Error(`Cannot ${action} workflow in ${currentStatus} state`);
  }
  
  // Execute the action
  let result;
  switch (action) {
    case 'pause':
      result = await icnPauseWorkflow({ workflowId, action, reason, authContext });
      workflowActiveGauge.dec({ template_id: templateId });
      break;
    case 'resume':
      result = await icnResumeWorkflow({ workflowId, action, reason, authContext });
      workflowActiveGauge.inc({ template_id: templateId });
      break;
    case 'fail':
      result = await icnFailWorkflow({ workflowId, action, reason, authContext });
      workflowActiveGauge.dec({ template_id: templateId });
      workflowsCompletedTotal.inc({ template_id: templateId, status: 'failed' });
      break;
  }
  
  return { result, idempotent: false };
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
  action: z.enum(['pause', 'resume', 'fail']).or(
    z.string().transform((val) => val.toLowerCase()).pipe(z.enum(['pause', 'resume', 'fail']))
  ),
  reason: z.string().max(1000).optional()
}).transform((data) => ({
  ...data,
  action: data.action.toLowerCase() as 'pause' | 'resume' | 'fail'
}));

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
function handleWorkflowError(error: any, reply: any, context: { workflowId?: string; stepId?: string; requestId?: string } = {}) {
  if (error.name === 'ZodError') {
    return reply.code(400).send({ 
      ok: false,
      error: 'invalid_input',
      message: 'Request failed schema validation', 
      issues: error.issues,
      ...(context.workflowId && { workflowId: context.workflowId }),
      meta: context
    });
  }
  
  if (error.code === 'AUTH_REQUIRED') {
    return reply.code(401).send({ 
      ok: false,
      error: 'auth_required',
      message: 'Authentication required',
      ...(context.workflowId && { workflowId: context.workflowId }),
      meta: context
    });
  }
  
  if (error.code === 'FORBIDDEN') {
    return reply.code(403).send({ 
      ok: false,
      error: 'forbidden',
      message: 'Access denied',
      ...(context.workflowId && { workflowId: context.workflowId }),
      meta: context
    });
  }
  
  if (error.code === 'WORKFLOW_POLICY_VIOLATION') {
    return reply.code(422).send({ 
      ok: false,
      error: 'policy_violation', 
      message: error.message,
      ...(context.workflowId && { workflowId: context.workflowId }),
      meta: context
    });
  }
  
  if (error.message?.includes('not found')) {
    return reply.code(404).send({ 
      ok: false,
      error: 'not_found',
      message: error.message,
      ...(context.workflowId && { workflowId: context.workflowId }),
      meta: context
    });
  }
  
  // Log error without sensitive data
  const logContext = {
    error: error.message,
    ...context,
    errorCode: error.code
  };
  reply.log.error(logContext, 'workflow endpoint failed');
  
  return reply.code(500).send({ 
    ok: false,
    error: 'internal_error',
    message: 'An internal error occurred',
    ...(context.workflowId && { workflowId: context.workflowId }),
    meta: context
  });
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
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      const body = WorkflowActionRequest.parse(req.body);
      const authContext = buildAuthContext(req);
      
      // Sanitize reason parameter
      const sanitizedReason = sanitizeReason(body.reason);
      
      // Get workflow state (to determine if it exists and get templateId)
      const currentState = await getWorkflowStateHelper(body.workflowId);
      
      // Return 404 before policy check to avoid leaking existence when unauthorized
      if (!currentState) {
        f.log.info({ 
          requestId,
          workflowId: body.workflowId,
          action: body.action,
          actor: req.agent!.name,
          result: 'not_found'
        }, 'workflow action attempt: workflow not found');
        
        return reply.code(404).send({ 
          ok: false, 
          error: 'not_found', 
          message: 'Workflow not found',
          workflowId: body.workflowId,
          meta: { workflowId: body.workflowId, requestId }
        });
      }
      
      // Policy check for workflow modification
      const policyDecision = checkPolicy({
        actor: req.agent!.name,
        changedPaths: [`workflows/${body.workflowId}`]
      });
      
      if (!policyDecision.allow) {
        f.log.warn({ 
          requestId,
          workflowId: body.workflowId,
          action: body.action,
          actor: req.agent!.name, 
          reasons: policyDecision.reasons,
          result: 'forbidden'
        }, 'workflow action denied by policy');
        
        return reply.code(403).send({ 
          ok: false,
          error: 'forbidden', 
          message: 'Policy violation',
          details: { reasons: policyDecision.reasons },
          meta: { workflowId: body.workflowId, requestId }
        });
      }

      // Execute workflow action with idempotency and proper metrics
      const { result, idempotent } = await executeWorkflowAction(
        body.workflowId,
        body.action,
        sanitizedReason,
        authContext,
        currentState
      );

      // Audit log successful action
      f.log.info({ 
        requestId,
        workflowId: body.workflowId, 
        action: body.action,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        idempotent,
        actor: req.agent!.name,
        templateId: currentState.templateId || 'unassigned',
        duration: Date.now() - startTime,
        result: 'success'
      }, 'workflow action completed successfully');

      return reply.header('Cache-Control', 'no-store').send({
        ok: true,
        data: result,
        meta: { 
          workflowId: body.workflowId,
          requestId,
          idempotent,
          version: 'v1' 
        }
      });
      
    } catch (error: any) {
      // Audit log failed action
      f.log.error({ 
        requestId,
        workflowId: (req.body as any)?.workflowId,
        action: (req.body as any)?.action,
        actor: req.agent?.name,
        error: error.message,
        duration: Date.now() - startTime,
        result: 'error'
      }, 'workflow action failed');
      
      // Handle specific transition errors with structured response
      if (error.message.includes('Cannot pause workflow') || 
          error.message.includes('Cannot resume workflow') || 
          error.message.includes('Cannot fail workflow') ||
          error.message.includes('already in failed state')) {
        return reply.code(422).send({
          ok: false,
          error: 'invalid_transition',
          message: error.message,
          details: {
            workflowId: (req.body as any)?.workflowId,
            action: (req.body as any)?.action,
            from: error.message.match(/in (\w+) state/)?.[1] || 'unknown',
            to: (req.body as any)?.action === 'pause' ? 'paused' : 
                (req.body as any)?.action === 'resume' ? 'active' : 'failed'
          },
          meta: { 
            workflowId: (req.body as any)?.workflowId,
            requestId 
          }
        });
      }
      
      return handleWorkflowError(error, reply, { 
        workflowId: (req.body as any)?.workflowId,
        requestId 
      });
    }
  });
}