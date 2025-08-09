import { getTaskById, getTaskDeps } from './db.js';
import { checkPolicy } from './policy.js';

export interface TaskBrief {
  task: { id: string; title: string; acceptance: string[] };
  repo: { owner: string; repo: string; paths: string[] };
  starter_files: Array<{ path: string; hint: string }>;
  policy: { caps_required: string[]; write_scopes: string[] };
  steps: string[];
  conventions: { commit_format: string; test_patterns: string[] };
}

export function buildTaskBrief(taskId: string): TaskBrief {
  const task = getTaskById(taskId);
  if (!task) throw new Error('task_not_found');
  const deps = getTaskDeps(taskId);

  const owner = process.env.GITHUB_OWNER || 'InterCooperative-Network';
  const repo = process.env.GITHUB_REPO || 'icn-mcp';

  const acceptance: string[] = [];
  if (task.description) acceptance.push(`Implements: ${task.description}`);
  if (deps.length > 0) acceptance.push(`Depends on: ${deps.join(', ')}`);

  const changedPathsSuggestion = ['mcp-server/src/**', 'mcp-server/test/**'];
  const policyDecision = checkPolicy({ actor: 'architect', changedPaths: changedPathsSuggestion });

  const brief: TaskBrief = {
    task: { id: task.id, title: task.title, acceptance },
    repo: { owner, repo, paths: changedPathsSuggestion },
    starter_files: [
      { path: 'mcp-server/src/api.ts', hint: 'Register endpoints and handlers' },
      { path: 'mcp-server/src/db.ts', hint: 'Add DB helpers and migrations as needed' }
    ],
    policy: {
      caps_required: policyDecision.allow ? [] : policyDecision.reasons,
      write_scopes: ['mcp-server/**', 'docs/**']
    },
    steps: [
      'Read existing API and DB helpers',
      'Add/update migrations and types',
      'Implement endpoints and tests',
      'Verify metrics and docs'
    ],
    conventions: {
      commit_format: 'feat(scope): message',
      test_patterns: ['mcp-server/test/**/*.test.ts']
    }
  };
  return brief;
}


