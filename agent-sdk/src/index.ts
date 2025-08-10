import type { AgentRegister, TaskCreate, AgentRegisterResponse, TaskCreateResponse } from './types.js';

export async function registerAgent(baseUrl: string, payload: AgentRegister): Promise<AgentRegisterResponse> {
  const response = await fetch(`${baseUrl}/api/agent/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to register agent: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as AgentRegisterResponse;
  if (!result.ok) {
    throw new Error('Agent registration failed');
  }

  return result;
}

export async function createTask(baseUrl: string, token: string, payload: TaskCreate): Promise<TaskCreateResponse> {
  const response = await fetch(`${baseUrl}/api/task/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as TaskCreateResponse;
  if (!result.ok) {
    throw new Error('Task creation failed');
  }

  return result;
}

export * from './types.js';

