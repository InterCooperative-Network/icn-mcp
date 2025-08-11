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

// We'll need to initialize the workflow system differently since we can't import across workspaces
// For now, let's create a placeholder that will be properly wired up

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

export function registerWorkflowRoutes(f: FastifyInstance) {
  // Workflow management endpoints - these will integrate with MCP tools
  
  // List workflow templates
  f.get('/workflow/templates', async (req, reply) => {
    try {
      // TODO: This should call the MCP tool icn_list_workflow_templates
      // For now, return basic structure
      return reply.send({
        templates: [],
        categories: [],
        tags: [],
        message: 'Workflow API endpoints ready - integrate with MCP tools'
      });
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

      // TODO: Call MCP tool icn_start_workflow here
      workflowsStartedTotal.inc({ template_id: body.templateId });
      workflowActiveGauge.inc({ template_id: body.templateId });
      
      f.log.info({ 
        templateId: body.templateId, 
        agent: req.agent 
      }, 'workflow start requested');

      return reply.send({
        message: 'Workflow API ready - will integrate with MCP tools',
        templateId: body.templateId,
        agent: req.agent!.name
      });
    } catch (err: any) {
      f.log.error({ err, agent: req.agent }, 'error starting workflow');
      return reply.code(400).send({ error: err.message || 'invalid request' });
    }
  });

  // Get workflow state
  f.get('/workflow/:workflowId', { preHandler: requireAuth() }, async (req, reply) => {
    try {
      const { workflowId } = req.params as { workflowId: string };
      
      // TODO: Call MCP tool icn_get_workflow_state here
      f.log.info({ workflowId, agent: req.agent }, 'workflow state requested');

      return reply.send({
        message: 'Workflow API ready - will integrate with MCP tools',
        workflowId,
        agent: req.agent!.name
      });
    } catch (err: any) {
      f.log.error({ err, agent: req.agent }, 'error getting workflow state');
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

      // TODO: Call MCP tool icn_checkpoint here
      workflowCheckpointsTotal.inc({ template_id: 'unknown' }); // Will get from workflow state when integrated
      
      f.log.info({ 
        workflowId: body.workflowId, 
        stepId: body.stepId,
        agent: req.agent 
      }, 'workflow checkpoint requested');

      return reply.send({
        message: 'Workflow API ready - will integrate with MCP tools',
        workflowId: body.workflowId,
        stepId: body.stepId,
        agent: req.agent!.name
      });
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

      // TODO: Call MCP tool to complete step
      workflowStepsTotal.inc({ template_id: 'unknown', step_id: body.stepId }); // Will get from workflow state when integrated
      
      f.log.info({ 
        workflowId: body.workflowId, 
        stepId: body.stepId,
        agent: req.agent 
      }, 'workflow step completion requested');

      return reply.send({
        message: 'Workflow API ready - will integrate with MCP tools',
        workflowId: body.workflowId,
        stepId: body.stepId,
        agent: req.agent!.name
      });
    } catch (err: any) {
      f.log.error({ err, agent: req.agent }, 'error completing workflow step');
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