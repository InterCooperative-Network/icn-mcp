// Future enhancement: could potentially use fs, path, and DOCS_ROOT for reading real specs
// import fs from 'node:fs';
// import path from 'node:path';
// import { DOCS_ROOT } from '../config.js';

export interface SpecRequirement {
  field: string;
  type: string;
  required: boolean;
  validation?: string;
  description: string;
}

export interface InvariantRule {
  id: string;
  description: string;
  check: string;
}

export interface SynthesizedSpec {
  surface: string;
  openapi: {
    openapi: string;
    info: {
      title: string;
      version: string;
      description: string;
    };
    paths: Record<string, any>;
    components: {
      schemas: Record<string, any>;
    };
  };
  requirements: SpecRequirement[];
  invariants: InvariantRule[];
  reasoning: string[];
}

export interface SynthesizeSpecRequest {
  surface: string;
}

// ICN surface definitions based on architecture
const ICN_SURFACES = {
  'Identity': {
    description: 'Manages member identities and attestations',
    endpoints: ['/identity/create', '/identity/verify', '/identity/revoke'],
    schema: {
      type: 'object',
      properties: {
        memberId: { type: 'string', description: 'Unique member identifier' },
        publicKey: { type: 'string', description: 'Member public key for verification' },
        attestations: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'List of attestation hashes'
        },
        created: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: ['active', 'revoked'] }
      },
      required: ['memberId', 'publicKey', 'created', 'status']
    }
  },
  'Identity/Attestation': {
    description: 'Handles identity attestation and verification',
    endpoints: ['/attestation/create', '/attestation/verify', '/attestation/list'],
    schema: {
      type: 'object',
      properties: {
        attestationId: { type: 'string', description: 'Unique attestation identifier' },
        memberId: { type: 'string', description: 'Member being attested' },
        attestorId: { type: 'string', description: 'Member providing attestation' },
        claimType: { type: 'string', description: 'Type of claim being attested' },
        evidence: { type: 'string', description: 'Supporting evidence for the claim' },
        signature: { type: 'string', description: 'Cryptographic signature' },
        timestamp: { type: 'string', format: 'date-time' }
      },
      required: ['attestationId', 'memberId', 'attestorId', 'claimType', 'signature', 'timestamp']
    }
  },
  'Jobs': {
    description: 'Manages job postings and assignments within the cooperative',
    endpoints: ['/jobs/create', '/jobs/assign', '/jobs/complete', '/jobs/list'],
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'Unique job identifier' },
        title: { type: 'string', description: 'Job title' },
        description: { type: 'string', description: 'Detailed job description' },
        requiredSkills: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Skills required for the job'
        },
        contributionCredits: { type: 'number', description: 'CC value for completion' },
        assignedTo: { type: 'string', description: 'Member assigned to job' },
        status: { type: 'string', enum: ['open', 'assigned', 'completed', 'cancelled'] },
        created: { type: 'string', format: 'date-time' },
        deadline: { type: 'string', format: 'date-time' }
      },
      required: ['jobId', 'title', 'description', 'contributionCredits', 'status', 'created']
    }
  },
  'Event Log': {
    description: 'Immutable event log for all cooperative operations',
    endpoints: ['/events/append', '/events/query', '/events/verify'],
    schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Unique event identifier' },
        eventType: { type: 'string', description: 'Type of event' },
        aggregateId: { type: 'string', description: 'ID of the aggregate being modified' },
        payload: { type: 'object', description: 'Event payload data' },
        metadata: { 
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'number' },
            causationId: { type: 'string' },
            correlationId: { type: 'string' }
          }
        },
        hash: { type: 'string', description: 'Event hash for integrity' },
        previousHash: { type: 'string', description: 'Hash of previous event' }
      },
      required: ['eventId', 'eventType', 'aggregateId', 'payload', 'metadata', 'hash']
    }
  },
  'Issuance': {
    description: 'Manages contribution credit (CC) issuance and distribution',
    endpoints: ['/issuance/create', '/issuance/distribute', '/issuance/balance'],
    schema: {
      type: 'object',
      properties: {
        issuanceId: { type: 'string', description: 'Unique issuance identifier' },
        amount: { type: 'number', description: 'Amount of CC being issued' },
        reason: { type: 'string', description: 'Reason for issuance' },
        recipients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              memberId: { type: 'string' },
              amount: { type: 'number' }
            }
          }
        },
        authorizedBy: { type: 'string', description: 'Member authorizing issuance' },
        timestamp: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: ['pending', 'approved', 'distributed', 'rejected'] }
      },
      required: ['issuanceId', 'amount', 'reason', 'recipients', 'authorizedBy', 'timestamp', 'status']
    }
  },
  'Governance': {
    description: 'Democratic governance and voting mechanisms',
    endpoints: ['/governance/propose', '/governance/vote', '/governance/tally'],
    schema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string', description: 'Unique proposal identifier' },
        title: { type: 'string', description: 'Proposal title' },
        description: { type: 'string', description: 'Detailed proposal description' },
        proposedBy: { type: 'string', description: 'Member proposing' },
        votingDeadline: { type: 'string', format: 'date-time' },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Voting options'
        },
        votes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              memberId: { type: 'string' },
              option: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        },
        status: { type: 'string', enum: ['draft', 'active', 'closed', 'executed'] }
      },
      required: ['proposalId', 'title', 'description', 'proposedBy', 'votingDeadline', 'options', 'status']
    }
  }
};

