import { describe, it, expect } from 'vitest';
import { icnWorkflow } from '../src/tools/icn_workflow.js';

describe('Workflow Orchestration', () => {
  describe('icnWorkflow', () => {
    it('should create a plan for architecture-related intent', async () => {
      const result = await icnWorkflow({
        intent: 'Design a new MCP tool for data processing',
        context: 'mcp-node workspace',
        actor: 'architect'
      });

      expect(result.plan).toBeDefined();
      expect(result.plan.intent).toBe('Design a new MCP tool for data processing');
      expect(result.plan.steps).toBeInstanceOf(Array);
      expect(result.plan.steps.length).toBeGreaterThan(0);
      expect(result.plan.complexity).toMatch(/^(low|medium|high)$/);
      expect(result.plan.expectedDuration).toContain('seconds');

      expect(result.execution).toBeDefined();
      expect(result.execution.status).toMatch(/^(pending|in_progress|completed|failed)$/);
      expect(result.execution.startedAt).toBeInstanceOf(Date);
      expect(result.execution.stepResults).toBeDefined();
    });

    it('should include architecture tool for architecture-related intents', async () => {
      const result = await icnWorkflow({
        intent: 'Review system architecture for component integration'
      });

      const architectureStep = result.plan.steps.find(step => step.tool === 'icn_get_architecture');
      expect(architectureStep).toBeDefined();
      expect(architectureStep?.params.task).toContain('architecture');
    });

    it('should include invariants tool for system design intents', async () => {
      const result = await icnWorkflow({
        intent: 'Implement new system component with proper constraints'
      });

      const invariantsStep = result.plan.steps.find(step => step.tool === 'icn_get_invariants');
      expect(invariantsStep).toBeDefined();
      expect(invariantsStep?.description).toContain('invariants');
    });

    it('should include policy check for implementation intents', async () => {
      const result = await icnWorkflow({
        intent: 'Modify mcp-server configuration and add new API endpoint',
        actor: 'ops'
      });

      const policyStep = result.plan.steps.find(step => step.tool === 'icn_check_policy');
      expect(policyStep).toBeDefined();
      expect(policyStep?.params.changeset).toBeInstanceOf(Array);
      expect(policyStep?.params.actor).toBe('ops');
    });

    it('should include approach suggestion for planning intents', async () => {
      const result = await icnWorkflow({
        intent: 'How should I implement a new workflow template system?',
        constraints: ['maintain backward compatibility', 'follow existing patterns']
      });

      const approachStep = result.plan.steps.find(step => step.tool === 'icn_suggest_approach');
      expect(approachStep).toBeDefined();
      expect(approachStep?.params.task_description).toContain('implement');
      expect(approachStep?.params.constraints).toContain('maintain backward compatibility');
    });

    it('should handle task context when context is provided', async () => {
      const result = await icnWorkflow({
        intent: 'Complete the implementation task',
        context: 'TASK-123'
      });

      const taskStep = result.plan.steps.find(step => step.tool === 'icn_get_task_context');
      expect(taskStep).toBeDefined();
      expect(taskStep?.params.taskId).toBe('TASK-123');
    });

    it('should determine complexity based on number of steps', async () => {
      const simpleResult = await icnWorkflow({
        intent: 'Get system architecture overview'
      });
      
      const complexResult = await icnWorkflow({
        intent: 'Design, implement, test, and deploy a new governance system with policy validation',
        context: 'full-system-upgrade',
        constraints: ['security first', 'backward compatibility', 'performance']
      });

      expect(simpleResult.plan.complexity).toBe('low');
      expect(complexResult.plan.complexity).toMatch(/^(medium|high)$/);
      expect(complexResult.plan.steps.length).toBeGreaterThan(simpleResult.plan.steps.length);
    });

    it('should establish proper dependencies between steps', async () => {
      const result = await icnWorkflow({
        intent: 'Implement new feature with proper architecture review and policy compliance',
        actor: 'architect'
      });

      // Find steps with dependencies
      const stepsWithDeps = result.plan.steps.filter(step => step.dependsOn && step.dependsOn.length > 0);
      
      if (stepsWithDeps.length > 0) {
        for (const step of stepsWithDeps) {
          // Verify dependencies reference valid step tools
          const allStepTools = result.plan.steps.map(s => s.tool);
          for (const dep of step.dependsOn!) {
            expect(allStepTools).toContain(dep);
          }
        }
      }
    });

    it('should extract likely file paths from intent', async () => {
      const result = await icnWorkflow({
        intent: 'Update mcp-server API and add new agent capabilities',
        actor: 'architect'
      });

      const policyStep = result.plan.steps.find(step => step.tool === 'icn_check_policy');
      if (policyStep) {
        expect(policyStep.params.changeset).toContain('mcp-server/src/');
        expect(policyStep.params.changeset).toContain('agents/');
      }
    });

    it('should handle errors gracefully for invalid tool parameters', async () => {
      // This test ensures the orchestration handles malformed steps gracefully
      const result = await icnWorkflow({
        intent: 'Minimal test intent for error handling'
      });

      // The orchestration should complete without throwing errors
      expect(result.execution.status).toMatch(/^(completed|failed)$/);
      
      if (result.execution.status === 'failed') {
        expect(result.execution.stepResults.error).toBeDefined();
      }
    });

    it('should provide meaningful step descriptions', async () => {
      const result = await icnWorkflow({
        intent: 'Create comprehensive development plan for new feature'
      });

      for (const step of result.plan.steps) {
        expect(step.description).toBeDefined();
        expect(step.description.length).toBeGreaterThan(10);
        expect(step.description).toMatch(/^[A-Z]/); // Should start with capital letter
      }
    });
  });
});