#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { generateToolManifest } from './manifest.js';
import { icnGetArchitecture } from './tools/icn_get_architecture.js';
import { icnGetInvariants } from './tools/icn_get_invariants.js';
import { icnCheckPolicy } from './tools/icn_check_policy.js';
import { icnGetTaskContext } from './tools/icn_get_task_context.js';
import { icnGetSimilarPrs } from './tools/icn_get_similar_prs.js';
import { icnSuggestApproach } from './tools/icn_suggest_approach.js';

class ICNMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'icn-mcp',
        version: '0.0.1',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = generateToolManifest();
      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'icn_get_architecture': {
            const task = typeof args?.task === 'string' ? args.task : undefined;
            const result = await icnGetArchitecture(task);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_get_invariants': {
            const result = await icnGetInvariants();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_check_policy': {
            if (!args?.changeset || !Array.isArray(args.changeset)) {
              throw new Error('changeset parameter is required and must be an array');
            }
            const actor = typeof args.actor === 'string' ? args.actor : undefined;
            const result = await icnCheckPolicy({
              changeset: args.changeset,
              actor,
            });
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_get_task_context': {
            if (!args?.taskId || typeof args.taskId !== 'string') {
              throw new Error('taskId parameter is required and must be a string');
            }
            const result = await icnGetTaskContext({ taskId: args.taskId });
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_get_similar_prs': {
            if (!args?.description || typeof args.description !== 'string') {
              throw new Error('description parameter is required and must be a string');
            }
            const files = Array.isArray(args.files) ? args.files : undefined;
            const limit = typeof args.limit === 'number' ? args.limit : undefined;
            const result = await icnGetSimilarPrs({
              description: args.description,
              files,
              limit
            });
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_suggest_approach': {
            if (!args?.task_description || typeof args.task_description !== 'string') {
              throw new Error('task_description parameter is required and must be a string');
            }
            const files_to_modify = Array.isArray(args.files_to_modify) ? args.files_to_modify : undefined;
            const constraints = Array.isArray(args.constraints) ? args.constraints : undefined;
            const context = typeof args.context === 'string' ? args.context : undefined;
            const result = await icnSuggestApproach({
              task_description: args.task_description,
              files_to_modify,
              constraints,
              context
            });
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('ICN MCP Server running on stdio');
  }
}

// Start the server
const server = new ICNMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});