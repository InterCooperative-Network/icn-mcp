import type { AgentRegister, TaskCreate } from './types.js';

export async function registerAgent(_baseUrl: string, _payload: AgentRegister): Promise<boolean> {
  // TODO: call MCP /api/agent/register
  return true;
}

export async function createTask(_baseUrl: string, _payload: TaskCreate): Promise<string> {
  // TODO: call MCP /api/task/create
  return 'T-0001';
}

export * from './types.js';

