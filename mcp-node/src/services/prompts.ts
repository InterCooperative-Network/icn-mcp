import { listAllPrompts, generatePrompt, getPromptMetadata } from '../prompts/index.js';

interface PromptListItem {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

interface PromptResponse {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  messages: Array<{
    role: string;
    content: {
      type: string;
      text: string;
    };
  }>;
}

/**
 * Service for managing MCP prompts
 */
export class PromptService {
  /**
   * List all available prompts with metadata
   */
  async listPrompts(): Promise<PromptListItem[]> {
    try {
      const prompts = listAllPrompts().map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments.map(arg => ({
          name: arg.name,
          description: arg.description || '',
          required: arg.required ?? false,
        })),
      }));
      return prompts;
    } catch (error) {
      console.error('[Prompt Service] Error listing prompts:', error);
      return [];
    }
  }

  /**
   * Get a specific prompt by name
   */
  async getPrompt(name: string, args?: Record<string, any>): Promise<PromptResponse> {
    try {
      // Validate prompt exists
      const promptMeta = getPromptMetadata(name);
      if (!promptMeta) {
        throw new Error(`Prompt '${name}' not found`);
      }

      // Generate prompt with provided arguments
      const result = generatePrompt(name, args || {});
      if (!result.success) {
        throw new Error(`Failed to generate prompt: ${result.errors?.join(', ')}`);
      }

      return {
        name: promptMeta.name,
        description: promptMeta.description,
        arguments: promptMeta.arguments.map(arg => ({
          name: arg.name,
          description: arg.description || '',
          required: arg.required ?? false,
        })),
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: result.content || ''
            }
          }
        ]
      };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Error getting prompt '${name}': ${errorMessage}`);
    }
  }
}