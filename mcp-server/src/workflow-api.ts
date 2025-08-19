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
  icnGetWorkflowState
} from '../../mcp-node/src/tools/icn_workflow.js';

// Validation schemas
const StartWorkflowRequest = z.object({
  templateId: z.string().min(1),
  initialData: z.record(z.string(), z.any()).optional(),
  sourceRequestId: z.string().optional()
});

const CreateCheckpointRequest = z.object({
  workflowId: z.string().min(1),
  stepId: z.string().min(1),
  data: z.record(z.string(), z.any()),
  notes: z.string().optional(),
  completeStep: z.boolean().optional(),
  sourceRequestId: z.string().optional()
});

const CompleteStepRequest = z.object({
  workflowId: z.string().min(1),
  stepId: z.string().min(1),
  outputs: z.record(z.string(), z.any()).optional(),
  sourceRequestId: z.string().optional()
});

const WorkflowActionRequest = z.object({
  workflowId: z.string().min(1),
  action: z.enum(['pause', 'resume', 'fail']),
  reason: z.string().optional()
});

const OrchestrationRequest = z.object({
  intent: z.string().min(1),
  context: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  actor: z.string().optional()
});

export function registerWorkflowRoutes(f: FastifyInstance) {
  // Workflow management endpoints - these will integrate with MCP tools
  
  // List workflow templates
  f.get('/workflow/templates', async (req, reply) => {
    try {
      const result = await icnListWorkflowTemplates();
      return reply.send(result);
    } catch (err: any) {
      f.log.error({ err }, 'error listing workflow templates');
      return reply.code(500).send({ error: 'internal server error' });
    }
  });

  // Start a new workflow
  f.post('/workflow/start', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      const body = StartWorkflowRequest.parse(req.body);
      
      // Policy check for workflow creation
      const policyDecision = checkPolicy({
        actor: req.agent!.name,
        changedPaths: ['workflows/'] // Generic workflow creation permission
      });
      
      if (!policyDecision.allow) {
        f.log.warn({ agent: req.agent, reasons: policyDecision.reasons }, 'workflow start denied by policy');
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
        authContext: {
          agentName: req.agent!.name,
          agentKind: req.agent!.kind
        }
      }, req.agent!.name);

      workflowsStartedTotal.inc({ template_id: body.templateId });
      workflowActiveGauge.inc({ template_id: body.templateId });
      
      f.log.info({ 
        templateId: body.templateId, 
        workflowId: result.workflowId,
        agent: req.agent 
      }, 'workflow started successfully');

      return reply.send(result);
    } catch (err: any) {
      f.log.error({ err, agent: req.agent }, 'error starting workflow');
      return reply.code(400).send({ error: err.message || 'invalid request' });
    }
  });

  // Get workflow state
  f.get('/workflow/:workflowId', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      const { workflowId } = req.params as { workflowId: string };
      
      // Call MCP tool icn_get_workflow_state
      const result = await icnGetWorkflowState({ workflowId });
      
      f.log.info({ workflowId, agent: req.agent }, 'workflow state retrieved');

      return reply.send(result);
    } catch (err: any) {
      f.log.error({ err, agent: req.agent }, 'error getting workflow state');
      return reply.code(500).send({ error: 'internal server error' });
    }
  });

  // Get next step in workflow
  f.get('/workflow/:workflowId/next-step', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      const { workflowId } = req.params as { workflowId: string };
      
      // Call MCP tool icn_get_next_step
      const result = await icnGetNextStep({ workflowId });
      
      f.log.info({ workflowId, agent: req.agent }, 'workflow next step retrieved');

      return reply.send(result);
    } catch (err: any) {
      f.log.error({ err, agent: req.agent }, 'error getting workflow next step');
      return reply.code(500).send({ error: 'internal server error' });
    }
  });

  // Create checkpoint
  f.post('/workflow/checkpoint', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      const body = CreateCheckpointRequest.parse(req.body);
      
      // Policy check for workflow modification
      const policyDecision = checkPolicy({
        actor: req.agent!.name,
        changedPaths: [`workflows/${body.workflowId}`]
      });
      
      if (!policyDecision.allow) {
        f.log.warn({ agent: req.agent, reasons: policyDecision.reasons }, 'workflow checkpoint denied by policy');
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
        authContext: {
          agentName: req.agent!.name,
          agentKind: req.agent!.kind
        }
      });

      workflowCheckpointsTotal.inc({ template_id: result.state.templateId || 'unknown' });
      
      f.log.info({ 
        workflowId: body.workflowId, 
        stepId: body.stepId,
        checkpointId: result.checkpoint.id,
        agent: req.agent 
      }, 'workflow checkpoint created successfully');

      return reply.send(result);
    } catch (err: any) {
      f.log.error({ err, agent: req.agent }, 'error creating workflow checkpoint');
      return reply.code(400).send({ error: err.message || 'invalid request' });
    }
  });

  // Complete workflow step
  f.post('/workflow/complete-step', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      const body = CompleteStepRequest.parse(req.body);
      
      // Policy check for workflow modification
      const policyDecision = checkPolicy({
        actor: req.agent!.name,
        changedPaths: [`workflows/${body.workflowId}`]
      });
      
      if (!policyDecision.allow) {
        f.log.warn({ agent: req.agent, reasons: policyDecision.reasons }, 'workflow step completion denied by policy');
        return reply.code(403).send({ 
          error: 'forbidden', 
          reasons: policyDecision.reasons 
        });
      }

      // Use icn_checkpoint with completeStep=true to complete the step
      const result = await icnCheckpoint({
        workflowId: body.workflowId,
        stepId: body.stepId,
        data: body.outputs || {},
        completeStep: true,
        sourceRequestId: body.sourceRequestId,
        authContext: {
          agentName: req.agent!.name,
          agentKind: req.agent!.kind
        }
      });

      workflowStepsTotal.inc({ template_id: result.state.templateId || 'unknown', step_id: body.stepId });
      
      f.log.info({ 
        workflowId: body.workflowId, 
        stepId: body.stepId,
        checkpointId: result.checkpoint.id,
        agent: req.agent 
      }, 'workflow step completed successfully');

      return reply.send(result);
    } catch (err: any) {
      f.log.error({ err, agent: req.agent }, 'error completing workflow step');
      return reply.code(400).send({ error: err.message || 'invalid request' });
    }
  });

  // Orchestrate ad-hoc intents
  f.post('/workflow/orchestrate', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      const body = OrchestrationRequest.parse(req.body);
      
      // Policy check for workflow orchestration
      const policyDecision = checkPolicy({
        actor: req.agent!.name,
        changedPaths: ['workflows/'] // Generic workflow orchestration permission
      });
      
      if (!policyDecision.allow) {
        f.log.warn({ agent: req.agent, reasons: policyDecision.reasons }, 'workflow orchestration denied by policy');
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
        actor: body.actor || req.agent!.name
      });
      
      f.log.info({ 
        intent: body.intent,
        planId: result.plan.id,
        complexity: result.plan.complexity,
        agent: req.agent 
      }, 'workflow orchestration completed');

      return reply.send(result);
    } catch (err: any) {
      f.log.error({ err, agent: req.agent }, 'error orchestrating workflow');
      return reply.code(400).send({ error: err.message || 'invalid request' });
    }
  });

  // Workflow actions (pause, resume, fail)
  f.post('/workflow/action', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      const body = WorkflowActionRequest.parse(req.body);
      
      // Policy check for workflow modification
      const policyDecision = checkPolicy({
        actor: req.agent!.name,
        changedPaths: [`workflows/${body.workflowId}`]
      });
      
      if (!policyDecision.allow) {
        f.log.warn({ agent: req.agent, reasons: policyDecision.reasons }, 'workflow action denied by policy');
        return reply.code(403).send({ 
          error: 'forbidden', 
          reasons: policyDecision.reasons 
        });
      }

      // TODO: Call appropriate MCP tools for workflow actions
      f.log.info({ 
        workflowId: body.workflowId, 
        action: body.action,
        agent: req.agent 
      }, 'workflow action requested');

      return reply.send({
        message: 'Workflow API ready - will integrate with MCP tools',
        workflowId: body.workflowId,
        action: body.action,
        agent: req.agent!.name
      });
    } catch (err: any) {
      f.log.error({ err, agent: req.agent }, 'error executing workflow action');
      return reply.code(400).send({ error: err.message || 'invalid request' });
    }
  });
}