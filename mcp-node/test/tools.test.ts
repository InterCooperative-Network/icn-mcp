import { describe, it, expect } from 'vitest';
import { icnGetArchitecture } from '../src/tools/icn_get_architecture.js';
import { icnGetInvariants } from '../src/tools/icn_get_invariants.js';
import { icnCheckPolicy } from '../src/tools/icn_check_policy.js';
import { icnGetTaskContext } from '../src/tools/icn_get_task_context.js';

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
});