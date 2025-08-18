import { icnGetArchitecture } from './icn_get_architecture.js';
import { icnGetInvariants } from './icn_get_invariants.js';

// Define canonical types with proper TypeScript interfaces
export interface ArchitectureSection {
  id: string;
  title: string;
  path: string;
  content: string;
}

export interface ProtocolSection {
  id: string;
  title: string;
  path: string;
  content: string;
}

export interface Invariant {
  id: string;
  name: string;
  statement: string;
  severity?: "critical" | "high" | "medium" | "low";
}

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
  // Enhanced sections with proper types
  summary: string;
  current_state: string;
  dependencies: string[];
  relevant_protocols: ProtocolSection[];
  architecture: ArchitectureSection[];
  invariants: Invariant[];
  acceptance_tests: string[];
}





// Utility for deterministic output
function uniqueSorted(items: string[]): string[] {
  return Array.from(new Set(items.map(s => s.trim()).filter(Boolean))).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}
export async function icnGetTaskContext(request: TaskContextRequest): Promise<TaskContextResponse> {
  const taskId = request.taskId;
  const owner = process.env.GITHUB_OWNER || 'InterCooperative-Network';
  const repo = process.env.GITHUB_REPO || 'icn-mcp';
  
  // Get all architecture and protocols for comprehensive context
  const architectureResponse = await icnGetArchitecture();
  const invariantsResponse = await icnGetInvariants();
  
  // Convert to typed sections and ensure deterministic ordering
  const architectureSections: ArchitectureSection[] = architectureResponse.sections
    .filter(s => s.title.startsWith('Architecture:'))
    .map(s => ({
      id: s.title.replace('Architecture: ', '').toLowerCase().replace(/\s+/g, '-'),
      title: s.title,
      path: s.path,
      content: s.content
    }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.title.localeCompare(b.title));
  
  const protocolSections: ProtocolSection[] = architectureResponse.sections
    .filter(s => s.title.startsWith('Protocol:'))
    .map(s => ({
      id: s.title.replace('Protocol: ', '').toLowerCase().replace(/\s+/g, '-'),
      title: s.title,
      path: s.path,
      content: s.content
    }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.title.localeCompare(b.title));
  
  // Convert invariants to typed format
  const invariants: Invariant[] = invariantsResponse.invariants.map(inv => ({
    id: inv.id,
    name: inv.id,
    statement: inv.statement,
    severity: 'high' as const // Default severity
  }));
  
  // Build task summary based on available architecture information
  const summary = buildTaskSummary(taskId, architectureSections, protocolSections);
  
  // Determine current state based on architecture and task
  const currentState = buildCurrentState(taskId, architectureSections);
  
  // Extract dependencies from task description and related architecture
  const dependencies = extractDependencies(taskId, architectureSections, protocolSections);
  
  // Build acceptance tests based on invariants and task requirements
  const acceptanceTests = buildAcceptanceTests(taskId, invariants);
  
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
    invariants,
    acceptance_tests: acceptanceTests
  };
  
  // Validate response before returning
  validateTaskContext(context);
  
  return context;
}

// Typed helper functions with improved logic
function buildTaskSummary(
  taskId: string,
  architectureSections: ArchitectureSection[],
  protocolSections: ProtocolSection[]
): string {
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

function buildCurrentState(taskId: string, architectureSections: ArchitectureSection[]): string {
  let currentState = `ICN MCP system is operational with HTTP server (port 8787) and MCP stdio tools.`;
  
  if (architectureSections.some(s => s.content.includes('TODO'))) {
    currentState += ` Some architectural components are still in development or need enhancement.`;
  }
  
  currentState += ` Task ${taskId} will extend the current capabilities.`;
  return currentState;
}

function extractDependencies(
  taskId: string,
  architectureSections: ArchitectureSection[],
  protocolSections: ProtocolSection[]
): string[] {
  const out: string[] = [];

  // Regex patterns for targeted dependency extraction (no global flag to avoid state issues)
  const DEP_LINE = /^\s*(depends\s+on|requires)\s*:\s*(.+)$/i;
  const PROTO = /\bprotocols?\s*:\s*([a-z0-9\-_,\s]+)/i;
  const LINK_NAME = /\[([^\]]+)\]\([^)]+\)/g;

  for (const s of architectureSections) {
    for (const line of s.content.split(/\r?\n/)) {
      const m = DEP_LINE.exec(line);
      if (m) out.push(...m[2].split(",").map(x => x.trim()));
      
      // Use match instead of exec for global patterns to avoid state issues
      const rfcMatches = line.match(/\bRFC-(\d{1,4})\b/g);
      if (rfcMatches) {
        rfcMatches.forEach(match => {
          const num = match.match(/RFC-(\d+)/);
          if (num) out.push(`RFC-${num[1]}`);
        });
      }
      
      const p = PROTO.exec(line);
      if (p) out.push(...p[1].split(",").map(x => x.trim()));
      
      const linkMatches = line.match(LINK_NAME);
      if (linkMatches) {
        linkMatches.forEach(match => {
          const name = match.match(/\[([^\]]+)\]/);
          if (name) out.push(name[1]);
        });
      }
    }
  }

  for (const s of protocolSections) {
    const rfcMatches = s.content.match(/\bRFC-(\d{1,4})\b/g);
    if (rfcMatches) {
      rfcMatches.forEach(match => {
        const num = match.match(/RFC-(\d+)/);
        if (num) out.push(`RFC-${num[1]}`);
      });
    }
  }

  // Default system dependencies
  out.push('ICN MCP HTTP server operational');
  out.push('MCP stdio tools functional');
  out.push('Database schema up to date');

  return uniqueSorted(out);
}

function buildAcceptanceTests(taskId: string, invariants: Invariant[]): string[] {
  const base = [
    `[${taskId}] code compiles and tests pass on CI`,
    `[${taskId}] no write occurs without policy allow`,
    `[${taskId}] PR descriptor links task and intent`
  ];

  const fromInv = invariants.map(inv => {
    switch (inv.id) {
      case "no_merge_without_checks":
        return `[${taskId}] merge is blocked unless CI status is green and policy check returns allow`;
      case "every_pr_maps_to_task":
        return `[${taskId}] PR must include X-ICN-Task: ${taskId} and reference exists in tasks table`;
      case "every_task_maps_to_intent":
        return `[${taskId}] task has non-empty intent field and intent-id is persisted`;
      default:
        return `[${taskId}] invariant satisfied: ${inv.name} - ${inv.statement}`;
    }
  });

  return uniqueSorted([...base, ...fromInv]);
}

// Response validation
function assertNonEmpty(name: string, v: unknown) {
  if (typeof v === "string" && v.trim().length === 0) throw new Error(`${name} is empty`);
  if (Array.isArray(v) && v.length === 0) throw new Error(`${name} is empty`);
}

function validateTaskContext(ctx: TaskContextResponse) {
  assertNonEmpty("summary", ctx.summary);
  assertNonEmpty("current_state", ctx.current_state);
  assertNonEmpty("acceptance_tests", ctx.acceptance_tests);
}