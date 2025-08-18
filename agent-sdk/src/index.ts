import { createClient } from './sdk.js';
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
} from './schemas.js';

// Legacy function-based API for backward compatibility
export async function registerAgent(baseUrl: string, payload: AgentRegister): Promise<AgentRegisterResponse> {
  const client = createClient(baseUrl);
  return client.registerAgent(payload);
}

export async function createTask(baseUrl: string, token: string, payload: TaskCreate): Promise<TaskCreateResponse> {
  const client = createClient(baseUrl, token);
  return client.tasks.create(payload);
}

export async function refreshToken(baseUrl: string, currentToken: string): Promise<TokenRefreshResponse> {
  const client = createClient(baseUrl, currentToken);
  return client.refreshToken();
}

export async function claimTask(baseUrl: string, token: string): Promise<TaskClaimResponse> {
  const client = createClient(baseUrl, token);
  return client.tasks.claim();
}

export async function runTask(baseUrl: string, token: string, payload: TaskRunPayload): Promise<TaskRunResponse> {
  const client = createClient(baseUrl, token);
  return client.tasks.update(payload);
}

export async function checkPolicy(baseUrl: string, token: string, payload: PolicyCheckPayload): Promise<PolicyDecision> {
  const client = createClient(baseUrl, token);
  return client.policy.check(payload);
}

export async function createPR(baseUrl: string, token: string, payload: PrCreatePayload): Promise<PrCreateResponse> {
  const client = createClient(baseUrl, token);
  return client.pr.create(payload);
}

// Export new client-based API
export { createClient, ICNClient } from './sdk.js';

// Export types and schemas
export * from './schemas.js';
export * from './errors.js';
export { HttpClient } from './client.js';
export type { TimeoutConfig, RetryConfig, ClientConfig } from './client.js';

