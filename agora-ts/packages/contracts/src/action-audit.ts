import { z } from 'zod';
import { delegationActionSchema } from './collaboration-governance.js';
import { sha256DigestSchema } from './governed-execution.js';

export const actionAttemptDecisionSchema = z.enum(['admit', 'deny']);
export type ActionAttemptDecisionDto = z.infer<typeof actionAttemptDecisionSchema>;

export const actionReceiptOutcomeSchema = z.enum(['succeeded', 'failed', 'denied']);
export type ActionReceiptOutcomeDto = z.infer<typeof actionReceiptOutcomeSchema>;

const actionAttemptRequestShape = {
  task_id: z.string().min(1),
  collaboration_plan_id: z.string().min(1).nullable().optional(),
  execution_baseline_id: z.string().min(1).nullable().optional(),
  delegation_authority_id: z.string().min(1).nullable().optional(),
  subtask_spec_id: z.string().min(1).nullable().optional(),
  actor_ref: z.string().min(1).max(512),
  action: delegationActionSchema,
  subject_ref: z.string().min(1).max(2_000),
  idempotency_key: z.string().min(1).max(256),
};

export const createActionAttemptRequestSchema = z.object(actionAttemptRequestShape).strict();
export type CreateActionAttemptRequestDto = z.infer<typeof createActionAttemptRequestSchema>;

export const actionAttemptSchema = z.object({
  ...actionAttemptRequestShape,
  id: z.string().min(1),
  collaboration_plan_id: z.string().min(1).nullable(),
  execution_baseline_id: z.string().min(1).nullable(),
  delegation_authority_id: z.string().min(1).nullable(),
  subtask_spec_id: z.string().min(1).nullable(),
  decision: actionAttemptDecisionSchema,
  decision_reason: z.string().min(1).max(2_000),
  attempt_digest: sha256DigestSchema,
  created_at: z.string().datetime({ offset: true }),
}).strict();
export type ActionAttemptDto = z.infer<typeof actionAttemptSchema>;
export const actionAttemptListResponseSchema = z.object({ attempts: z.array(actionAttemptSchema) }).strict();

export const createActionReceiptRequestSchema = z.object({
  attempt_id: z.string().min(1),
  outcome: z.enum(['succeeded', 'failed']),
  provider_ref: z.string().min(1).max(2_000).nullable().optional(),
  evidence_refs: z.array(z.string().min(1).max(2_000)).max(128).default([]),
  error_code: z.string().min(1).max(128).nullable().optional(),
  summary: z.string().min(1).max(4_000).nullable().optional(),
  created_by: z.string().min(1).max(512),
  idempotency_key: z.string().min(1).max(256),
}).strict();
export type CreateActionReceiptRequestDto = z.infer<typeof createActionReceiptRequestSchema>;

export const actionReceiptSchema = z.object({
  ...createActionReceiptRequestSchema.shape,
  task_id: z.string().min(1),
  id: z.string().min(1),
  outcome: actionReceiptOutcomeSchema,
  provider_ref: z.string().min(1).max(2_000).nullable(),
  error_code: z.string().min(1).max(128).nullable(),
  summary: z.string().min(1).max(4_000).nullable(),
  receipt_digest: sha256DigestSchema,
  created_at: z.string().datetime({ offset: true }),
}).strict();
export type ActionReceiptDto = z.infer<typeof actionReceiptSchema>;
export const actionReceiptListResponseSchema = z.object({ receipts: z.array(actionReceiptSchema) }).strict();
