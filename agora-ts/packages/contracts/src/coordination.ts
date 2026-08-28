import { z } from 'zod';
import { runtimeResultEnvelopeSchema } from './runtime-node.js';

export const coordinationModeSchema = z.enum(['single', 'fanout', 'review', 'debate', 'council']);
export type CoordinationModeDto = z.infer<typeof coordinationModeSchema>;

export const coordinationRunStatusSchema = z.enum([
  'running',
  'verifying',
  'completed',
  'partial',
  'failed',
  'cancelled',
  'budget_exhausted',
]);
export type CoordinationRunStatusDto = z.infer<typeof coordinationRunStatusSchema>;

export const coordinationMemberRoleSchema = z.enum([
  'primary',
  'investigator',
  'reviewer',
  'verifier',
  'arbitrator',
]);
export type CoordinationMemberRoleDto = z.infer<typeof coordinationMemberRoleSchema>;

export const coordinationMemberStatusSchema = z.enum([
  'dispatched',
  'claimed',
  'completed',
  'failed',
  'cancelled',
]);
export type CoordinationMemberStatusDto = z.infer<typeof coordinationMemberStatusSchema>;

export const coordinationBudgetSchema = z.object({
  max_agents: z.number().int().min(1).max(32).default(4),
  max_dispatches: z.number().int().min(1).max(64).default(6),
  max_wall_clock_seconds: z.number().int().min(15).max(86_400).default(1_800),
  max_tokens: z.number().int().positive().nullable().default(null),
  max_tool_calls: z.number().int().positive().nullable().default(null),
  max_cost_usd: z.number().positive().nullable().default(null),
  min_information_gain: z.number().min(0).max(1).default(0.05),
}).strict();
export type CoordinationBudgetDto = z.infer<typeof coordinationBudgetSchema>;

export const runtimeUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative().nullable().default(null),
  output_tokens: z.number().int().nonnegative().nullable().default(null),
  total_tokens: z.number().int().nonnegative().nullable().default(null),
  tool_calls: z.number().int().nonnegative().nullable().default(null),
  cost_usd: z.number().nonnegative().nullable().default(null),
  duration_ms: z.number().int().nonnegative().nullable().default(null),
}).strict();
export type RuntimeUsageDto = z.infer<typeof runtimeUsageSchema>;

export const coordinationCandidateSchema = z.object({
  runtime_target_ref: z.string().regex(/^dsh:[^:]+:.+$/u, 'runtime_target_ref must use dsh:<node>:<agent>'),
  capabilities: z.array(z.string().min(1)).default([]),
  role_hint: coordinationMemberRoleSchema.nullable().optional(),
  priority: z.number().min(-100).max(100).default(0),
}).strict();
export type CoordinationCandidateDto = z.infer<typeof coordinationCandidateSchema>;

export const createCoordinationRunRequestSchema = z.object({
  task_id: z.string().min(1).nullable().optional(),
  task_type: z.string().min(1).max(128).default('general'),
  prompt: z.string().min(1).max(200_000),
  mode: coordinationModeSchema,
  candidates: z.array(coordinationCandidateSchema).min(1).max(32),
  verifier_target_ref: z.string().min(1).nullable().optional(),
  budget: coordinationBudgetSchema.default({
    max_agents: 4,
    max_dispatches: 6,
    max_wall_clock_seconds: 1_800,
    max_tokens: null,
    max_tool_calls: null,
    max_cost_usd: null,
    min_information_gain: 0.05,
  }),
  memory_scopes: z.array(z.enum(['task', 'agent_private', 'project_shared', 'decision', 'episodic'])).default([]),
  idempotency_key: z.string().min(1).max(256),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict().superRefine((value, context) => {
  const refs = value.candidates.map(candidate => candidate.runtime_target_ref);
  if (new Set(refs).size !== refs.length) {
    context.addIssue({ code: 'custom', path: ['candidates'], message: 'candidate runtime_target_ref values must be unique' });
  }
});
export type CreateCoordinationRunRequestDto = z.infer<typeof createCoordinationRunRequestSchema>;

export const coordinationConflictSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['claim_conflict', 'environment_drift', 'unsupported_claim']),
  key: z.string().min(1),
  member_ids: z.array(z.string().min(1)).min(1),
  statements: z.array(z.string()).default([]),
  detail: z.string().min(1),
  resolved: z.boolean().default(false),
}).strict();
export type CoordinationConflictDto = z.infer<typeof coordinationConflictSchema>;

