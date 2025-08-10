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

      // Timeout wrapper for tool execution
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

      try {
        switch (name) {
          case 'icn_get_architecture': {
            const task = typeof args?.task === 'string' ? args.task : undefined;
            const result = await executeWithTimeout(() => icnGetArchitecture(task));
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
            const result = await executeWithTimeout(() => icnGetInvariants());
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
            const result = await executeWithTimeout(() => icnCheckPolicy({
              changeset: args.changeset as string[],
              actor,
            }));
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
            const result = await executeWithTimeout(() => icnGetTaskContext({ taskId: args.taskId as string }));
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
            const result = await executeWithTimeout(() => icnGetSimilarPrs({
              description: args.description as string,
              files,
              limit
            }));
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
            const result = await executeWithTimeout(() => icnSuggestApproach({
              task_description: args.task_description as string,
              files_to_modify,
              constraints,
              context
            }));
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

    // Handle process signals gracefully
    process.on('SIGINT', async () => {
      console.error('[MCP] Received SIGINT, shutting down gracefully...');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('[MCP] Received SIGTERM, shutting down gracefully...');
      await this.server.close();
      process.exit(0);
    });

    // Handle broken pipes and stdio errors
    process.stdin.on('error', (error) => {
      console.error('[MCP] stdin error:', error);
      // If stdin is broken, we can't receive messages, so exit
      process.exit(1);
    });

    process.stdout.on('error', (error) => {
      console.error('[MCP] stdout error:', error);
      // If stdout is broken, we can't send responses, so exit
      process.exit(1);
    });

    // Handle unexpected exits
    process.on('uncaughtException', (error) => {
      console.error('[MCP] Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[MCP] Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    
    // Enhanced transport error handling
    transport.onclose = () => {
      console.error('[MCP] Transport connection closed');
      // Exit gracefully when transport closes
      process.exit(0);
    };

    transport.onerror = (error) => {
      console.error('[MCP] Transport error:', error);
      // Log the error but don't immediately exit - let the transport try to recover
      // If it's a critical error (like broken pipe), the transport will close and trigger onclose
    };

    try {
      // Set a timeout for connection establishment
      const connectionTimeout = setTimeout(() => {
        console.error('[MCP] Connection timeout after 30 seconds');
        process.exit(1);
      }, 30000);

      await this.server.connect(transport);
      clearTimeout(connectionTimeout);
      
      console.error('ICN MCP Server running on stdio');
      
      // Keep the process alive and handle any connection issues
      setInterval(() => {
        // Periodic health check - if stdin/stdout are closed, we should exit
        if (process.stdin.destroyed || process.stdout.destroyed) {
          console.error('[MCP] Stdio streams destroyed, exiting...');
          process.exit(1);
        }
      }, 10000); // Check every 10 seconds
      
    } catch (error) {
      console.error('[MCP] Failed to connect transport:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new ICNMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});