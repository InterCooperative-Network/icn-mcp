import { describe, it, expect } from 'vitest';
import { generateToolManifest } from '../src/manifest.js';

describe('MCP Server', () => {
  describe('Tool Manifest', () => {
    it('should generate valid tool manifest', () => {
      const manifest = generateToolManifest();
      
      expect(Array.isArray(manifest)).toBe(true);
      expect(manifest.length).toBe(6);
      
      const toolNames = manifest.map(tool => tool.name);
      expect(toolNames).toContain('icn_get_architecture');
      expect(toolNames).toContain('icn_get_invariants');
      expect(toolNames).toContain('icn_check_policy');
      expect(toolNames).toContain('icn_get_task_context');
      expect(toolNames).toContain('icn_get_similar_prs');
      expect(toolNames).toContain('icn_suggest_approach');
      
      // Check tool structure
      for (const tool of manifest) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.inputSchema).toBe('object');
      }
    });

    it('should include required parameters for tools that need them', () => {
      const manifest = generateToolManifest();
      
      const checkPolicyTool = manifest.find(tool => tool.name === 'icn_check_policy');
      expect(checkPolicyTool?.inputSchema.required).toContain('changeset');
      
      const taskContextTool = manifest.find(tool => tool.name === 'icn_get_task_context');
      expect(taskContextTool?.inputSchema.required).toContain('taskId');
      
      const similarPrsTool = manifest.find(tool => tool.name === 'icn_get_similar_prs');
      expect(similarPrsTool?.inputSchema.required).toContain('description');
      
      const suggestApproachTool = manifest.find(tool => tool.name === 'icn_suggest_approach');
      expect(suggestApproachTool?.inputSchema.required).toContain('task_description');
    });
  });
});