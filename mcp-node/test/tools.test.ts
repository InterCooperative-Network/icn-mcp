import { describe, it, expect } from 'vitest';
import { icnGetArchitecture } from '../src/tools/icn_get_architecture.js';
import { icnGetInvariants } from '../src/tools/icn_get_invariants.js';
import { icnCheckPolicy } from '../src/tools/icn_check_policy.js';
import { icnGetTaskContext } from '../src/tools/icn_get_task_context.js';
import { icnGetSimilarPrs } from '../src/tools/icn_get_similar_prs.js';
import { icnSuggestApproach } from '../src/tools/icn_suggest_approach.js';
import { icnExtractPrinciples } from '../src/tools/icn_extract_principles.js';
import { icnBuildContext } from '../src/tools/icn_build_context.js';
import { icnLearnFromFeedback } from '../src/tools/icn_learn_from_feedback.js';
import { 
  icnStartWorkflow, 
  icnGetNextStep, 
  icnCheckpoint, 
  icnListWorkflowTemplates,
  icnGetWorkflowState
} from '../src/tools/icn_workflow.js';

describe('ICN Tools', () => {
  describe('icnGetArchitecture', () => {
    it('should return architecture sections', async () => {
      const result = await icnGetArchitecture();
      expect(result).toHaveProperty('sections');
      expect(Array.isArray(result.sections)).toBe(true);
      
      if (result.sections.length > 0) {
        const section = result.sections[0];
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('path');
        expect(section).toHaveProperty('content');
        expect(typeof section.title).toBe('string');
        expect(typeof section.path).toBe('string');
        expect(typeof section.content).toBe('string');
      }
    });

    it('should filter by task when provided', async () => {
      const result = await icnGetArchitecture('agents');
      expect(result).toHaveProperty('sections');
      expect(Array.isArray(result.sections)).toBe(true);
    });
  });

  describe('icnGetInvariants', () => {
    it('should return invariants list', async () => {
      const result = await icnGetInvariants();
      expect(result).toHaveProperty('invariants');
      expect(Array.isArray(result.invariants)).toBe(true);
      
      if (result.invariants.length > 0) {
        const invariant = result.invariants[0];
        expect(invariant).toHaveProperty('id');
        expect(invariant).toHaveProperty('statement');
        expect(typeof invariant.id).toBe('string');
        expect(typeof invariant.statement).toBe('string');
      }
    });
  });

  describe('icnCheckPolicy', () => {
    it('should validate changeset against policies', async () => {
      const result = await icnCheckPolicy({
        changeset: ['docs/test.md'],
        actor: 'architect'
      });
      
      expect(result).toHaveProperty('allow');
      expect(result).toHaveProperty('reasons');
      expect(result).toHaveProperty('suggestions');
      expect(typeof result.allow).toBe('boolean');
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should reject unauthorized paths', async () => {
      const result = await icnCheckPolicy({
        changeset: ['.github/workflows/test.yml'],
        actor: 'architect'
      });
      
      expect(result.allow).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('icnGetTaskContext', () => {
    it('should return task context', async () => {
      const result = await icnGetTaskContext({ taskId: 'test-task' });
      
      expect(result).toHaveProperty('task');
      expect(result).toHaveProperty('repo');
      expect(result).toHaveProperty('policy');
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('conventions');
      expect(result).toHaveProperty('starter_files');
      
      expect(result.task.id).toBe('test-task');
      expect(Array.isArray(result.steps)).toBe(true);
      expect(Array.isArray(result.starter_files)).toBe(true);
    });
  });

  describe('icnGetSimilarPrs', () => {
    it('should return similar PRs with patterns', async () => {
      const result = await icnGetSimilarPrs({
        description: 'add new MCP tool for semantic search',
        files: ['mcp-node/src/tools/search.ts'],
        limit: 3
      });
      
      expect(result).toHaveProperty('similar_prs');
      expect(result).toHaveProperty('patterns_identified');
      expect(result).toHaveProperty('recommended_practices');
      expect(Array.isArray(result.similar_prs)).toBe(true);
      expect(Array.isArray(result.patterns_identified)).toBe(true);
      expect(Array.isArray(result.recommended_practices)).toBe(true);
      
      if (result.similar_prs.length > 0) {
        const pr = result.similar_prs[0];
        expect(pr).toHaveProperty('pr_number');
        expect(pr).toHaveProperty('title');
        expect(pr).toHaveProperty('approach_taken');
        expect(pr).toHaveProperty('similarity_score');
        expect(typeof pr.pr_number).toBe('number');
        expect(typeof pr.title).toBe('string');
        expect(typeof pr.similarity_score).toBe('number');
      }
    });

    it('should handle empty files array', async () => {
      const result = await icnGetSimilarPrs({
        description: 'add documentation'
      });
      
      expect(result).toHaveProperty('similar_prs');
      expect(Array.isArray(result.similar_prs)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const result = await icnGetSimilarPrs({
        description: 'enhance search capabilities',
        limit: 2
      });
      
      expect(result.similar_prs.length).toBeLessThanOrEqual(2);
    });
  });

  describe('icnSuggestApproach', () => {
    it('should suggest approaches with playbooks', async () => {
      const result = await icnSuggestApproach({
        task_description: 'add new MCP tool for GitHub integration',
        files_to_modify: ['mcp-node/src/tools/github.ts', 'mcp-node/src/manifest.ts'],
        constraints: ['must respect GitHub rate limits']
      });
      
      expect(result).toHaveProperty('recommended_playbooks');
      expect(result).toHaveProperty('suggested_approaches');
      expect(result).toHaveProperty('key_considerations');
      expect(result).toHaveProperty('next_steps');
      expect(Array.isArray(result.recommended_playbooks)).toBe(true);
      expect(Array.isArray(result.suggested_approaches)).toBe(true);
      expect(Array.isArray(result.key_considerations)).toBe(true);
      expect(Array.isArray(result.next_steps)).toBe(true);
      
      if (result.recommended_playbooks.length > 0) {
        const playbook = result.recommended_playbooks[0];
        expect(playbook).toHaveProperty('id');
        expect(playbook).toHaveProperty('name');
        expect(playbook).toHaveProperty('relevance_score');
        expect(typeof playbook.relevance_score).toBe('number');
      }
      
      if (result.suggested_approaches.length > 0) {
        const approach = result.suggested_approaches[0];
        expect(approach).toHaveProperty('approach_name');
        expect(approach).toHaveProperty('description');
        expect(approach).toHaveProperty('steps');
        expect(approach).toHaveProperty('estimated_effort');
        expect(approach).toHaveProperty('risk_level');
        expect(Array.isArray(approach.steps)).toBe(true);
      }
    });

    it('should handle minimal input', async () => {
      const result = await icnSuggestApproach({
        task_description: 'simple task'
      });
      
      expect(result).toHaveProperty('recommended_playbooks');
      expect(result).toHaveProperty('suggested_approaches');
      expect(result.suggested_approaches.length).toBeGreaterThan(0);
    });

    it('should include MCP-specific suggestions for MCP tasks', async () => {
      const result = await icnSuggestApproach({
        task_description: 'add new MCP tool',
        files_to_modify: ['mcp-node/src/tools/new_tool.ts']
      });
      
      const hasMcpApproach = result.suggested_approaches.some(
        approach => approach.approach_name.toLowerCase().includes('mcp')
      );
      expect(hasMcpApproach).toBe(true);
    });
  });

  describe('Workflow Tools', () => {
    describe('icnListWorkflowTemplates', () => {
      it('should return available workflow templates', async () => {
        const result = await icnListWorkflowTemplates();
        
        expect(result).toHaveProperty('templates');
        expect(result).toHaveProperty('categories');
        expect(result).toHaveProperty('tags');
        expect(Array.isArray(result.templates)).toBe(true);
        expect(Array.isArray(result.categories)).toBe(true);
        expect(Array.isArray(result.tags)).toBe(true);
        
        if (result.templates.length > 0) {
          const template = result.templates[0];
          expect(template).toHaveProperty('id');
          expect(template).toHaveProperty('name');
          expect(template).toHaveProperty('description');
          expect(template).toHaveProperty('steps');
          expect(Array.isArray(template.steps)).toBe(true);
        }
      });
    });

    describe('icnStartWorkflow', () => {
      it('should start a workflow if template exists', async () => {
        // First get available templates
        const templates = await icnListWorkflowTemplates();
        
        if (templates.templates.length > 0) {
          const templateId = templates.templates[0].id;
          const result = await icnStartWorkflow({ 
            templateId,
            initialData: { testData: 'test value' }
          });
          
          expect(result).toHaveProperty('workflowId');
          expect(result).toHaveProperty('template');
          expect(result).toHaveProperty('nextStep');
          expect(result).toHaveProperty('state');
          expect(typeof result.workflowId).toBe('string');
          expect(result.template.id).toBe(templateId);
          expect(result.state.status).toBe('active');
        }
      });

      it('should throw error for non-existent template', async () => {
        await expect(icnStartWorkflow({ templateId: 'non-existent-template' }))
          .rejects.toThrow(/not found/);
      });
    });

    describe('icnGetNextStep and icnCheckpoint', () => {
      it('should handle workflow progression', async () => {
        // First get available templates
        const templates = await icnListWorkflowTemplates();
        
        if (templates.templates.length > 0) {
          const templateId = templates.templates[0].id;
          
          // Start workflow
          const startResult = await icnStartWorkflow({ templateId });
          const workflowId = startResult.workflowId;
          
          // Get next step
          const nextStepResult = await icnGetNextStep({ workflowId });
          expect(nextStepResult).toHaveProperty('nextStep');
          expect(nextStepResult).toHaveProperty('state');
          expect(nextStepResult).toHaveProperty('availableActions');
          expect(Array.isArray(nextStepResult.availableActions)).toBe(true);
          
          if (nextStepResult.nextStep.step) {
            const stepId = nextStepResult.nextStep.step.id;
            
            // Create checkpoint
            const checkpointResult = await icnCheckpoint({
              workflowId,
              stepId,
              data: { progress: 'checkpoint created' },
              notes: 'Test checkpoint'
            });
            
            expect(checkpointResult).toHaveProperty('checkpoint');
            expect(checkpointResult).toHaveProperty('nextStep');
            expect(checkpointResult).toHaveProperty('state');
            expect(checkpointResult.checkpoint.stepId).toBe(stepId);
            expect(checkpointResult.checkpoint.notes).toBe('Test checkpoint');
          }
        }
      });

      it('should throw error for non-existent workflow', async () => {
        await expect(icnGetNextStep({ workflowId: 'non-existent-workflow' }))
          .rejects.toThrow(/not found/);
      });
    });

    describe('icnGetWorkflowState', () => {
      it('should return workflow state', async () => {
        // First get available templates
        const templates = await icnListWorkflowTemplates();
        
        if (templates.templates.length > 0) {
          const templateId = templates.templates[0].id;
          
          // Start workflow
          const startResult = await icnStartWorkflow({ templateId });
          const workflowId = startResult.workflowId;
          
          // Get state
          const state = await icnGetWorkflowState({ workflowId });
          expect(state).toHaveProperty('workflowId');
          expect(state).toHaveProperty('templateId');
          expect(state).toHaveProperty('status');
          expect(state).toHaveProperty('completedSteps');
          expect(state).toHaveProperty('checkpoints');
          expect(state.workflowId).toBe(workflowId);
          expect(state.templateId).toBe(templateId);
        }
      });

      it('should throw error for non-existent workflow', async () => {
        await expect(icnGetWorkflowState({ workflowId: 'non-existent-workflow' }))
          .rejects.toThrow(/not found/);
      });
    });
  });

  describe('Knowledge System Tools', () => {
    describe('icnExtractPrinciples', () => {
      it('should extract principles from content', async () => {
        const result = await icnExtractPrinciples({
          content: 'The system MUST validate all inputs. The network SHOULD use encryption.'
        });
        
        expect(result).toHaveProperty('principles');
        expect(result).toHaveProperty('summary');
        expect(Array.isArray(result.principles)).toBe(true);
        expect(result.summary).toHaveProperty('totalFound');
        expect(result.summary).toHaveProperty('byType');
        expect(result.summary).toHaveProperty('avgConfidence');
      });

      it('should work without content (search existing)', async () => {
        const result = await icnExtractPrinciples({});
        
        expect(result).toHaveProperty('principles');
        expect(result).toHaveProperty('summary');
        expect(Array.isArray(result.principles)).toBe(true);
      });

      it('should filter by types', async () => {
        const result = await icnExtractPrinciples({
          content: 'The system MUST validate. The network SHOULD encrypt.',
          types: ['MUST']
        });
        
        expect(result.principles.every(p => p.type === 'MUST')).toBe(true);
      });
    });

    describe('icnBuildContext', () => {
      it('should build context for queries', async () => {
        const result = await icnBuildContext({
          query: 'How to implement voting mechanisms?'
        });
        
        expect(result).toHaveProperty('query');
        expect(result).toHaveProperty('guidance');
        expect(result).toHaveProperty('metadata');
        expect(result.guidance).toHaveProperty('relevantPrinciples');
        expect(result.guidance).toHaveProperty('relatedConcepts');
        expect(result.guidance).toHaveProperty('recommendations');
        expect(result.metadata).toHaveProperty('searchTime');
        expect(result.metadata).toHaveProperty('confidenceScore');
      });

      it('should respect maxResults parameter', async () => {
        const result = await icnBuildContext({
          query: 'governance',
          maxResults: 3
        });
        
        expect(result.guidance.relevantPrinciples.length).toBeLessThanOrEqual(3);
        expect(result.guidance.relatedConcepts.length).toBeLessThanOrEqual(3);
      });

      it('should include warnings when requested', async () => {
        const result = await icnBuildContext({
          query: 'completely unknown topic xyz123',
          includeWarnings: true
        });
        
        expect(Array.isArray(result.guidance.warnings)).toBe(true);
      });
    });

    describe('icnLearnFromFeedback', () => {
      it('should process success feedback', async () => {
        const result = await icnLearnFromFeedback({
          type: 'success',
          context: {
            query: 'test implementation'
          },
          feedback: {
            whatWorked: ['Democratic approach', 'Consensus mechanism']
          },
          metadata: {
            source: 'test'
          }
        });
        
        expect(result).toHaveProperty('feedbackId');
        expect(result).toHaveProperty('processed');
        expect(result).toHaveProperty('learning');
        expect(result).toHaveProperty('recommendations');
        expect(result).toHaveProperty('status');
        expect(result.status).toBe('success');
        expect(Array.isArray(result.recommendations)).toBe(true);
      });

      it('should process failure feedback', async () => {
        const result = await icnLearnFromFeedback({
          type: 'failure',
          context: {
            query: 'failed implementation'
          },
          feedback: {
            whatFailed: ['Centralized approach']
          },
          metadata: {
            source: 'test'
          }
        });
        
        expect(result.status).toBe('success');
        expect(result.learning).toHaveProperty('principleUpdates');
        expect(result.learning).toHaveProperty('conceptUpdates');
      });

      it('should process corrections', async () => {
        const result = await icnLearnFromFeedback({
          type: 'correction',
          context: {
            principleIds: ['test-principle']
          },
          feedback: {
            corrections: [{
              originalValue: 'old value',
              correctedValue: 'new value',
              reason: 'test correction'
            }]
          },
          metadata: {
            source: 'test'
          }
        });
        
        expect(result.status).toBe('success');
        expect(result.processed.principles).toBeGreaterThanOrEqual(0);
      });

      it('should handle confidence adjustments', async () => {
        const result = await icnLearnFromFeedback({
          type: 'improvement',
          context: {
            conceptNames: ['test-concept']
          },
          feedback: {
            confidenceAdjustment: [{
              conceptName: 'test-concept',
              newConfidence: 0.8,
              reason: 'proven effective'
            }]
          },
          metadata: {
            source: 'test'
          }
        });
        
        expect(result.status).toBe('success');
        expect(result.learning.conceptUpdates.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Specification Synthesis and Validation Framework', () => {
    describe('icnSynthesizeSpec', () => {
      it('should synthesize spec for Identity surface', async () => {
        const { icnSynthesizeSpec } = await import('../src/tools/icn_synthesize_spec.js');
        const result = await icnSynthesizeSpec({ surface: 'Identity' });
        
        expect(result).toHaveProperty('surface', 'Identity');
        expect(result).toHaveProperty('openapi');
        expect(result).toHaveProperty('requirements');
        expect(result).toHaveProperty('invariants');
        expect(result).toHaveProperty('reasoning');
        
        expect(result.openapi.info.title).toContain('Identity');
        expect(result.requirements.length).toBeGreaterThan(0);
        expect(result.invariants.length).toBe(5); // 5 core ICN invariants
        expect(result.reasoning.length).toBeGreaterThan(0);
      });

      it('should synthesize spec for Event Log surface', async () => {
        const { icnSynthesizeSpec } = await import('../src/tools/icn_synthesize_spec.js');
        const result = await icnSynthesizeSpec({ surface: 'Event Log' });
        
        expect(result.surface).toBe('Event Log');
        expect(result.openapi.paths).toHaveProperty('/events/append');
        expect(result.requirements.some(r => r.field === 'eventId')).toBe(true);
        expect(result.requirements.some(r => r.field === 'hash')).toBe(true);
      });

      it('should handle Identity/Attestation subsurface', async () => {
        const { icnSynthesizeSpec } = await import('../src/tools/icn_synthesize_spec.js');
        const result = await icnSynthesizeSpec({ surface: 'Identity/Attestation' });
        
        expect(result.surface).toBe('Identity/Attestation');
        expect(result.openapi.paths).toHaveProperty('/attestation/create');
        expect(result.requirements.some(r => r.field === 'attestationId')).toBe(true);
      });

      it('should throw error for unknown surface', async () => {
        const { icnSynthesizeSpec } = await import('../src/tools/icn_synthesize_spec.js');
        await expect(icnSynthesizeSpec({ surface: 'NonExistent' }))
          .rejects.toThrow('Unknown ICN surface');
      });
    });

    describe('icnCheckInvariants', () => {
      it('should pass for compliant event-sourced code', async () => {
        const { icnCheckInvariants } = await import('../src/tools/icn_check_invariants.js');
        const code = `
          async function createMember(data) {
            const event = { eventType: 'MemberCreated', payload: data };
            await eventLog.append(event);
            return event;
          }
        `;
        
        const result = await icnCheckInvariants({ code });
        
        expect(result).toHaveProperty('overallPass');
        expect(result).toHaveProperty('checks');
        expect(result.checks.length).toBe(5);
        
        const eventSourceCheck = result.checks.find(c => c.id === 'INV-EVENTSOURCE-001');
        expect(eventSourceCheck?.passed).toBe(true);
        expect(eventSourceCheck?.evidence.length).toBeGreaterThan(0);
      });

      it('should fail for non-deterministic code', async () => {
        const { icnCheckInvariants } = await import('../src/tools/icn_check_invariants.js');
        const code = `
          function generateId() {
            return Math.random().toString();
          }
          function createMember() {
            const id = Date.now();
            return { id, random: Math.random() };
          }
        `;
        
        const result = await icnCheckInvariants({ code });
        
        const deterministicCheck = result.checks.find(c => c.id === 'INV-DETERMINISTIC-001');
        expect(deterministicCheck?.passed).toBe(false);
        expect(deterministicCheck?.violations.length).toBeGreaterThan(0);
        expect(deterministicCheck?.suggestions.length).toBeGreaterThan(0);
      });

      it('should fail for CC transfer code', async () => {
        const { icnCheckInvariants } = await import('../src/tools/icn_check_invariants.js');
        const code = `
          function transferCC(from, to, amount) {
            from.ccBalance -= amount;
            to.ccBalance += amount;
          }
        `;
        
        const result = await icnCheckInvariants({ code });
        
        const transferCheck = result.checks.find(c => c.id === 'INV-NONTRANSFERABLE-001');
        expect(transferCheck?.passed).toBe(false);
        expect(transferCheck?.violations.some(v => v.includes('transfer'))).toBe(true);
      });

      it('should work with design descriptions', async () => {
        const { icnCheckInvariants } = await import('../src/tools/icn_check_invariants.js');
        const design = `
          This system will use event sourcing to track all state changes.
          Each member gets one vote per proposal, ensuring democratic governance.
          Contribution Credits are non-transferable and bound to individual members.
        `;
        
        const result = await icnCheckInvariants({ design });
        
        expect(result.overallPass).toBe(false); // Design text alone may not pass all checks
        expect(result.checks.some(c => c.evidence.length > 0)).toBe(true); // But should find some evidence
      });
    });

    describe('icnValidateImplementation', () => {
      it('should validate correct Identity implementation', async () => {
        const { icnValidateImplementation } = await import('../src/tools/icn_validate_implementation.js');
        const code = `
          export interface Identity {
            memberId: string;
            publicKey: string;
            attestations: string[];
            created: string;
            status: 'active' | 'revoked';
          }

          export async function createIdentity(data: Identity): Promise<{success: boolean, identity: Identity}> {
            const event = { eventType: 'IdentityCreated', payload: data };
            await eventLog.append(event);
            return { success: true, identity: data };
          }
        `;
        
        const result = await icnValidateImplementation({ 
          code, 
          surface: 'Identity',
          description: 'Identity management component'
        });
        
        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('issues');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('patterns');
        expect(result.score).toBeGreaterThan(0);
        expect(result.patterns.good.length).toBeGreaterThan(0);
      });

      it('should catch violations in bad implementation', async () => {
        const { icnValidateImplementation } = await import('../src/tools/icn_validate_implementation.js');
        const code = `
          let globalState = {};
          
          function updateMember(id) {
            globalState[id] = Math.random();
            return globalState[id];
          }
          
          function transferCC(from, to, amount) {
            globalState[from] -= amount;
            globalState[to] += amount;
          }
        `;
        
        const result = await icnValidateImplementation({ code });
        
        expect(result.valid).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.patterns.bad.length).toBeGreaterThan(0);
        expect(result.suggestions.length).toBeGreaterThan(0);
      });
    });

    describe('icnGenerateTests', () => {
      it('should generate tests for Governance component', async () => {
        const { icnGenerateTests } = await import('../src/tools/icn_generate_tests.js');
        const result = await icnGenerateTests({ 
          component: 'Governance',
          description: 'Democratic voting system'
        });
        
        expect(result).toHaveProperty('testSuites');
        expect(result).toHaveProperty('coverage');
        expect(result).toHaveProperty('recommendations');
        
        expect(result.testSuites.length).toBe(1);
        const testSuite = result.testSuites[0];
        
        expect(testSuite.component).toBe('Governance');
        expect(testSuite.testCases.length).toBeGreaterThan(0);
        expect(testSuite.imports.length).toBeGreaterThan(0);
        
        // Check for different test types
        expect(testSuite.testCases.some(t => t.category === 'happy_path')).toBe(true);
        expect(testSuite.testCases.some(t => t.category === 'edge_case')).toBe(true);
        expect(testSuite.testCases.some(t => t.category === 'security')).toBe(true);
        expect(testSuite.testCases.some(t => t.category === 'invariant')).toBe(true);
      });

      it('should generate tests for Event Log component', async () => {
        const { icnGenerateTests } = await import('../src/tools/icn_generate_tests.js');
        const result = await icnGenerateTests({ 
          component: 'Event Log',
          surface: 'Event Log'
        });
        
        const testSuite = result.testSuites[0];
        expect(testSuite.component).toBe('Event Log');
        
        // Should have event-specific tests
        expect(testSuite.testCases.some(t => 
          t.name.includes('append') || t.name.includes('event')
        )).toBe(true);
        
        // Coverage should include attack scenarios for immutability
        expect(result.coverage.attackScenarios).toBeGreaterThan(0);
      });

      it('should include comprehensive coverage metrics', async () => {
        const { icnGenerateTests } = await import('../src/tools/icn_generate_tests.js');
        const result = await icnGenerateTests({ component: 'Jobs' });
        
        expect(result.coverage).toHaveProperty('happyPaths');
        expect(result.coverage).toHaveProperty('edgeCases');
        expect(result.coverage).toHaveProperty('attackScenarios');
        expect(result.coverage).toHaveProperty('invariantChecks');
        
        expect(result.coverage.happyPaths).toBeGreaterThan(0);
        expect(result.coverage.invariantChecks).toBeGreaterThan(0);
      });

      it('should throw error for unknown component', async () => {
        const { icnGenerateTests } = await import('../src/tools/icn_generate_tests.js');
        await expect(icnGenerateTests({ component: 'UnknownComponent' }))
          .rejects.toThrow('Unknown component type');
      });
    });
  });
});