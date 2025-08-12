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
    },
    {
      name: 'icn_get_similar_prs',
      description: 'Mine past PRs to find similar patterns and approaches for the current task',
      inputSchema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Description of the current task or feature being implemented'
          },
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of files being modified to find relevant PR patterns'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of similar PRs to return (default: 5)',
            minimum: 1,
            maximum: 20
          }
        },
        required: ['description']
      }
    },
    {
      name: 'icn_suggest_approach',
      description: 'Suggest implementation approaches using ICN playbooks and best practices',
      inputSchema: {
        type: 'object',
        properties: {
          task_description: {
            type: 'string',
            description: 'Description of the task or feature to implement'
          },
          files_to_modify: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of files that will be modified'
          },
          constraints: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of constraints or requirements'
          },
          context: {
            type: 'string',
            description: 'Optional additional context about the task'
          }
        },
        required: ['task_description']
      }
    },
    {
      name: 'icn_start_workflow',
      description: 'Start a new workflow from a template for complex multi-step tasks',
      inputSchema: {
        type: 'object',
        properties: {
          templateId: {
            type: 'string',
            description: 'ID of the workflow template to start'
          },
          initialData: {
            type: 'object',
            description: 'Optional initial data for the workflow',
            additionalProperties: true
          }
        },
        required: ['templateId']
      }
    },
    {
      name: 'icn_get_next_step',
      description: 'Get the next step in an active workflow',
      inputSchema: {
        type: 'object',
        properties: {
          workflowId: {
            type: 'string',
            description: 'ID of the workflow to get next step for'
          }
        },
        required: ['workflowId']
      }
    },
    {
      name: 'icn_checkpoint',
      description: 'Create a checkpoint to save workflow progress and optionally complete current step',
      inputSchema: {
        type: 'object',
        properties: {
          workflowId: {
            type: 'string',
            description: 'ID of the workflow to checkpoint'
          },
          stepId: {
            type: 'string',
            description: 'ID of the current step being checkpointed'
          },
          data: {
            type: 'object',
            description: 'Data to save in the checkpoint',
            additionalProperties: true
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the checkpoint'
          },
          completeStep: {
            type: 'boolean',
            description: 'Whether to mark the current step as complete',
            default: false
          }
        },
        required: ['workflowId', 'stepId', 'data']
      }
    },
    {
      name: 'icn_list_workflow_templates',
      description: 'List available workflow templates',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'icn_get_workflow_state',
      description: 'Get current state and history of a workflow',
      inputSchema: {
        type: 'object',
        properties: {
          workflowId: {
            type: 'string',
            description: 'ID of the workflow to get state for'
          }
        },
        required: ['workflowId']
      }
    },
    {
      name: 'icn_extract_principles',
      description: 'Parse documents for MUST/SHOULD/MAY requirements, invariants, formulas, and governance rules with confidence scores',
      inputSchema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'Document content to extract principles from (optional if using existing knowledge base)'
          },
          filePath: {
            type: 'string',
            description: 'File path for the content (optional, used for source attribution)'
          },
          types: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['MUST', 'SHOULD', 'MAY', 'invariant', 'formula', 'governance']
            },
            description: 'Types of principles to extract (optional, defaults to all types)'
          },
          minConfidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Minimum confidence score for returned principles (optional, defaults to 0)'
          }
        }
      }
    },
    {
      name: 'icn_build_context',
      description: 'Build adaptive contextual guidance by searching knowledge graph for relevant concepts, principles, and examples',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Task description or question about ICN to get contextual guidance for'
          },
          maxResults: {
            type: 'number',
            minimum: 1,
            maximum: 50,
            description: 'Maximum number of results per category (optional, defaults to 10)'
          },
          includeExamples: {
            type: 'boolean',
            description: 'Whether to include examples from documents (optional, defaults to false)'
          },
          includeWarnings: {
            type: 'boolean',
            description: 'Whether to include warnings about conflicts or uncertainties (optional, defaults to false)'
          },
          focusAreas: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['principles', 'concepts', 'relations', 'examples']
            },
            description: 'Areas to focus on for context building (optional, defaults to all areas)'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'icn_learn_from_feedback',
      description: 'Learn from feedback about what worked, what failed, and corrections to update knowledge graph weights and relationships',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['success', 'failure', 'correction', 'improvement'],
            description: 'Type of feedback being provided'
          },
          context: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The original query or task description'
              },
              principleIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'IDs of principles that were involved'
              },
              conceptNames: {
                type: 'array',
                items: { type: 'string' },
                description: 'Names of concepts that were involved'
              },
              taskDescription: {
                type: 'string',
                description: 'Description of the task that was attempted'
              }
            },
            description: 'Context about what the feedback relates to'
          },
          feedback: {
            type: 'object',
            properties: {
              whatWorked: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of approaches or principles that worked well'
              },
              whatFailed: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of approaches or principles that failed'
              },
              corrections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    principleId: { type: 'string' },
                    conceptName: { type: 'string' },
                    originalValue: { type: 'string' },
                    correctedValue: { type: 'string' },
                    reason: { type: 'string' }
                  },
                  required: ['originalValue', 'correctedValue', 'reason']
                },
                description: 'Specific corrections to principles or concepts'
              },
              suggestions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Suggestions for improvement'
              },
              confidenceAdjustment: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    principleId: { type: 'string' },
                    conceptName: { type: 'string' },
                    newConfidence: { type: 'number', minimum: 0, maximum: 1 },
                    reason: { type: 'string' }
                  },
                  required: ['newConfidence', 'reason']
                },
                description: 'Adjustments to confidence scores'
              }
            },
            description: 'The feedback data'
          },
          metadata: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              userId: { type: 'string' }
            },
            description: 'Optional metadata about the feedback source'
          }
        },
        required: ['type', 'context', 'feedback']
      }
    },
    {
      name: 'icn_synthesize_spec',
      description: 'Synthesize OpenAPI/JSON schema specifications from ICN surface principles and requirements',
      inputSchema: {
        type: 'object',
        properties: {
          surface: {
            type: 'string',
            description: 'ICN surface name (e.g., "Identity", "Jobs", "Event Log", "Governance", "Issuance", or "Identity/Attestation")'
          }
        },
        required: ['surface']
      }
    },
    {
      name: 'icn_check_invariants',
      description: 'Check code or design proposals against ICN invariants (event-sourced, deterministic, democratic, non-transferable CC, no token-bought voting)',
      inputSchema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Source code to analyze for invariant compliance'
          },
          design: {
            type: 'string',
            description: 'Design proposal or specification to analyze'
          },
          description: {
            type: 'string',
            description: 'Text description of the component or feature to analyze'
          }
        }
      }
    },
    {
      name: 'icn_validate_implementation',
      description: 'Validate source code implementation against synthesized specs and ICN principles',
      inputSchema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Source code to validate'
          },
          surface: {
            type: 'string',
            description: 'Optional ICN surface to validate against (enables spec synthesis and validation)'
          },
          description: {
            type: 'string',
            description: 'Optional description of the component being validated'
          }
        },
        required: ['code']
      }
    },
    {
      name: 'icn_generate_tests',
      description: 'Generate comprehensive test cases for ICN components including happy paths, edge cases, and attack scenarios',
      inputSchema: {
        type: 'object',
        properties: {
          component: {
            type: 'string',
            description: 'Component name to generate tests for'
          },
          surface: {
            type: 'string',
            description: 'Optional ICN surface name for specialized test generation'
          },
          requirements: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of specific requirements to test'
          },
          description: {
            type: 'string',
            description: 'Optional description of the component functionality'
          }
        },
        required: ['component']
      }
    }
  ];
}