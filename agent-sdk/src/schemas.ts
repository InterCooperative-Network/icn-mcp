import { z } from 'zod';

// Request schemas
export const AgentRegisterSchema = z.object({
  name: z.string(),
  kind: z.string(),
});

export const TaskCreateSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  depends_on: z.array(z.string()).optional(),
});

export const TaskRunPayloadSchema = z.object({
  task_id: z.string(),
  status: z.enum(['claimed', 'in_progress', 'completed', 'failed']),
  notes: z.string().optional(),
  task_kind: z.string().optional(),
});

export const PolicyCheckPayloadSchema = z.object({
  actor: z.enum(['planner', 'architect', 'reviewer', 'security']),
  action: z.enum(['task.claim', 'task.update', 'pr.create', 'artifact.write']),
  paths: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const PrCreatePayloadSchema = z.object({
  task_id: z.string(),
  title: z.string(),
  body: z.string(),
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
  })),
});

// Response schemas
export const AgentRegisterResponseSchema = z.object({
  ok: z.boolean(),
  id: z.string(),
  token: z.string(),
});

export const TaskCreateResponseSchema = z.object({
  ok: z.boolean(),
  id: z.string(),
});

export const TokenRefreshResponseSchema = z.object({
  ok: z.boolean(),
  token: z.string(),
});

export const TaskClaimResponseSchema = z.object({
  task_id: z.string().optional(),
  title: z.string().optional(),
  error: z.string().optional(),
});

export const TaskRunResponseSchema = z.object({
  ok: z.boolean(),
});

export const PolicyDecisionSchema = z.object({
  allow: z.boolean(),
  reasons: z.array(z.string()),
});

export const PrCreateResponseSchema = z.object({
  ok: z.boolean(),
  artifact: z.string().optional(),
  mode: z.string().optional(),
});

// Type exports derived from schemas
export type AgentRegister = z.infer<typeof AgentRegisterSchema>;
export type TaskCreate = z.infer<typeof TaskCreateSchema>;
export type TaskRunPayload = z.infer<typeof TaskRunPayloadSchema>;
export type PolicyCheckPayload = z.infer<typeof PolicyCheckPayloadSchema>;
export type PrCreatePayload = z.infer<typeof PrCreatePayloadSchema>;

export type AgentRegisterResponse = z.infer<typeof AgentRegisterResponseSchema>;
export type TaskCreateResponse = z.infer<typeof TaskCreateResponseSchema>;
export type TokenRefreshResponse = z.infer<typeof TokenRefreshResponseSchema>;
export type TaskClaimResponse = z.infer<typeof TaskClaimResponseSchema>;
export type TaskRunResponse = z.infer<typeof TaskRunResponseSchema>;
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
export type PrCreateResponse = z.infer<typeof PrCreateResponseSchema>;