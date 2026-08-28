import { z } from 'zod';

export const mergeProposalStatusSchema = z.enum(['proposed', 'approved', 'rejected', 'merging', 'merged', 'conflicted', 'failed']);

export const createMergeProposalRequestSchema = z.object({
  task_id: z.string().min(1),
  project_id: z.string().min(1),
  base_revision: z.string().min(1).max(256),
  head_revision: z.string().min(1).max(256),
  worktree_path: z.string().min(1).max(4_096),
  diff_summary: z.string().min(1).max(100_000),
  validation_artifact_ids: z.array(z.string().min(1)).min(1),
  requested_by: z.string().min(1).max(256),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
export type CreateMergeProposalRequestDto = z.infer<typeof createMergeProposalRequestSchema>;

export const mergeProposalSchema = createMergeProposalRequestSchema.extend({
  id: z.string().min(1),
  status: mergeProposalStatusSchema,
  approved_by: z.string().nullable(),
  decision_reason: z.string().nullable(),
  merge_commit: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  decided_at: z.string().nullable(),
  merged_at: z.string().nullable(),
});
export type MergeProposalDto = z.infer<typeof mergeProposalSchema>;

export const decideMergeProposalRequestSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().min(1).max(10_000),
}).strict();

export const mergeProposalListResponseSchema = z.object({ proposals: z.array(mergeProposalSchema) });
