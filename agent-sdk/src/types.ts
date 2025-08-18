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

export type TaskClaimResponse = {
  task_id?: string;
  title?: string;
  error?: string;
};

export type TaskRunPayload = {
  task_id: string;
  status: 'claimed' | 'in_progress' | 'completed' | 'failed';
  notes?: string;
  task_kind?: string;
};

export type TaskRunResponse = {
  ok: boolean;
};

export type PolicyCheckPayload = {
  actor: string;
  changedPaths: string[];
};

export type PolicyDecision = {
  allow: boolean;
  reasons: string[];
};

export type PrCreatePayload = {
  task_id: string;
  title: string;
  body: string;
  files: Array<{ path: string; content: string; }>;
};

export type PrCreateResponse = {
  ok: boolean;
  artifact?: string;
  mode?: string;
};

