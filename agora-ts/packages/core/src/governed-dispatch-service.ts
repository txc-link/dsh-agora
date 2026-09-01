import {
  governedDispatchEnvelopeSchema,
  type CreateRuntimeNodeDispatchRequestDto,
  type DelegationActionDto,
  type GovernedDispatchEnvelopeDto,
  type ICollaborationPlanRepository,
  type IDelegationAuthorityRepository,
  type IExecutionBaselineRepository,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError } from './errors.js';

export interface PrepareGovernedDispatchInput {
  task_id: string;
  collaboration_plan_id: string;
  runtime_target_ref: string;
  prompt: string;
  idempotency_key: string;
  actor_ref: string;
  action: DelegationActionDto;
  subject_ref: string;
  delegation_authority_id?: string | null;
  execution_baseline_id?: string | null;
  subtask_spec_id?: string | null;
  participant_binding_id?: string | null;
  session_id?: string | null;
  workspace_alias?: string | null;
  agent_preset?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface GovernedDispatchServiceOptions {
  plans: ICollaborationPlanRepository;
  authorities: IDelegationAuthorityRepository;
  baselines: IExecutionBaselineRepository;
  now?: () => Date;
}

/** Resolves the immutable plan/baseline/authority chain into one dispatch envelope. */
export class GovernedDispatchService {
  private readonly now: () => Date;

  constructor(private readonly options: GovernedDispatchServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  prepare(input: PrepareGovernedDispatchInput): GovernedDispatchEnvelopeDto {
    const plan = this.options.plans.getById(input.collaboration_plan_id);
    if (!plan) throw new NotFoundError(`CollaborationPlan ${input.collaboration_plan_id} not found`);
    if (plan.task_id !== input.task_id) throw new ConflictError('collaboration plan does not belong to the dispatch task');
    if (!['approved', 'active'].includes(plan.status)) throw new ConflictError(`CollaborationPlan ${plan.id} is ${plan.status}`);

    const authority = input.delegation_authority_id
      ? this.options.authorities.getById(input.delegation_authority_id)
      : this.options.authorities.listByTask(input.task_id)
        .filter(candidate => plan.delegation_authority_ids.includes(candidate.id))
        .find(candidate => candidate.status === 'active'
          && candidate.delegate_ref === input.actor_ref
          && candidate.allowed_actions.includes(input.action)
          && (!candidate.expires_at || Date.parse(candidate.expires_at) > this.now().getTime())
          && (candidate.scope === 'task' || input.subtask_spec_id === undefined || candidate.subtask_spec_id === input.subtask_spec_id));
    if (!authority) throw new ConflictError('no active delegation authority matches the governed dispatch');
    if (!plan.delegation_authority_ids.includes(authority.id)) throw new ConflictError('delegation authority is not included in the collaboration plan');
    if (authority.task_id !== input.task_id || authority.delegate_ref !== input.actor_ref) throw new ConflictError('delegation authority does not match dispatch actor/task');
    if (authority.status !== 'active') throw new ConflictError(`DelegationAuthority ${authority.id} is ${authority.status}`);
    if (authority.expires_at && Date.parse(authority.expires_at) <= this.now().getTime()) throw new ConflictError(`DelegationAuthority ${authority.id} has expired`);
    if (!authority.allowed_actions.includes(input.action)) throw new ConflictError(`delegation authority does not allow action ${input.action}`);

    const subtaskId = input.subtask_spec_id ?? authority.subtask_spec_id ?? plan.subtask_spec_ids[0] ?? null;
    if (subtaskId && !plan.subtask_spec_ids.includes(subtaskId)) throw new ConflictError('requested subtask is not included in the collaboration plan');
    if (authority.scope === 'subtask' && authority.subtask_spec_id !== subtaskId) throw new ConflictError('subtask authority does not match dispatch subtask');

    const baseline = input.execution_baseline_id
      ? this.options.baselines.getById(input.execution_baseline_id)
      : this.options.baselines.listByTask(input.task_id)
        .find(candidate => candidate.status === 'approved'
          && candidate.plan_digest === plan.plan_digest
          && (!candidate.expires_at || Date.parse(candidate.expires_at) > this.now().getTime()));
    if (!baseline) throw new ConflictError('an approved, unexpired execution baseline matching the plan is required');
    if (baseline.task_id !== input.task_id || baseline.plan_digest !== plan.plan_digest) throw new ConflictError('execution baseline does not match the collaboration plan');
    if (baseline.status !== 'approved') throw new ConflictError(`ExecutionBaseline ${baseline.id} is ${baseline.status}`);
    if (baseline.expires_at && Date.parse(baseline.expires_at) <= this.now().getTime()) throw new ConflictError(`ExecutionBaseline ${baseline.id} has expired`);

    return governedDispatchEnvelopeSchema.parse({
      schema: 'agora.governed-dispatch/v1',
      task_id: input.task_id,
      participant_binding_id: input.participant_binding_id ?? null,
      runtime_target_ref: input.runtime_target_ref,
      session_id: input.session_id ?? null,
      workspace_alias: input.workspace_alias ?? null,
      agent_preset: input.agent_preset ?? null,
      prompt: input.prompt,
      idempotency_key: input.idempotency_key,
      metadata: input.metadata ?? null,
      action_audit: {
        collaboration_plan_id: plan.id,
        execution_baseline_id: baseline.id,
        delegation_authority_id: authority.id,
        subtask_spec_id: subtaskId,
        actor_ref: input.actor_ref,
        action: input.action,
        subject_ref: input.subject_ref,
        idempotency_key: input.idempotency_key,
      },
    });
  }

  toRuntimeDispatch(envelope: GovernedDispatchEnvelopeDto): CreateRuntimeNodeDispatchRequestDto {
    return {
      task_id: envelope.task_id,
      participant_binding_id: envelope.participant_binding_id ?? null,
      runtime_target_ref: envelope.runtime_target_ref,
      session_id: envelope.session_id ?? null,
      workspace_alias: envelope.workspace_alias ?? null,
      agent_preset: envelope.agent_preset ?? null,
      prompt: envelope.prompt,
      idempotency_key: envelope.idempotency_key,
      metadata: { ...(envelope.metadata ?? {}), action_audit: envelope.action_audit },
    };
  }
}
