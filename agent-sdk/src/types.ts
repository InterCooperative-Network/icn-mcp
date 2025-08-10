export type AgentRegister = {
  name: string;
  kind: string;
};

export type TaskCreate = {
  title: string;
  description?: string;
  depends_on?: string[];
};

export type AgentRegisterResponse = {
  ok: boolean;
  id: string;
  token: string;
};

export type TaskCreateResponse = {
  ok: boolean;
  id: string;
};

export type TokenRefreshResponse = {
  ok: boolean;
  token: string;
};

