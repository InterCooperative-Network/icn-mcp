export type AgentRegisterRequest = {
  agent_id: string;
  name: string;
  version: string;
  capabilities: string[];
};

export type TaskCreateRequest = {
  title: string;
  intent?: string;
};

