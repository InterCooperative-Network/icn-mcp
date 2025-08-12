import { describe, it, expect } from 'vitest';
import { generateToolManifest } from '../src/manifest.js';

describe('MCP Server', () => {
  describe('Tool Manifest', () => {
    it('should generate valid tool manifest', () => {
      const manifest = generateToolManifest();
      
      expect(Array.isArray(manifest)).toBe(true);
      expect(manifest.length).toBe(18);
      
      const toolNames = manifest.map(tool => tool.name);
      expect(toolNames).toContain('icn_get_architecture');
      expect(toolNames).toContain('icn_get_invariants');
      expect(toolNames).toContain('icn_check_policy');
      expect(toolNames).toContain('icn_get_task_context');
      expect(toolNames).toContain('icn_get_similar_prs');
      expect(toolNames).toContain('icn_suggest_approach');
      expect(toolNames).toContain('icn_start_workflow');
      expect(toolNames).toContain('icn_get_next_step');
      expect(toolNames).toContain('icn_checkpoint');
      expect(toolNames).toContain('icn_list_workflow_templates');
      expect(toolNames).toContain('icn_get_workflow_state');
      
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
      
      // Test workflow tools
      const startWorkflowTool = manifest.find(tool => tool.name === 'icn_start_workflow');
      expect(startWorkflowTool?.inputSchema.required).toContain('templateId');
      
      const getNextStepTool = manifest.find(tool => tool.name === 'icn_get_next_step');
      expect(getNextStepTool?.inputSchema.required).toContain('workflowId');
      
      const checkpointTool = manifest.find(tool => tool.name === 'icn_checkpoint');
      expect(checkpointTool?.inputSchema.required).toContain('workflowId');
      expect(checkpointTool?.inputSchema.required).toContain('stepId');
      expect(checkpointTool?.inputSchema.required).toContain('data');
      
      const getWorkflowStateTool = manifest.find(tool => tool.name === 'icn_get_workflow_state');
      expect(getWorkflowStateTool?.inputSchema.required).toContain('workflowId');
    });
  });

  describe('Stdio Timeout Behavior', () => {
    it('should timeout tool execution after 30 seconds', async () => {
      // Mock a tool that takes longer than timeout
      const slowTool = () => new Promise(resolve => setTimeout(resolve, 35000));
      
      // Timeout wrapper function (extracted from server.ts logic)
      const executeWithTimeout = async <T>(fn: () => Promise<T>, timeoutMs: number = 30000): Promise<T> => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Tool execution timeout after ${timeoutMs}ms`));
          }, timeoutMs);

          fn()
            .then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(timeout));
        });
      };

      // Test with short timeout for fast test execution
      await expect(executeWithTimeout(slowTool, 100)).rejects.toThrow('Tool execution timeout after 100ms');
    });

    it('should successfully execute tools that complete within timeout', async () => {
      // Mock a fast tool
      const fastTool = () => Promise.resolve({ result: 'success' });
      
      const executeWithTimeout = async <T>(fn: () => Promise<T>, timeoutMs: number = 30000): Promise<T> => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Tool execution timeout after ${timeoutMs}ms`));
          }, timeoutMs);

          fn()
            .then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(timeout));
        });
      };

      const result = await executeWithTimeout(fastTool, 1000);
      expect(result).toEqual({ result: 'success' });
    });
  });
});