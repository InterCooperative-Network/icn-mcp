import { describe, it, expect } from 'vitest';
import { 
  icnWorkflow, 
  ARCHITECTURE_INTENT_REGEX, 
  POLICY_INTENT_REGEX, 
  TASK_INTENT_REGEX, 
  APPROACH_INTENT_REGEX 
} from '../src/tools/icn_workflow.js';

describe('Workflow Orchestration', () => {
  describe('Intent Regex Patterns', () => {
    it('should match architecture-related intents', () => {
      expect(ARCHITECTURE_INTENT_REGEX.test('Design a new system')).toBe(true);
      expect(ARCHITECTURE_INTENT_REGEX.test('Review the architecture')).toBe(true);
      expect(ARCHITECTURE_INTENT_REGEX.test('Structure the component')).toBe(true);
      expect(ARCHITECTURE_INTENT_REGEX.test('System integration')).toBe(true);
      expect(ARCHITECTURE_INTENT_REGEX.test('Simple text without keywords')).toBe(false);
    });

    it('should match policy-related intents', () => {
      expect(POLICY_INTENT_REGEX.test('Check policy compliance')).toBe(true);
      expect(POLICY_INTENT_REGEX.test('Define access rules')).toBe(true);
      expect(POLICY_INTENT_REGEX.test('Allow this permission')).toBe(true);
      expect(POLICY_INTENT_REGEX.test('Deny access')).toBe(true);
      expect(POLICY_INTENT_REGEX.test('Simple text without keywords')).toBe(false);
    });

    it('should match task-related intents', () => {
      expect(TASK_INTENT_REGEX.test('Implement new feature')).toBe(true);
      expect(TASK_INTENT_REGEX.test('Plan the development')).toBe(true);
      expect(TASK_INTENT_REGEX.test('Build a component')).toBe(true);
      expect(TASK_INTENT_REGEX.test('Modify existing code')).toBe(true);
      expect(TASK_INTENT_REGEX.test('Add new functionality')).toBe(true);
      expect(TASK_INTENT_REGEX.test('Create a new service')).toBe(true);
      expect(TASK_INTENT_REGEX.test('Update the system')).toBe(true);
      expect(TASK_INTENT_REGEX.test('Simple text without keywords')).toBe(false);
    });

    it('should match approach-related intents', () => {
      expect(APPROACH_INTENT_REGEX.test('How should I implement this?')).toBe(true);
      expect(APPROACH_INTENT_REGEX.test('What approach should we take?')).toBe(true);
      expect(APPROACH_INTENT_REGEX.test('Suggest a method')).toBe(true);
      expect(APPROACH_INTENT_REGEX.test('Define the strategy')).toBe(true);
      expect(APPROACH_INTENT_REGEX.test('Simple text without keywords')).toBe(false);
    });

    it('should use word boundaries to avoid partial matches', () => {
      expect(ARCHITECTURE_INTENT_REGEX.test('architectural')).toBe(false);
      expect(ARCHITECTURE_INTENT_REGEX.test('designed')).toBe(false);
      expect(TASK_INTENT_REGEX.test('implementation')).toBe(false);
      expect(APPROACH_INTENT_REGEX.test('approached')).toBe(false);
      
      // But should match when used as separate words
      expect(ARCHITECTURE_INTENT_REGEX.test('architect work')).toBe(true);
      expect(TASK_INTENT_REGEX.test('implement feature')).toBe(true);
    });
  });

  describe('icnWorkflow', () => {
    it('should create a plan for architecture-related intent', async () => {
      const result = await icnWorkflow({
        intent: 'Design a new MCP tool for data processing',
        context: 'mcp-node workspace',
        actor: 'architect',
        _testSeed: 'test1'
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
        intent: 'Review system architecture for component integration',
        _testSeed: 'test2'
      });

      const architectureStep = result.plan.steps.find(step => step.tool === 'icn_get_architecture');
      expect(architectureStep).toBeDefined();
      expect(architectureStep?.params.task).toContain('architecture');
    });

    it('should include invariants tool for system design intents', async () => {
      const result = await icnWorkflow({
        intent: 'Implement new system component with proper constraints',
        _testSeed: 'test3'
      });

      const invariantsStep = result.plan.steps.find(step => step.tool === 'icn_get_invariants');
      expect(invariantsStep).toBeDefined();
      expect(invariantsStep?.description).toContain('invariants');
    });

    it('should include policy check for implementation intents', async () => {
      const result = await icnWorkflow({
        intent: 'Modify mcp-server configuration and add new API endpoint',
        actor: 'ops',
        _testSeed: 'test4'
      });

      const policyStep = result.plan.steps.find(step => step.tool === 'icn_check_policy');
      expect(policyStep).toBeDefined();
      expect(policyStep?.params.changeset).toBeInstanceOf(Array);
      expect(policyStep?.params.actor).toBe('ops');
    });

    it('should include approach suggestion for planning intents', async () => {
      const result = await icnWorkflow({
        intent: 'How should I implement a new workflow template system?',
        constraints: ['maintain backward compatibility', 'follow existing patterns'],
        _testSeed: 'test5'
      });

      const approachStep = result.plan.steps.find(step => step.tool === 'icn_suggest_approach');
      expect(approachStep).toBeDefined();
      expect(approachStep?.params.task_description).toContain('implement');
      expect(approachStep?.params.constraints).toContain('maintain backward compatibility');
    });

    it('should handle task context when context is provided', async () => {
      const result = await icnWorkflow({
        intent: 'Complete the implementation task',
        context: 'TASK-123',
        _testSeed: 'test6'
      });

      const taskStep = result.plan.steps.find(step => step.tool === 'icn_get_task_context');
      expect(taskStep).toBeDefined();
      expect(taskStep?.params.taskId).toBe('TASK-123');
    });

    it('should determine complexity based on number of steps', async () => {
      const simpleResult = await icnWorkflow({
        intent: 'Get system architecture overview',
        _testSeed: 'test7'
      });
      
      const complexResult = await icnWorkflow({
        intent: 'Design, implement, test, and deploy a new governance system with policy validation',
        context: 'full-system-upgrade',
        constraints: ['security first', 'backward compatibility', 'performance'],
        _testSeed: 'test8'
      });

      expect(simpleResult.plan.complexity).toBe('low');
      expect(complexResult.plan.complexity).toMatch(/^(medium|high)$/);
      expect(complexResult.plan.steps.length).toBeGreaterThan(simpleResult.plan.steps.length);
    });

    it('should establish proper dependencies between steps', async () => {
      const result = await icnWorkflow({
        intent: 'Implement new feature with proper architecture review and policy compliance',
        actor: 'architect',
        _testSeed: 'test'
      });

      // Find steps with dependencies
      const stepsWithDeps = result.plan.steps.filter(step => step.dependsOn && step.dependsOn.length > 0);
      
      if (stepsWithDeps.length > 0) {
        for (const step of stepsWithDeps) {
          // Verify dependencies reference valid step IDs
          const allStepIds = result.plan.steps.map(s => s.id);
          for (const dep of step.dependsOn!) {
            expect(allStepIds).toContain(dep);
          }
        }
      }
    });

    it('should extract likely file paths from intent', async () => {
      const result = await icnWorkflow({
        intent: 'Update mcp-server API and add new agent capabilities',
        actor: 'architect',
        _testSeed: 'test9'
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
        intent: 'Minimal test intent for error handling',
        _testSeed: 'test10'
      });

      // The orchestration should complete without throwing errors
      expect(result.execution.status).toMatch(/^(completed|failed)$/);
      
      if (result.execution.status === 'failed') {
        expect(result.execution.stepResults.error).toBeDefined();
      }
    });

    it('should provide meaningful step descriptions', async () => {
      const result = await icnWorkflow({
        intent: 'Create comprehensive development plan for new feature',
        _testSeed: 'test11'
      });

      for (const step of result.plan.steps) {
        expect(step.description).toBeDefined();
        expect(step.description.length).toBeGreaterThan(10);
        expect(step.description).toMatch(/^[A-Z]/); // Should start with capital letter
      }
    });
  });
});