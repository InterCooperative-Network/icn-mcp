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
      name: 'icn_workflow',
      description: 'Orchestrate multiple MCP tools to produce actionable plans from intents. This tool sequences other tools like icn_get_architecture, icn_get_invariants, icn_check_policy to create comprehensive implementation plans.',
      inputSchema: {
        type: 'object',
        properties: {
          intent: {
            type: 'string',
            description: 'The high-level intent or goal that needs to be planned and executed'
          },
          context: {
            type: 'string',
            description: 'Optional additional context such as task IDs, file paths, or domain-specific information'
          },
          constraints: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of constraints or limitations to consider'
          },
          actor: {
            type: 'string',
            description: 'The actor (user/agent) who will execute the plan, used for policy checks'
          }
        },
        required: ['intent']
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
    },
    {
      name: 'icn_simulate_economy',
      description: 'Simulate ICN dual economy with CC generation, token flows, federation levies, and demurrage effects',
      inputSchema: {
        type: 'object',
        properties: {
          parameters: {
            type: 'object',
            properties: {
              steps: {
                type: 'number',
                description: 'Number of simulation steps',
                minimum: 1,
                maximum: 1000
              },
              nodeCount: {
                type: 'number', 
                description: 'Number of nodes/participants',
                minimum: 1,
                maximum: 1000
              },
              ccGenerationRate: {
                type: 'number',
                description: 'CC generation rate per node per step',
                minimum: 0
              },
              initialTokens: {
                type: 'number',
                description: 'Initial token distribution per participant',
                minimum: 0
              },
              demurrageRate: {
                type: 'number',
                description: 'Demurrage rate per step (decay factor for idle tokens)',
                minimum: 0,
                maximum: 1
              },
              federationLevyRate: {
                type: 'number',
                description: 'Federation levy rate on cooperative surplus',
                minimum: 0,
                maximum: 1
              },
              settlementFrequency: {
                type: 'number',
                description: 'Settlement frequency (every N steps)',
                minimum: 1
              },
              trustWeights: {
                type: 'array',
                items: { type: 'number', minimum: 0, maximum: 1 },
                description: 'Trust weight distribution (affects CC earning)'
              }
            },
            required: ['steps', 'nodeCount', 'ccGenerationRate', 'initialTokens', 'demurrageRate', 'federationLevyRate', 'settlementFrequency']
          },
          participantBehaviors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                infrastructureContribution: { type: 'number', minimum: 0, maximum: 1 },
                activityLevel: { type: 'number', minimum: 0, maximum: 1 },
                tokenVelocity: { type: 'number', minimum: 0, maximum: 1 },
                trustScore: { type: 'number', minimum: 0, maximum: 1 }
              },
              required: ['id', 'infrastructureContribution', 'activityLevel', 'tokenVelocity', 'trustScore']
            },
            description: 'Optional specific participant behaviors'
          }
        },
        required: ['parameters']
      }
    },
    {
      name: 'icn_build_formula',
      description: 'Build mathematical formulas for ICN economic relationships with explanations and constraints',
      inputSchema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Description of the economic relationship to formulate'
          },
          context: {
            type: 'string',
            description: 'Optional context about the relationship'
          },
          outputType: {
            type: 'string',
            enum: ['amount', 'rate', 'percentage', 'weight', 'boolean'],
            description: 'Expected output type of the formula'
          },
          knownVariables: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                type: { 
                  type: 'string',
                  enum: ['number', 'percentage', 'rate', 'weight', 'boolean']
                },
                range: {
                  type: 'object',
                  properties: {
                    min: { type: 'number' },
                    max: { type: 'number' }
                  }
                }
              },
              required: ['name', 'description', 'type']
            },
            description: 'Known variables or constraints'
          }
        },
        required: ['description']
      }
    },
    {
      name: 'icn_economic_advice',
      description: 'Analyze economic mechanisms and provide advice on wealth distribution, participation, and stability impacts',
      inputSchema: {
        type: 'object',
        properties: {
          mechanism: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              parameters: {
                type: 'object',
                additionalProperties: true,
                description: 'Key parameters of the mechanism'
              },
              targetOutcomes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Target outcomes of the mechanism'
              }
            },
            required: ['name', 'description', 'parameters'],
            description: 'Economic mechanism to analyze'
          },
          context: {
            type: 'object',
            properties: {
              networkSize: { type: 'number' },
              averageWealth: { type: 'number' },
              currentGini: { type: 'number', minimum: 0, maximum: 1 },
              tokenVelocity: { type: 'number', minimum: 0, maximum: 1 },
              ccGenerationRate: { type: 'number' }
            },
            description: 'Current economic context'
          },
          concerns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific concerns to address'
          }
        },
        required: ['mechanism']
      }
    },
    {
      name: 'icn_orchestrate_settlement',
      description: 'Orchestrate settlement of inter-organizational transactions with netting, dispute detection, and optimization',
      inputSchema: {
        type: 'object',
        properties: {
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                from: { type: 'string' },
                to: { type: 'string' },
                amount: { type: 'number', minimum: 0 },
                currency: { 
                  type: 'string',
                  enum: ['tokens', 'credits', 'cc']
                },
                timestamp: { type: 'string', format: 'date-time' },
                type: {
                  type: 'string',
                  enum: ['trade', 'service', 'transfer', 'levy', 'fee']
                },
                settlementStatus: {
                  type: 'string',
                  enum: ['pending', 'included', 'settled', 'disputed']
                },
                metadata: {
                  type: 'object',
                  additionalProperties: true
                }
              },
              required: ['id', 'from', 'to', 'amount', 'currency', 'timestamp', 'type', 'settlementStatus']
            },
            description: 'Transactions to settle'
          },
          organizations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                type: {
                  type: 'string',
                  enum: ['cooperative', 'federation', 'individual', 'collective']
                },
                trustScore: { type: 'number', minimum: 0, maximum: 1 },
                preferences: {
                  type: 'object',
                  properties: {
                    minSettlementAmount: { type: 'number' },
                    preferredFrequency: { type: 'number' },
                    maxExposure: { type: 'number' }
                  },
                  required: ['minSettlementAmount', 'preferredFrequency', 'maxExposure']
                }
              },
              required: ['id', 'name', 'type', 'trustScore', 'preferences']
            },
            description: 'Participating organizations'
          },
          exchangeRates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                rate: { type: 'number', minimum: 0 },
                timestamp: { type: 'string', format: 'date-time' },
                confidence: { type: 'number', minimum: 0, maximum: 1 }
              },
              required: ['from', 'to', 'rate', 'timestamp', 'confidence']
            },
            description: 'Exchange rates between currencies'
          },
          preferences: {
            type: 'object',
            properties: {
              forceSettlement: { type: 'boolean' },
              maxDelay: { type: 'number' },
              nettingAlgorithm: {
                type: 'string',
                enum: ['simple', 'multilateral', 'optimized']
              },
              disputeResolution: {
                type: 'string',
                enum: ['automatic', 'manual', 'democratic']
              }
            },
            description: 'Settlement preferences'
          }
        },
        required: ['transactions', 'organizations']
      }
    },
    {
      name: 'icn_build_governance_flow',
      description: 'Build complete governance flow from proposal to execution with democratic processes, voting mechanisms, and enforcement',
      inputSchema: {
        type: 'object',
        properties: {
          decisionType: {
            type: 'string',
            enum: ['constitutional', 'budget', 'policy', 'operational', 'emergency'],
            description: 'Type of decision being made'
          },
          scope: {
            type: 'string',
            enum: ['local', 'regional', 'global', 'federation'],
            description: 'Scope of the decision'
          },
          context: {
            type: 'string',
            description: 'Optional context about the specific decision'
          }
        },
        required: ['decisionType', 'scope']
      }
    },
    {
      name: 'icn_advise_voting',
      description: 'Analyze governance scenarios and recommend optimal voting mechanisms with trade-off analysis and manipulation warnings',
      inputSchema: {
        type: 'object',
        properties: {
          scenario: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              participantCount: { type: 'number', minimum: 1 },
              context: {
                type: 'object',
                properties: {
                  decisionType: {
                    type: 'string',
                    enum: ['election', 'allocation', 'policy', 'constitutional', 'emergency']
                  },
                  scope: {
                    type: 'string',
                    enum: ['local', 'regional', 'federation', 'global']
                  },
                  urgency: {
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'critical']
                  }
                },
                required: ['decisionType', 'scope', 'urgency']
              },
              participants: {
                type: 'object',
                properties: {
                  expertiseLevels: {
                    type: 'string',
                    enum: ['uniform', 'varied', 'highly_specialized']
                  },
                  stakeDistribution: {
                    type: 'string',
                    enum: ['equal', 'proportional', 'weighted', 'highly_unequal']
                  },
                  trustNetwork: {
                    type: 'string',
                    enum: ['high_trust', 'moderate_trust', 'low_trust', 'fragmented']
                  }
                },
                required: ['expertiseLevels', 'stakeDistribution', 'trustNetwork']
              },
              constraints: {
                type: 'object',
                properties: {
                  timeLimit: { type: 'number' },
                  legitimacyRequirements: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  fairnessCriteria: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  resourceLimits: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                },
                required: ['legitimacyRequirements', 'fairnessCriteria']
              }
            },
            required: ['description', 'participantCount', 'context', 'participants', 'constraints']
          },
          goals: {
            type: 'object',
            properties: {
              objectives: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['legitimacy', 'efficiency', 'fairness', 'expertise', 'participation', 'transparency']
                }
              },
              weights: {
                type: 'object',
                additionalProperties: { type: 'number', minimum: 0, maximum: 1 }
              },
              successCriteria: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['objectives', 'weights', 'successCriteria']
          }
        },
        required: ['scenario', 'goals']
      }
    },
    {
      name: 'icn_manage_sortition',
      description: 'Manage fair random selection with constraints for sortition processes, including weighted selection and diversity requirements',
      inputSchema: {
        type: 'object',
        properties: {
          roleRequirements: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              requiredSkills: {
                type: 'array',
                items: { type: 'string' }
              },
              preferredExperience: {
                type: 'array',
                items: { type: 'string' }
              },
              timeCommitment: {
                type: 'object',
                properties: {
                  duration: { type: 'number' },
                  hoursPerWeek: { type: 'number' }
                },
                required: ['duration', 'hoursPerWeek']
              }
            },
            required: ['title', 'description', 'requiredSkills', 'timeCommitment']
          },
          eligibleMembers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                info: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    organization: { type: 'string' },
                    location: { type: 'string' },
                    joinDate: { type: 'string', format: 'date' }
                  },
                  required: ['name', 'joinDate']
                },
                participationHistory: {
                  type: 'object',
                  properties: {
                    previousSelections: { type: 'number' },
                    participationRate: { type: 'number', minimum: 0, maximum: 1 },
                    performanceScores: {
                      type: 'array',
                      items: { type: 'number', minimum: 0, maximum: 1 }
                    }
                  },
                  required: ['previousSelections', 'participationRate', 'performanceScores']
                },
                qualifications: {
                  type: 'object',
                  properties: {
                    skills: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  },
                  required: ['skills']
                },
                availability: {
                  type: 'object',
                  properties: {
                    available: { type: 'boolean' },
                    currentCommitments: { type: 'number' }
                  },
                  required: ['available', 'currentCommitments']
                },
                reputation: {
                  type: 'object',
                  properties: {
                    trustScore: { type: 'number', minimum: 0, maximum: 1 }
                  },
                  required: ['trustScore']
                }
              },
              required: ['id', 'info', 'participationHistory', 'qualifications', 'availability', 'reputation']
            }
          },
          constraints: {
            type: 'object',
            properties: {
              positions: { type: 'number', minimum: 1 }
            },
            required: ['positions']
          },
          parameters: {
            type: 'object',
            properties: {
              cryptographicRandom: { type: 'boolean' },
              allowReplacements: { type: 'boolean' }
            },
            required: ['cryptographicRandom', 'allowReplacements']
          }
        },
        required: ['roleRequirements', 'eligibleMembers', 'constraints', 'parameters']
      }
    },
    {
      name: 'icn_build_policy',
      description: 'Build structured policy objects with validation, conflict detection, and compliance tracking',
      inputSchema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'High-level policy description'
          },
          category: {
            type: 'string',
            enum: ['governance', 'economic', 'technical', 'social', 'operational'],
            description: 'Policy category'
          },
          scope: {
            type: 'object',
            properties: {
              geographic: {
                type: 'string',
                enum: ['local', 'regional', 'federation', 'global']
              },
              organizational: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['geographic', 'organizational']
          },
          stakeholders: {
            type: 'object',
            properties: {
              primary: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['primary']
          }
        },
        required: ['description', 'category', 'scope', 'stakeholders']
      }
    }
  ];
}