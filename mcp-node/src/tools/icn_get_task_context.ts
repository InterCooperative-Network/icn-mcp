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
}

export async function icnGetTaskContext(request: TaskContextRequest): Promise<TaskContextResponse> {
  // Since we don't have access to the mcp-server database in this implementation,
  // we'll provide a simplified task context that demonstrates the structure
  // and provides useful guidance for ICN development
  
  const taskId = request.taskId;
  const owner = process.env.GITHUB_OWNER || 'InterCooperative-Network';
  const repo = process.env.GITHUB_REPO || 'icn-mcp';
  
  // Generic task context for ICN development
  const context: TaskContextResponse = {
    task: {
      id: taskId,
      title: `Task: ${taskId}`,
      acceptance: [
        'Implements the requirements specified in the task description',
        'Follows ICN architectural patterns and invariants',
        'Includes appropriate tests and documentation'
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
    ]
  };
  
  return context;
}