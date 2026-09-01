import { z } from 'zod';
import { coordinationModeSchema } from './coordination.js';
import { sha256DigestSchema } from './governed-execution.js';

export const collaborationModeSchema = coordinationModeSchema;
export type CollaborationModeDto = z.infer<typeof collaborationModeSchema>;

export const collaborationRequirementStatusSchema = z.enum(['draft', 'approved', 'superseded']);
export type CollaborationRequirementStatusDto = z.infer<typeof collaborationRequirementStatusSchema>;

export const subTaskSpecStatusSchema = z.enum(['draft', 'approved', 'retired']);
export type SubTaskSpecStatusDto = z.infer<typeof subTaskSpecStatusSchema>;

export const delegationAuthorityScopeSchema = z.enum(['task', 'subtask']);
export type DelegationAuthorityScopeDto = z.infer<typeof delegationAuthorityScopeSchema>;

export const delegationActionSchema = z.enum([
  'read_context',
  'dispatch_subtask',
  'write_artifact',
  'request_approval',
  'delegate',
]);
export type DelegationActionDto = z.infer<typeof delegationActionSchema>;

export const delegationAuthorityStatusSchema = z.enum(['active', 'revoked', 'expired']);
export type DelegationAuthorityStatusDto = z.infer<typeof delegationAuthorityStatusSchema>;

export const collaborationPlanStatusSchema = z.enum(['proposed', 'approved', 'active', 'completed', 'rejected']);
export type CollaborationPlanStatusDto = z.infer<typeof collaborationPlanStatusSchema>;

const collaborationRequirementRequestShape = {
  task_id: z.string().min(1),
  task_revision_id: z.string().min(1),
  task_revision_digest: sha256DigestSchema,
  mode: collaborationModeSchema,
  min_agents: z.number().int().positive().max(32),
  max_agents: z.number().int().positive().max(32),
  required_roles: z.array(z.string().min(1).max(128)).max(32).default([]),
  required_capabilities: z.array(z.string().min(1).max(128)).max(128).default([]),
  quorum: z.number().int().positive().max(32).default(1),
  reviewer_required: z.boolean().default(false),
  information_domains: z.array(z.string().min(1).max(128)).max(32).default([]),
  created_by: z.string().min(1),
  idempotency_key: z.string().min(1).max(256),
};

export const createCollaborationRequirementRequestSchema = z.object(collaborationRequirementRequestShape).strict().superRefine((value, context) => {
  if (value.min_agents > value.max_agents) {
    context.addIssue({ code: 'custom', path: ['min_agents'], message: 'min_agents cannot exceed max_agents' });
  }
  if (value.quorum > value.max_agents) {
    context.addIssue({ code: 'custom', path: ['quorum'], message: 'quorum cannot exceed max_agents' });
  }
});
export type CreateCollaborationRequirementRequestDto = z.infer<typeof createCollaborationRequirementRequestSchema>;

export const collaborationRequirementSchema = z.object({
  ...collaborationRequirementRequestShape,
  id: z.string().min(1),
  requirement_digest: sha256DigestSchema,
  status: collaborationRequirementStatusSchema,
  created_at: z.string().datetime({ offset: true }),
}).strict();
export type CollaborationRequirementDto = z.infer<typeof collaborationRequirementSchema>;
export const collaborationRequirementListResponseSchema = z.object({ requirements: z.array(collaborationRequirementSchema) }).strict();

export const createSubTaskSpecRequestSchema = z.object({
  task_id: z.string().min(1),
  requirement_id: z.string().min(1),
  ordinal: z.number().int().positive(),
  parent_spec_id: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(512),
  objective: z.string().min(1).max(200_000),
  acceptance_criteria: z.array(z.string().min(1).max(4_000)).min(1).max(128),
  dependency_spec_ids: z.array(z.string().min(1)).max(128).default([]),
  required_capabilities: z.array(z.string().min(1).max(128)).max(128).default([]),
  preferred_role: z.string().min(1).max(128).nullable().optional(),
  assignee_ref: z.string().min(1).max(512).nullable().optional(),
  information_domain: z.string().min(1).max(128).default('company'),
  created_by: z.string().min(1),
  idempotency_key: z.string().min(1).max(256),
}).strict();
export type CreateSubTaskSpecRequestDto = z.infer<typeof createSubTaskSpecRequestSchema>;

export const subTaskSpecSchema = createSubTaskSpecRequestSchema.omit({ idempotency_key: true }).extend({
  id: z.string().min(1),
  parent_spec_id: z.string().min(1).nullable(),
  preferred_role: z.string().min(1).max(128).nullable(),
  assignee_ref: z.string().min(1).max(512).nullable(),
  spec_digest: sha256DigestSchema,
  status: subTaskSpecStatusSchema,
  idempotency_key: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
});
export type SubTaskSpecDto = z.infer<typeof subTaskSpecSchema>;
export const subTaskSpecListResponseSchema = z.object({ specs: z.array(subTaskSpecSchema) }).strict();

export const createDelegationAuthorityRequestSchema = z.object({
  task_id: z.string().min(1),
  requirement_id: z.string().min(1),
  scope: delegationAuthorityScopeSchema,
  subtask_spec_id: z.string().min(1).nullable().optional(),
  delegator_ref: z.string().min(1).max(512),
  delegate_ref: z.string().min(1).max(512),
  allowed_actions: z.array(delegationActionSchema).min(1).max(5),
  max_delegation_depth: z.number().int().nonnegative().max(16),
  expires_at: z.string().datetime({ offset: true }).nullable(),
  created_by: z.string().min(1),
  idempotency_key: z.string().min(1).max(256),
}).strict();
export type CreateDelegationAuthorityRequestDto = z.infer<typeof createDelegationAuthorityRequestSchema>;

export const delegationAuthoritySchema = createDelegationAuthorityRequestSchema.omit({ idempotency_key: true }).extend({
  id: z.string().min(1),
  subtask_spec_id: z.string().min(1).nullable(),
  authority_digest: sha256DigestSchema,
  status: delegationAuthorityStatusSchema,
  idempotency_key: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
});
export type DelegationAuthorityDto = z.infer<typeof delegationAuthoritySchema>;
export const delegationAuthorityListResponseSchema = z.object({ authorities: z.array(delegationAuthoritySchema) }).strict();

export const createCollaborationPlanRequestSchema = z.object({
  task_id: z.string().min(1),
  requirement_id: z.string().min(1),
  task_revision_id: z.string().min(1),
  task_revision_digest: sha256DigestSchema,
  subtask_spec_ids: z.array(z.string().min(1)).min(1).max(128),
  delegation_authority_ids: z.array(z.string().min(1)).max(128).default([]),
  coordination_run_ref: z.string().min(1).nullable().optional(),
  created_by: z.string().min(1),
  idempotency_key: z.string().min(1).max(256),
}).strict();
export type CreateCollaborationPlanRequestDto = z.infer<typeof createCollaborationPlanRequestSchema>;

export const collaborationPlanSchema = createCollaborationPlanRequestSchema.omit({ idempotency_key: true }).extend({
  id: z.string().min(1),
  coordination_run_ref: z.string().min(1).nullable(),
  plan_digest: sha256DigestSchema,
  status: collaborationPlanStatusSchema,
  idempotency_key: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
});
export type CollaborationPlanDto = z.infer<typeof collaborationPlanSchema>;
export const collaborationPlanListResponseSchema = z.object({ plans: z.array(collaborationPlanSchema) }).strict();
