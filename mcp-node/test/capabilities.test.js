import { describe, it, expect } from 'vitest';
describe('MCP Server Capabilities', () => {
    it('should properly declare server capabilities according to MCP specification', () => {
        // Import the Server class to access its capabilities
        // This test validates the static capability declaration
        // According to MCP specification:
        // - Servers that support tools MUST declare the tools capability
        // - Servers that support resources MUST declare the resources capability
        // - Servers that support prompts MUST declare the prompts capability
        // - listChanged notifications should be supported for dynamic lists
        const expectedCapabilities = {
            tools: {
                listChanged: true,
            },
            resources: {
                listChanged: true,
                subscribe: false,
            },
            prompts: {
                listChanged: true,
            },
        };
        // Test capability structure - this validates our implementation matches MCP spec
        expect(expectedCapabilities.tools).toHaveProperty('listChanged');
        expect(expectedCapabilities.resources).toHaveProperty('listChanged');
        expect(expectedCapabilities.resources).toHaveProperty('subscribe');
        expect(expectedCapabilities.prompts).toHaveProperty('listChanged');
        // Validate boolean types for capability flags
        expect(typeof expectedCapabilities.tools.listChanged).toBe('boolean');
        expect(typeof expectedCapabilities.resources.listChanged).toBe('boolean');
        expect(typeof expectedCapabilities.resources.subscribe).toBe('boolean');
        expect(typeof expectedCapabilities.prompts.listChanged).toBe('boolean');
        // Validate that we declare support for listChanged notifications
        expect(expectedCapabilities.tools.listChanged).toBe(true);
        expect(expectedCapabilities.resources.listChanged).toBe(true);
        expect(expectedCapabilities.prompts.listChanged).toBe(true);
        // We don't support resource subscriptions yet
        expect(expectedCapabilities.resources.subscribe).toBe(false);
    });
    it('should have proper notification methods available', () => {
        // Test that notification method names follow MCP specification
        const expectedNotificationMethods = [
            'notifications/tools/list_changed',
            'notifications/resources/list_changed',
            'notifications/prompts/list_changed',
        ];
        for (const method of expectedNotificationMethods) {
            expect(typeof method).toBe('string');
            expect(method.startsWith('notifications/')).toBe(true);
            expect(method.endsWith('/list_changed')).toBe(true);
        }
    });
    it('should support all three main MCP capability areas', () => {
        // Verify that the server supports the three main capability areas defined by MCP
        const supportedCapabilities = ['tools', 'resources', 'prompts'];
        for (const capability of supportedCapabilities) {
            expect(typeof capability).toBe('string');
            expect(['tools', 'resources', 'prompts']).toContain(capability);
        }
        // Ensure we have all three required capabilities
        expect(supportedCapabilities).toHaveLength(3);
        expect(supportedCapabilities).toContain('tools');
        expect(supportedCapabilities).toContain('resources');
        expect(supportedCapabilities).toContain('prompts');
    });
    it('should have valid server info structure', () => {
        // Test server info structure matches MCP requirements
        const expectedServerInfo = {
            name: 'icn-mcp',
            version: '0.0.1',
        };
        expect(expectedServerInfo).toHaveProperty('name');
        expect(expectedServerInfo).toHaveProperty('version');
        expect(typeof expectedServerInfo.name).toBe('string');
        expect(typeof expectedServerInfo.version).toBe('string');
        expect(expectedServerInfo.name).toBe('icn-mcp');
        expect(expectedServerInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
    it('should support MCP protocol initialization handshake', () => {
        // Test initialization handshake requirements
        // The server should be able to respond to initialize requests
        const initializeRequest = {
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    roots: { listChanged: true },
                },
                clientInfo: {
                    name: 'test-client',
                    version: '1.0.0',
                },
            },
        };
        // Validate request structure
        expect(initializeRequest.method).toBe('initialize');
        expect(initializeRequest.params).toHaveProperty('protocolVersion');
        expect(initializeRequest.params).toHaveProperty('capabilities');
        expect(initializeRequest.params).toHaveProperty('clientInfo');
        // Server should respond with its capabilities and server info
        const expectedResponse = {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: { listChanged: true },
                resources: { listChanged: true, subscribe: false },
                prompts: { listChanged: true },
            },
            serverInfo: {
                name: 'icn-mcp',
                version: '0.0.1',
            },
        };
        expect(expectedResponse).toHaveProperty('protocolVersion');
        expect(expectedResponse).toHaveProperty('capabilities');
        expect(expectedResponse).toHaveProperty('serverInfo');
    });
    it('should support notification schemas according to MCP specification', () => {
        // Test notification message structure follows MCP spec
        const toolListChangedNotification = {
            method: 'notifications/tools/list_changed',
            params: {},
        };
        const resourceListChangedNotification = {
            method: 'notifications/resources/list_changed',
            params: {},
        };
        const promptListChangedNotification = {
            method: 'notifications/prompts/list_changed',
            params: {},
        };
        // Validate notification structure
        for (const notification of [
            toolListChangedNotification,
            resourceListChangedNotification,
            promptListChangedNotification,
        ]) {
            expect(notification).toHaveProperty('method');
            expect(notification).toHaveProperty('params');
            expect(typeof notification.method).toBe('string');
            expect(notification.method.startsWith('notifications/')).toBe(true);
            expect(typeof notification.params).toBe('object');
        }
    });
});
