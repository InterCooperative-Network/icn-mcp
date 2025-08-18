import type { 
  AgentRegister, 
  TaskCreate, 
  AgentRegisterResponse, 
  TaskCreateResponse, 
  TokenRefreshResponse,
  TaskClaimResponse,
  TaskRunPayload,
  TaskRunResponse,
  PolicyCheckPayload,
  PolicyDecision,
  PrCreatePayload,
  PrCreateResponse
} from './types.js';

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

export async function refreshToken(baseUrl: string, currentToken: string): Promise<TokenRefreshResponse> {
  const response = await fetch(`${baseUrl}/api/agent/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as TokenRefreshResponse;
  if (!result.ok) {
    throw new Error('Token refresh failed');
  }

  return result;
}

export async function claimTask(baseUrl: string, token: string): Promise<TaskClaimResponse> {
  const response = await fetch(`${baseUrl}/api/task/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Failed to claim task: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as TaskClaimResponse;
  return result;
}

export async function runTask(baseUrl: string, token: string, payload: TaskRunPayload): Promise<TaskRunResponse> {
  const response = await fetch(`${baseUrl}/api/task/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to run task: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as TaskRunResponse;
  if (!result.ok) {
    throw new Error('Task run failed');
  }

  return result;
}

export async function checkPolicy(baseUrl: string, token: string, payload: PolicyCheckPayload): Promise<PolicyDecision> {
  const response = await fetch(`${baseUrl}/api/policy/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to check policy: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as PolicyDecision;
  return result;
}

export async function createPR(baseUrl: string, token: string, payload: PrCreatePayload): Promise<PrCreateResponse> {
  const response = await fetch(`${baseUrl}/api/pr/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create PR: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as any;
  
  // Handle policy denial (returns { allow: false, reasons: [...] })
  if (result.allow === false) {
    throw new Error(`PR creation denied by policy: ${result.reasons?.join(', ') || 'unknown reasons'}`);
  }
  
  // Handle success (returns { ok: true, ...otherFields })
  if (!result.ok) {
    throw new Error('PR creation failed');
  }

  return result as PrCreateResponse;
}

export * from './types.js';

