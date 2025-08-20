/**
 * Tests for user consent and UI features
 */
import { describe, test, expect } from 'vitest';
import { ConsentManager } from '../src/consent/index.js';
import { icnDisplayTools } from '../src/tools/icn_display_tools.js';
import { icnRequestConsent } from '../src/tools/icn_request_consent.js';
import { icnReportProgress } from '../src/tools/icn_progress.js';
describe('User Consent and UI Features', () => {
    describe('ConsentManager', () => {
        test('should create consent manager with default config', () => {
            const manager = new ConsentManager();
            expect(manager).toBeDefined();
        });
        test('should correctly identify tools requiring consent', () => {
            const manager = new ConsentManager();
            // High-risk tools should require consent
            expect(manager.requiresConsent('icn_write_patch')).toBe(true);
            expect(manager.requiresConsent('icn_run_tests')).toBe(true);
            // Low-risk tools should not require consent by default
            expect(manager.requiresConsent('icn_get_architecture')).toBe(false);
            expect(manager.requiresConsent('icn_get_invariants')).toBe(false);
        });
        test('should create consent request with proper structure', () => {
            const manager = new ConsentManager();
            const request = manager.createConsentRequest('icn_write_patch', {
                files: ['test.ts'],
                changeset: ['src/test.ts']
            });
            expect(request).toMatchObject({
                toolName: 'icn_write_patch',
                description: expect.any(String),
                details: {
                    riskLevel: 'high',
                    estimatedTime: expect.any(String),
                    filesToRead: ['test.ts'],
                    filesToModify: ['src/test.ts']
                },
                requiredApproval: true
            });
        });
        test('should create formatted consent prompt', () => {
            const manager = new ConsentManager();
            const request = manager.createConsentRequest('icn_write_patch', {});
            const prompt = manager.createConsentPrompt(request);
            expect(prompt).toContain('Tool Execution Request');
            expect(prompt).toContain('icn_write_patch');
            expect(prompt).toContain('**Risk Level:** high');
            expect(prompt).toContain('Do you want to proceed');
        });
        test('should get tools display with categorization', () => {
            const manager = new ConsentManager();
            const tools = manager.getToolsDisplay();
            expect(tools).toBeInstanceOf(Array);
            expect(tools.length).toBeGreaterThan(0);
            tools.forEach(tool => {
                expect(tool).toMatchObject({
                    name: expect.any(String),
                    description: expect.any(String),
                    category: expect.any(String),
                    riskLevel: expect.stringMatching(/^(low|medium|high)$/),
                    requiredParams: expect.any(Array),
                    optionalParams: expect.any(Array)
                });
            });
        });
        test('should create progress updates', () => {
            const manager = new ConsentManager();
            const update = manager.createProgressUpdate('test-tool', 'validation', 50, 'Checking policies');
            expect(update).toMatchObject({
                toolName: 'test-tool',
                phase: 'validation',
                progress: 50,
                message: 'Checking policies',
                timestamp: expect.any(String)
            });
        });
    });
    describe('icn_display_tools', () => {
        test('should return all tools with proper structure', async () => {
            const result = await icnDisplayTools();
            expect(result).toMatchObject({
                tools: expect.any(Array),
                totalCount: expect.any(Number),
                categories: expect.any(Array)
            });
            expect(result.tools.length).toBeGreaterThan(0);
            expect(result.totalCount).toBe(result.tools.length);
            expect(result.categories.length).toBeGreaterThan(0);
        });
        test('should filter tools by category', async () => {
            const result = await icnDisplayTools({ category: 'architecture' });
            expect(result.tools.every(tool => tool.category === 'architecture')).toBe(true);
        });
        test('should include consent requirement information', async () => {
            const result = await icnDisplayTools();
            result.tools.forEach(tool => {
                expect(tool).toHaveProperty('requiresConsent');
                expect(typeof tool.requiresConsent).toBe('boolean');
            });
        });
    });
    describe('icn_request_consent', () => {
        test('should create consent request for valid tool', async () => {
            const result = await icnRequestConsent({
                toolName: 'icn_write_patch',
                context: 'Testing consent flow'
            });
            expect(result).toMatchObject({
                request: expect.objectContaining({
                    toolName: 'icn_write_patch',
                    description: expect.any(String),
                    details: expect.objectContaining({
                        riskLevel: 'high'
                    })
                }),
                prompt: expect.stringContaining('Tool Execution Request'),
                instructions: expect.stringContaining('review the above information'),
                requestId: expect.stringMatching(/^consent_/)
            });
        });
        test('should include context in prompt when provided', async () => {
            const context = 'Special testing scenario';
            const result = await icnRequestConsent({
                toolName: 'icn_get_architecture',
                context
            });
            expect(result.prompt).toContain(context);
        });
        test('should throw error for missing toolName', async () => {
            await expect(icnRequestConsent({})).rejects.toThrow('toolName is required');
        });
    });
    describe('icn_report_progress', () => {
        test('should create progress report with formatted output', async () => {
            const result = await icnReportProgress({
                toolName: 'test-tool',
                phase: 'validation',
                progress: 75,
                message: 'Nearly complete'
            });
            expect(result).toMatchObject({
                update: expect.objectContaining({
                    toolName: 'test-tool',
                    phase: 'validation',
                    progress: 75,
                    message: 'Nearly complete'
                }),
                formatted: expect.stringContaining('Progress Update'),
                isComplete: false
            });
            expect(result.formatted).toContain('75%');
            expect(result.formatted).toContain('validation');
        });
        test('should mark as complete when progress is 100', async () => {
            const result = await icnReportProgress({
                toolName: 'test-tool',
                phase: 'complete',
                progress: 100,
                message: 'Finished'
            });
            expect(result.isComplete).toBe(true);
            expect(result.formatted).toContain('Execution Complete');
        });
        test('should clamp progress values', async () => {
            const resultHigh = await icnReportProgress({
                toolName: 'test-tool',
                phase: 'test',
                progress: 150,
                message: 'Over 100'
            });
            const resultLow = await icnReportProgress({
                toolName: 'test-tool',
                phase: 'test',
                progress: -10,
                message: 'Below 0'
            });
            expect(resultHigh.update.progress).toBe(100);
            expect(resultLow.update.progress).toBe(0);
        });
        test('should throw error for missing required parameters', async () => {
            await expect(icnReportProgress({
                toolName: 'test-tool',
                progress: 50
            })).rejects.toThrow('message parameter is required');
        });
    });
});
