import { HttpClient, ClientConfig } from './client.js';
import { 
  AgentRegister, 
  TaskCreate, 
  TaskRunPayload, 
  PolicyCheckPayload, 
  PrCreatePayload,
  AgentRegisterResponse,
  TaskCreateResponse,
  TokenRefreshResponse,
  TaskClaimResponse,
  TaskRunResponse,
  PolicyDecision,
  PrCreateResponse,
  AgentRegisterResponseSchema,
  TaskCreateResponseSchema,
  TokenRefreshResponseSchema,
  TaskClaimResponseSchema,
  TaskRunResponseSchema,
  PolicyDecisionSchema,
  PrCreateResponseSchema
} from './schemas.js';

export class ICNClient {
  private client: HttpClient;

  constructor(config: ClientConfig) {
    this.client = new HttpClient(config);
  }

  setToken(token: string) {
    this.client.setToken(token);
  }

  // Agent operations
  async registerAgent(payload: AgentRegister): Promise<AgentRegisterResponse> {
    return this.client.request('/api/agent/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, AgentRegisterResponseSchema);
  }

  async refreshToken(): Promise<TokenRefreshResponse> {
    return this.client.request('/api/agent/refresh', {
      method: 'POST',
    }, TokenRefreshResponseSchema);
  }

  // Task operations
  get tasks() {
    return {
      create: async (payload: TaskCreate): Promise<TaskCreateResponse> => {
        return this.client.request('/api/task/create', {
          method: 'POST',
          body: JSON.stringify(payload),
        }, TaskCreateResponseSchema);
      },

      claim: async (): Promise<TaskClaimResponse> => {
        return this.client.request('/api/task/claim', {
          method: 'POST',
          body: JSON.stringify({}),
        }, TaskClaimResponseSchema);
      },

      update: async (payload: TaskRunPayload): Promise<TaskRunResponse> => {
        return this.client.request('/api/task/run', {
          method: 'POST',
          body: JSON.stringify(payload),
        }, TaskRunResponseSchema);
      }
    };
  }

  // Policy operations
  get policy() {
    return {
      check: async (payload: PolicyCheckPayload): Promise<PolicyDecision> => {
        return this.client.request('/api/policy/check', {
          method: 'POST',
          body: JSON.stringify(payload),
        }, PolicyDecisionSchema);
      }
    };
  }

  // PR operations
  get pr() {
    return {
      create: async (payload: PrCreatePayload): Promise<PrCreateResponse> => {
        const result = await this.client.request('/api/pr/create', {
          method: 'POST',
          body: JSON.stringify(payload),
        }) as { allow?: boolean; reasons?: string[]; ok?: boolean; artifact?: string; mode?: string };
        
        // Handle policy denial (returns { allow: false, reasons: [...] })
        if (result.allow === false) {
          throw new Error(`PR creation denied by policy: ${result.reasons?.join(', ') || 'unknown reasons'}`);
        }
        
        return PrCreateResponseSchema.parse(result);
      }
    };
  }
}

// Factory function for creating client
export function createClient(baseUrl: string, token?: string, config?: Partial<ClientConfig>): ICNClient {
  return new ICNClient({
    baseUrl,
    token,
    ...config
  });
}