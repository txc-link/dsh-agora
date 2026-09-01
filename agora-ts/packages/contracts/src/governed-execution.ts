import { z } from 'zod';
import { taskLocaleSchema } from './task-api.js';
import { taskPrioritySchema } from './task.js';

export const sha256DigestSchema = z.string().regex(/^[a-f0-9]{64}$/u);
export type Sha256DigestDto = z.infer<typeof sha256DigestSchema>;

const referenceSchema = z.object({
  kind: z.string().min(1).max(64),
  ref: z.string().min(1).max(512),
  digest: sha256DigestSchema.nullable().optional(),
}).strict();
export type GovernedReferenceDto = z.infer<typeof referenceSchema>;

export const taskSpecRevisionPayloadSchema = z.object({
  title: z.string().min(1).max(512),
  description: z.string().nullable(),
  type: z.string().min(1).max(128),
  priority: taskPrioritySchema,
  locale: taskLocaleSchema,
  project_id: z.string().min(1).nullable(),
  objective: z.string().min(1).max(200_000),
  acceptance_criteria: z.array(z.string().min(1).max(4_000)).min(1).max(128),
  scope: z.record(z.string(), z.unknown()).default({}),
  constraints: z.array(z.string().min(1).max(4_000)).max(128).default([]),
  context_refs: z.array(referenceSchema).max(256).default([]),
  input_artifact_refs: z.array(referenceSchema).max(256).default([]),
  memory_refs: z.array(referenceSchema).max(256).default([]),
}).strict();
export type TaskSpecRevisionPayloadDto = z.infer<typeof taskSpecRevisionPayloadSchema>;

export const createTaskSpecRevisionRequestSchema = z.object({
  task_id: z.string().min(1),
  base_task_version: z.number().int().positive(),
  parent_revision: z.number().int().positive().nullable().optional(),
  payload: taskSpecRevisionPayloadSchema,
  created_by: z.string().min(1),
  idempotency_key: z.string().min(1).max(256),
}).strict();
export type CreateTaskSpecRevisionRequestDto = z.infer<typeof createTaskSpecRevisionRequestSchema>;

export const taskSpecRevisionSchema = createTaskSpecRevisionRequestSchema.omit({ idempotency_key: true }).extend({
  id: z.string().min(1),
  revision: z.number().int().positive(),
  payload_digest: sha256DigestSchema,
  idempotency_key: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
});
export type TaskSpecRevisionDto = z.infer<typeof taskSpecRevisionSchema>;

export const taskSpecRevisionListResponseSchema = z.object({
  revisions: z.array(taskSpecRevisionSchema),
}).strict();

export const executionBudgetSchema = z.object({
  max_wall_clock_seconds: z.number().int().positive().max(86_400),
  max_tokens: z.number().int().positive().nullable(),
  max_tool_calls: z.number().int().positive().nullable(),
  max_cost_usd: z.number().nonnegative().nullable(),
  max_external_actions: z.number().int().nonnegative().max(10_000),
}).strict();
export type ExecutionBudgetDto = z.infer<typeof executionBudgetSchema>;

export const createExecutionBaselineRequestSchema = z.object({
  task_id: z.string().min(1),
  task_revision_id: z.string().min(1),
  task_revision_digest: sha256DigestSchema,
  plan_digest: sha256DigestSchema,
  input_refs: z.array(referenceSchema).default([]),
  approval_refs: z.array(z.string().min(1).max(512)).min(1).max(128),
  policy_refs: z.array(z.string().min(1).max(512)).default([]),
  coordination_run_ref: z.string().min(1).nullable().optional(),
  agent_composition_refs: z.array(z.string().min(1).max(512)).default([]),
  skill_adoption_refs: z.array(z.string().min(1).max(512)).default([]),
  budget: executionBudgetSchema,
  evidence_obligations: z.array(z.string().min(1).max(512)).min(1).max(128),
  expires_at: z.string().datetime({ offset: true }).nullable(),
  approved_by: z.string().min(1),
  idempotency_key: z.string().min(1).max(256),
}).strict();
export type CreateExecutionBaselineRequestDto = z.infer<typeof createExecutionBaselineRequestSchema>;

export const executionBaselineStatusSchema = z.enum(['approved', 'revoked', 'superseded']);
export type ExecutionBaselineStatusDto = z.infer<typeof executionBaselineStatusSchema>;

export const executionBaselineSchema = createExecutionBaselineRequestSchema.omit({ idempotency_key: true }).extend({
  id: z.string().min(1),
  baseline_digest: sha256DigestSchema,
  status: executionBaselineStatusSchema,
  idempotency_key: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
});
export type ExecutionBaselineDto = z.infer<typeof executionBaselineSchema>;

export const executionBaselineListResponseSchema = z.object({
  baselines: z.array(executionBaselineSchema),
}).strict();

export const createEvidenceManifestRequestSchema = z.object({
  task_id: z.string().min(1),
  task_revision_id: z.string().min(1),
  execution_baseline_id: z.string().min(1),
  execution_baseline_digest: sha256DigestSchema,
  input_refs: z.array(referenceSchema).default([]),
  approval_refs: z.array(z.string().min(1).max(512)).default([]),
  policy_refs: z.array(z.string().min(1).max(512)).default([]),
  run_refs: z.array(z.string().min(1).max(512)).min(1).max(256),
  output_artifact_refs: z.array(referenceSchema).min(1).max(256),
  notes: z.string().max(20_000).nullable().optional(),
  created_by: z.string().min(1),
  idempotency_key: z.string().min(1).max(256),
}).strict();
export type CreateEvidenceManifestRequestDto = z.infer<typeof createEvidenceManifestRequestSchema>;

export const evidenceManifestSchema = createEvidenceManifestRequestSchema.omit({ idempotency_key: true }).extend({
  id: z.string().min(1),
  manifest_digest: sha256DigestSchema,
  status: z.literal('sealed'),
  idempotency_key: z.string().min(1),
  sealed_at: z.string().datetime({ offset: true }),
});
export type EvidenceManifestDto = z.infer<typeof evidenceManifestSchema>;

export const evidenceManifestListResponseSchema = z.object({
  manifests: z.array(evidenceManifestSchema),
}).strict();
