import { describe, it, expect } from 'vitest';
import { icnGetArchitecture } from '../src/tools/icn_get_architecture.js';
import { icnGetInvariants } from '../src/tools/icn_get_invariants.js';
import { icnCheckPolicy } from '../src/tools/icn_check_policy.js';
import { icnGetTaskContext } from '../src/tools/icn_get_task_context.js';
import { icnGetSimilarPrs } from '../src/tools/icn_get_similar_prs.js';
import { icnSuggestApproach } from '../src/tools/icn_suggest_approach.js';

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
});