// Core ICN invariants that must be checked
const CORE_INVARIANTS: InvariantRule[] = [
  {
    id: 'INV-EVENTSOURCE-001',
    description: 'All state changes must be recorded as events in the event log',
    check: 'Event-sourced: no state outside log'
  },
  {
    id: 'INV-DETERMINISTIC-001', 
    description: 'Operations must be deterministic - same inputs produce same outputs',
    check: 'Deterministic execution: inputs → outputs reproducible'
  },
  {
    id: 'INV-DEMOCRATIC-001',
    description: 'Voting must follow one member, one vote principle',
    check: 'Democratic governance: one member, one vote'
  },
  {
    id: 'INV-NONTRANSFERABLE-001',
    description: 'Contribution Credits cannot be transferred between members',
    check: 'Non-transferable CC'
  },
  {
    id: 'INV-NOVOTING-001',
    description: 'Voting rights cannot be purchased with tokens or CC',
    check: 'No token-bought voting rights'
  }
];

function generateOpenAPISpec(surface: string, surfaceConfig: any): any {
  const surfaceName = surface.split('/')[0];
  
  return {
    openapi: '3.0.3',
    info: {
      title: `ICN ${surface} API`,
      version: '1.0.0',
      description: surfaceConfig.description
    },
    paths: surfaceConfig.endpoints.reduce((paths: any, endpoint: string) => {
      const method = endpoint.includes('create') || endpoint.includes('assign') ? 'post' : 
                    endpoint.includes('list') || endpoint.includes('query') ? 'get' : 'post';
      
      paths[endpoint] = {
        [method]: {
          summary: `${method.toUpperCase()} ${endpoint}`,
          description: `${surfaceConfig.description} - ${endpoint}`,
          requestBody: method === 'post' ? {
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${surfaceName}` }
              }
            }
          } : undefined,
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${surfaceName}Response` }
                }
              }
            },
            '400': { description: 'Bad Request' },
            '401': { description: 'Unauthorized' },
            '500': { description: 'Internal Server Error' }
          }
        }
      };
      return paths;
    }, {}),
    components: {
      schemas: {
        [surfaceName]: surfaceConfig.schema,
        [`${surfaceName}Response`]: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: surfaceConfig.schema,
            message: { type: 'string' }
          },
          required: ['success']
        }
      }
    }
  };
}

function extractRequirements(surfaceConfig: any): SpecRequirement[] {
  const requirements: SpecRequirement[] = [];
  const schema = surfaceConfig.schema;
  
  if (schema.properties) {
    for (const [field, config] of Object.entries(schema.properties)) {
      const fieldConfig = config as any;
      requirements.push({
        field,
        type: fieldConfig.type,
        required: schema.required?.includes(field) || false,
        validation: fieldConfig.format || fieldConfig.enum ? 
          `${fieldConfig.format || ''}${fieldConfig.enum ? `enum: ${fieldConfig.enum.join(', ')}` : ''}` : 
          undefined,
        description: fieldConfig.description || `${field} property`
      });
    }
  }
  
  return requirements;
}

function generateReasoning(surface: string, _surfaceConfig: any): string[] {
  const reasoning: string[] = [];
  
  reasoning.push(`Surface '${surface}' identified as core ICN component requiring specification synthesis`);
  reasoning.push(`Schema derived from ICN architecture principles and ${surface} domain requirements`);
  reasoning.push(`Endpoints designed following RESTful patterns for cooperative operations`);
  
  if (surface.includes('Identity')) {
    reasoning.push('Identity surfaces require cryptographic verification and non-repudiation');
    reasoning.push('Attestation mechanisms ensure trust within cooperative network');
  }
  
  if (surface.includes('Event Log')) {
    reasoning.push('Event sourcing ensures all state changes are auditable and immutable');
    reasoning.push('Hash chains provide integrity verification for the event log');
  }
  
  if (surface.includes('Governance')) {
    reasoning.push('Democratic governance requires equal voting rights for all members');
    reasoning.push('Proposal lifecycle ensures transparent decision-making process');
  }
  
  if (surface.includes('Jobs')) {
    reasoning.push('Job system links work contributions to CC issuance');
    reasoning.push('Skill tracking enables effective job matching within cooperative');
  }
  
  if (surface.includes('Issuance')) {
    reasoning.push('CC issuance must be transparent and democratically authorized');
    reasoning.push('Non-transferable property prevents commodification of contributions');
  }
  
  reasoning.push('All invariants must be validated during implementation');
  reasoning.push('Specification enables automated validation and testing');
  
  return reasoning;
}

export async function icnSynthesizeSpec(request: SynthesizeSpecRequest): Promise<SynthesizedSpec> {
  const { surface } = request;
  
  // Find matching surface configuration
  const surfaceConfig = ICN_SURFACES[surface as keyof typeof ICN_SURFACES];
  
  if (!surfaceConfig) {
    // Try to find partial matches for surfaces like "Identity/Attestation"
    const matchingSurface = Object.keys(ICN_SURFACES).find(key => 
      key.toLowerCase().includes(surface.toLowerCase()) || 
      surface.toLowerCase().includes(key.toLowerCase())
    );
    
    if (!matchingSurface) {
      throw new Error(`Unknown ICN surface: ${surface}. Available surfaces: ${Object.keys(ICN_SURFACES).join(', ')}`);
    }
    
    const config = ICN_SURFACES[matchingSurface as keyof typeof ICN_SURFACES];
    return {
      surface,
      openapi: generateOpenAPISpec(surface, config),
      requirements: extractRequirements(config),
      invariants: CORE_INVARIANTS,
      reasoning: generateReasoning(surface, config)
    };
  }
  
  return {
    surface,
    openapi: generateOpenAPISpec(surface, surfaceConfig),
    requirements: extractRequirements(surfaceConfig),
    invariants: CORE_INVARIANTS,
    reasoning: generateReasoning(surface, surfaceConfig)
  };
}