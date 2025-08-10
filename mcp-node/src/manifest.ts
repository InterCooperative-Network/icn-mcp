export interface ToolManifest {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export function generateToolManifest(): ToolManifest[] {
  return [
    {
      name: 'icn_get_architecture',
      description: 'Get ICN architecture and protocol documentation, optionally filtered by task relevance',
      inputSchema: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'Optional task description to filter relevant architecture sections'
          }
        }
      }
    },
    {
      name: 'icn_get_invariants',
      description: 'List all system invariants from the ICN invariants catalog',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'icn_check_policy',
      description: 'Validate a changeset against ICN policies and get approval status',
      inputSchema: {
        type: 'object',
        properties: {
          changeset: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of file paths that would be changed'
          },
          actor: {
            type: 'string',
            description: 'The actor (user/agent) making the changes'
          }
        },
        required: ['changeset']
      }
    },
    {
      name: 'icn_get_task_context',
      description: 'Get full task briefing including requirements, constraints, and guidance',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The ID of the task to get context for'
          }
        },
        required: ['taskId']
      }
    }
  ];
}