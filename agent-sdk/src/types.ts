export type AgentRegister = {
  agent_id: string;
  name: string;
  version: string;
  capabilities: string[];
};

export type TaskCreate = {
  title: string;
  intent?: string;
};

