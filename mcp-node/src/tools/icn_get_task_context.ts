import { icnGetArchitecture } from './icn_get_architecture.js';
import { icnGetInvariants } from './icn_get_invariants.js';

export interface TaskContextRequest {
  taskId: string;
}

export interface TaskContextResponse {
  task: {
    id: string;
    title: string;
    acceptance: string[];
  };
  repo: {
    owner: string;
    repo: string;
    paths: string[];
  };
  policy: {
    caps_required: string[];
    write_scopes: string[];
  };
  steps: string[];
  conventions: {
    commit_format: string;
    test_patterns: string[];
  };
  starter_files: Array<{
    path: string;
    hint: string;
  }>;
  // Enhanced sections as requested in the issue
  summary: string;
  current_state: string;
  dependencies: string[];
  relevant_protocols: Array<{
    title: string;
    path: string;
    content: string;
  }>;
  architecture: Array<{
    title: string;
    path: string;
    content: string;
  }>;
  invariants: Array<{
    id: string;
    statement: string;
    evidence?: string;
    checks?: string[];
  }>;
  acceptance_tests: string[];
}

export async function icnGetTaskContext(request: TaskContextRequest): Promise<TaskContextResponse> {
  const taskId = request.taskId;
  const owner = process.env.GITHUB_OWNER || 'InterCooperative-Network';
  const repo = process.env.GITHUB_REPO || 'icn-mcp';
  
  // Get all architecture and protocols for comprehensive context
  // Use task-specific filtering as a secondary feature, but include all for full briefing
  const architectureResponse = await icnGetArchitecture(); // Get all architecture/protocols
  const invariantsResponse = await icnGetInvariants();
  
  // Separate architecture and protocol sections
  const architectureSections = architectureResponse.sections.filter(s => s.title.startsWith('Architecture:'));
  const protocolSections = architectureResponse.sections.filter(s => s.title.startsWith('Protocol:'));
  
  // Build task summary based on available architecture information
  const summary = buildTaskSummary(taskId, architectureSections, protocolSections);
  
  // Determine current state based on architecture and task
  const currentState = buildCurrentState(taskId, architectureSections);
  
  // Extract dependencies from task description and related architecture
  const dependencies = extractDependencies(taskId, architectureSections, protocolSections);
  
  // Build acceptance tests based on invariants and task requirements
  const acceptanceTests = buildAcceptanceTests(taskId, invariantsResponse.invariants);
  
  const context: TaskContextResponse = {
    task: {
      id: taskId,
      title: `Task: ${taskId}`,
      acceptance: [
        'Implements the requirements specified in the task description',
        'Follows ICN architectural patterns and invariants',
        'Includes appropriate tests and documentation',
        ...acceptanceTests
      ]
    },
    repo: {
      owner,
      repo,
      paths: ['mcp-server/src/**', 'mcp-node/src/**', 'docs/**']
    },
    policy: {
      caps_required: [],
      write_scopes: ['mcp-server/**', 'mcp-node/**', 'docs/**']
    },
    steps: [
      'Review ICN architecture and invariants',
      'Understand existing codebase and patterns',
      'Implement changes following ICN conventions',
      'Add/update tests as needed',
      'Update documentation if required',
      'Verify all checks pass'
    ],
    conventions: {
      commit_format: 'feat(scope): message',
      test_patterns: ['mcp-server/test/**/*.test.ts', 'mcp-node/test/**/*.test.ts']
    },
    starter_files: [
      { path: 'mcp-server/src/api.ts', hint: 'Main HTTP API endpoints and handlers' },
      { path: 'mcp-server/src/db.ts', hint: 'Database helpers and migrations' },
      { path: 'mcp-node/src/server.ts', hint: 'MCP server implementation' },
      { path: 'docs/architecture/00-overview.md', hint: 'ICN architecture overview' }
    ],
    // Enhanced sections
    summary,
    current_state: currentState,
    dependencies,
    relevant_protocols: protocolSections,
    architecture: architectureSections,
    invariants: invariantsResponse.invariants,
    acceptance_tests: acceptanceTests
  };
  
  return context;
}

function buildTaskSummary(taskId: string, architectureSections: any[], protocolSections: any[]): string {
  let summary = `Task ${taskId} requires implementation within the ICN MCP architecture.`;
  
  if (architectureSections.length > 0) {
    summary += ` The ICN system follows a distributed agent architecture with HTTP HQ coordination and MCP stdio integration for development tools.`;
  }
  
  if (protocolSections.length > 0) {
    const protocolNames = protocolSections.map(p => p.title.replace('Protocol: ', '')).join(', ');
    summary += ` Relevant protocols include: ${protocolNames}.`;
  }
  
  return summary;
}

function buildCurrentState(taskId: string, architectureSections: any[]): string {
  let currentState = `ICN MCP system is operational with HTTP server (port 8787) and MCP stdio tools.`;
  
  if (architectureSections.some(s => s.content.includes('TODO'))) {
    currentState += ` Some architectural components are still in development or need enhancement.`;
  }
  
  currentState += ` Task ${taskId} will extend the current capabilities.`;
  return currentState;
}

function extractDependencies(taskId: string, architectureSections: any[], protocolSections: any[]): string[] {
  const dependencies: string[] = [];
  
  // Look for dependencies in architecture content
  for (const section of architectureSections) {
    if (section.content.includes('depends') || section.content.includes('requires')) {
      dependencies.push(`Architecture dependency: ${section.title}`);
    }
  }
  
  // Look for protocol dependencies
  for (const section of protocolSections) {
    if (section.content.includes('RFC-') || section.content.includes('reference')) {
      dependencies.push(`Protocol dependency: ${section.title}`);
    }
  }
  
  // Default system dependencies
  dependencies.push('ICN MCP HTTP server operational');
  dependencies.push('MCP stdio tools functional');
  dependencies.push('Database schema up to date');
  
  return dependencies;
}

function buildAcceptanceTests(taskId: string, invariants: any[]): string[] {
  const tests: string[] = [];
  
  // Generate tests based on invariants
  for (const invariant of invariants) {
    tests.push(`Verify ${invariant.id}: ${invariant.statement}`);
  }
  
  // Default acceptance tests
  tests.push('All existing tests continue to pass');
  tests.push('New functionality has appropriate test coverage');
  tests.push('Code follows ICN conventions and patterns');
  tests.push('Documentation is updated for changes');
  
  return tests;
}