export const coordinationSynthesisSchema = z.object({
  answer: z.string().max(200_000),
  agreements: z.array(z.string()).default([]),
  conflicts: z.array(coordinationConflictSchema).default([]),
  evidence_ids: z.array(z.string()).default([]),
  verified: z.boolean(),
  information_gain: z.number().min(0).max(1),
  result_envelope: runtimeResultEnvelopeSchema.nullable().default(null),
}).strict();
export type CoordinationSynthesisDto = z.infer<typeof coordinationSynthesisSchema>;

export const coordinationMemberSchema = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  dispatch_id: z.string().min(1),
  runtime_target_ref: z.string().min(1),
  role: coordinationMemberRoleSchema,
  round: z.number().int().positive(),
  status: coordinationMemberStatusSchema,
  selection_score: z.number(),
  selection_reason: z.array(z.string()).default([]),
  result_envelope: runtimeResultEnvelopeSchema.nullable(),
  usage: runtimeUsageSchema.nullable(),
  observation_recorded_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
}).strict();
export type CoordinationMemberDto = z.infer<typeof coordinationMemberSchema>;

export const coordinationRunSchema = z.object({
  id: z.string().min(1),
  task_id: z.string().nullable(),
  task_type: z.string().min(1),
  prompt: z.string().min(1),
  mode: coordinationModeSchema,
  status: coordinationRunStatusSchema,
  candidates: z.array(coordinationCandidateSchema),
  verifier_target_ref: z.string().nullable(),
  budget: coordinationBudgetSchema,
  usage: runtimeUsageSchema,
  memory_scopes: z.array(z.enum(['task', 'agent_private', 'project_shared', 'decision', 'episodic'])),
  idempotency_key: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  synthesis: coordinationSynthesisSchema.nullable(),
  stop_reason: z.string().nullable(),
  deadline_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
  members: z.array(coordinationMemberSchema),
}).strict();
export type CoordinationRunDto = z.infer<typeof coordinationRunSchema>;

export const coordinationRunListResponseSchema = z.object({
  runs: z.array(coordinationRunSchema),
});

export const coordinationScorecardSchema = z.object({
  runtime_target_ref: z.string().min(1),
  task_type: z.string().min(1),
  observations: z.number().int().nonnegative(),
  success_rate: z.number().min(0).max(1).nullable(),
  failure_rate: z.number().min(0).max(1).nullable(),
  cancellation_rate: z.number().min(0).max(1).nullable(),
  retry_rate: z.number().min(0).max(1).nullable(),
  timeout_rate: z.number().min(0).max(1).nullable(),
  median_duration_ms: z.number().nonnegative().nullable(),
  p95_duration_ms: z.number().nonnegative().nullable(),
  evidence_yield: z.number().nonnegative().nullable(),
  verifier_acceptance_rate: z.number().min(0).max(1).nullable(),
  agreement_rate: z.number().min(0).max(1).nullable(),
  unique_information_rate: z.number().min(0).max(1).nullable(),
  environment_drift_rate: z.number().min(0).max(1).nullable(),
  total_tokens: z.number().int().nonnegative().nullable(),
  total_cost_usd: z.number().nonnegative().nullable(),
  score: z.number().min(0).max(100),
  updated_at: z.string().nullable(),
}).strict();
export type CoordinationScorecardDto = z.infer<typeof coordinationScorecardSchema>;

export const coordinationScorecardListResponseSchema = z.object({
  scorecards: z.array(coordinationScorecardSchema),
});
