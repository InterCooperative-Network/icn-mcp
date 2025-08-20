import { describe, it, expect } from 'vitest';
import { generateToolManifest } from '../src/manifest.js';
describe('Workflow Orchestration Integration', () => {
    it('should include icn_workflow in tool manifest', () => {
        const manifest = generateToolManifest();
        const workflowTool = manifest.find(tool => tool.name === 'icn_workflow');
        expect(workflowTool).toBeDefined();
        expect(workflowTool?.description).toContain('Orchestrate');
        expect(workflowTool?.description).toContain('multiple MCP tools');
        expect(workflowTool?.inputSchema.required).toContain('intent');
        // Check that the schema has all expected properties
        const properties = workflowTool?.inputSchema.properties;
        expect(properties).toHaveProperty('intent');
        expect(properties).toHaveProperty('context');
        expect(properties).toHaveProperty('constraints');
        expect(properties).toHaveProperty('actor');
    });
    it('should have proper input schema for icn_workflow', () => {
        const manifest = generateToolManifest();
        const workflowTool = manifest.find(tool => tool.name === 'icn_workflow');
        expect(workflowTool?.inputSchema.properties.intent.type).toBe('string');
        expect(workflowTool?.inputSchema.properties.context.type).toBe('string');
        expect(workflowTool?.inputSchema.properties.constraints.type).toBe('array');
        expect(workflowTool?.inputSchema.properties.actor.type).toBe('string');
        // Only intent should be required
        expect(workflowTool?.inputSchema.required).toEqual(['intent']);
    });
    it('should position icn_workflow appropriately in tool list', () => {
        const manifest = generateToolManifest();
        const toolNames = manifest.map(tool => tool.name);
        // Verify workflow orchestration is included alongside other workflow tools
        expect(toolNames).toContain('icn_workflow');
        expect(toolNames).toContain('icn_start_workflow');
        expect(toolNames).toContain('icn_get_workflow_state');
        // Should be positioned after basic workflow tools but before specialized tools
        const workflowIndex = toolNames.indexOf('icn_workflow');
        const startWorkflowIndex = toolNames.indexOf('icn_start_workflow');
        expect(workflowIndex).toBeGreaterThan(startWorkflowIndex);
    });
});
