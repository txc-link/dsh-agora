import { createHash, randomUUID } from 'node:crypto';
import {
  actionAttemptSchema,
  actionReceiptSchema,
  createActionAttemptRequestSchema,
  createActionReceiptRequestSchema,
  type ActionAttemptRecord,
  type ActionReceiptRecord,
  type CreateActionAttemptRequestDto,
  type CreateActionReceiptRequestDto,
  type IActionAttemptRepository,
  type IActionReceiptRepository,
  type ICollaborationPlanRepository,
  type IDelegationAuthorityRepository,
  type IExecutionBaselineRepository,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError } from './errors.js';

export interface ActionAuditServiceOptions {
  attempts: IActionAttemptRepository;
  receipts: IActionReceiptRepository;
  plans: ICollaborationPlanRepository;
  authorities: IDelegationAuthorityRepository;
  baselines: IExecutionBaselineRepository;
  now?: () => Date;
  idGenerator?: () => string;
}

/**
 * Runtime admission and outcome journal. It knows only provider-neutral
 * references and never performs a side effect on behalf of a provider.
 */
export class ActionAuditService {
  private readonly attempts: IActionAttemptRepository;
  private readonly receipts: IActionReceiptRepository;
  private readonly plans: ICollaborationPlanRepository;
  private readonly authorities: IDelegationAuthorityRepository;
  private readonly baselines: IExecutionBaselineRepository;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;

  constructor(options: ActionAuditServiceOptions) {
    this.attempts = options.attempts;
    this.receipts = options.receipts;
    this.plans = options.plans;
    this.authorities = options.authorities;
    this.baselines = options.baselines;
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
  }

  admit(input: CreateActionAttemptRequestDto): ActionAttemptRecord {
    const parsed = createActionAttemptRequestSchema.parse(input);
    const attemptDigest = digest(parsed);
    const existing = this.attempts.getByIdempotencyKey(parsed.idempotency_key);
    if (existing) {
      if (existing.attempt_digest !== attemptDigest) {
        throw new ConflictError(`ActionAttempt idempotency key ${parsed.idempotency_key} was already used with a different request`);
      }
      return existing;
    }

    let decision: ActionAttemptRecord['decision'] = 'admit';
    let decisionReason = 'authorized by delegation authority';
    try {
      this.assertAdmissible(parsed);
    } catch (error) {
      decision = 'deny';
      decisionReason = error instanceof Error ? error.message : String(error);
    }

    const record = actionAttemptSchema.parse({
      ...parsed,
      id: this.idGenerator(),
      collaboration_plan_id: parsed.collaboration_plan_id ?? null,
      execution_baseline_id: parsed.execution_baseline_id ?? null,
      delegation_authority_id: parsed.delegation_authority_id ?? null,
      subtask_spec_id: parsed.subtask_spec_id ?? null,
      decision,
      decision_reason: decisionReason,
      attempt_digest: attemptDigest,
      created_at: this.now().toISOString(),
    });
    const inserted = this.attempts.insert(record);
    if (inserted.decision === 'deny') this.recordDeniedReceipt(inserted);
    return inserted;
  }

  getAttempt(id: string): ActionAttemptRecord {
    const record = this.attempts.getById(id);
    if (!record) throw new NotFoundError(`ActionAttempt ${id} not found`);
    return record;
  }

  listAttempts(taskId: string): ActionAttemptRecord[] {
    return this.attempts.listByTask(taskId);
  }

  recordReceipt(input: CreateActionReceiptRequestDto): ActionReceiptRecord {
    const parsed = createActionReceiptRequestSchema.parse(input);
    const attempt = this.getAttempt(parsed.attempt_id);
    if (attempt.decision !== 'admit') {
      throw new ConflictError(`ActionAttempt ${attempt.id} was denied and already has a denied receipt`);
    }
    return this.insertReceipt({
      ...parsed,
      outcome: parsed.outcome,
      provider_ref: parsed.provider_ref ?? null,
      error_code: parsed.error_code ?? null,
      summary: parsed.summary ?? null,
    }, attempt.task_id);
  }

  getReceipt(id: string): ActionReceiptRecord {
    const record = this.receipts.getById(id);
    if (!record) throw new NotFoundError(`ActionReceipt ${id} not found`);
    return record;
  }

  listReceipts(taskId: string): ActionReceiptRecord[] {
    return this.receipts.listByTask(taskId);
  }

  private assertAdmissible(input: CreateActionAttemptRequestDto): void {
    if (!input.delegation_authority_id) throw new ConflictError('delegation authority is required for a governed action');
    const authority = this.authorities.getById(input.delegation_authority_id);
    if (!authority) throw new NotFoundError(`DelegationAuthority ${input.delegation_authority_id} not found`);
    if (authority.task_id !== input.task_id) throw new ConflictError('delegation authority does not belong to the action task');
    if (authority.status !== 'active') throw new ConflictError(`DelegationAuthority ${authority.id} is ${authority.status}`);
    if (authority.expires_at && Date.parse(authority.expires_at) <= this.now().getTime()) {
      throw new ConflictError(`DelegationAuthority ${authority.id} has expired`);
    }
    if (authority.delegate_ref !== input.actor_ref) throw new ConflictError('action actor does not match delegation authority delegate');
    if (!authority.allowed_actions.includes(input.action)) {
      throw new ConflictError(`delegation authority does not allow action ${input.action}`);
    }
    if (authority.scope === 'subtask' && authority.subtask_spec_id !== input.subtask_spec_id) {
      throw new ConflictError('subtask delegation authority does not match the requested subtask');
    }
    const plan = input.collaboration_plan_id ? this.plans.getById(input.collaboration_plan_id) : null;
    if (input.collaboration_plan_id && !plan) throw new NotFoundError(`CollaborationPlan ${input.collaboration_plan_id} not found`);
    if (plan) {
      if (plan.task_id !== input.task_id) throw new ConflictError('collaboration plan does not belong to the action task');
      if (plan.status === 'rejected') throw new ConflictError(`CollaborationPlan ${plan.id} is rejected`);
      if (authority.requirement_id !== plan.requirement_id) throw new ConflictError('delegation authority does not belong to the collaboration plan requirement');
      if (input.subtask_spec_id && !plan.subtask_spec_ids.includes(input.subtask_spec_id)) {
        throw new ConflictError('requested subtask is not included in the collaboration plan');
      }
    }

    const baseline = input.execution_baseline_id ? this.baselines.getById(input.execution_baseline_id) : null;
    if (input.execution_baseline_id && !baseline) throw new NotFoundError(`ExecutionBaseline ${input.execution_baseline_id} not found`);
    if (baseline) {
      if (baseline.task_id !== input.task_id) throw new ConflictError('execution baseline does not belong to the action task');
      if (baseline.status !== 'approved') throw new ConflictError(`ExecutionBaseline ${baseline.id} is ${baseline.status}`);
      if (baseline.expires_at && Date.parse(baseline.expires_at) <= this.now().getTime()) throw new ConflictError(`ExecutionBaseline ${baseline.id} has expired`);
      if (plan && baseline.plan_digest !== plan.plan_digest) throw new ConflictError('execution baseline does not match the collaboration plan digest');
    }
  }

  private recordDeniedReceipt(attempt: ActionAttemptRecord): void {
    this.insertReceipt({
      attempt_id: attempt.id,
      outcome: 'denied',
      provider_ref: null,
      evidence_refs: [],
      error_code: 'AUTHORIZATION_DENIED',
      summary: attempt.decision_reason,
      created_by: 'action-audit-service',
      idempotency_key: `audit:denied:${attempt.id}`,
    }, attempt.task_id);
  }

  private insertReceipt(
    input: {
      attempt_id: string;
      outcome: ActionReceiptRecord['outcome'];
      provider_ref: string | null;
      evidence_refs: string[];
      error_code: string | null;
      summary: string | null;
      created_by: string;
      idempotency_key: string;
    },
    taskId: string,
  ): ActionReceiptRecord {
    const receiptDigest = digest(input);
    const existingByKey = this.receipts.getByIdempotencyKey(input.idempotency_key);
    if (existingByKey) {
      if (existingByKey.receipt_digest !== receiptDigest) throw new ConflictError(`ActionReceipt idempotency key ${input.idempotency_key} was already used with a different request`);
      return existingByKey;
    }
    const existingForAttempt = this.receipts.getByAttemptId(input.attempt_id);
    if (existingForAttempt) throw new ConflictError(`ActionAttempt ${input.attempt_id} already has terminal receipt ${existingForAttempt.id}`);
    const record = actionReceiptSchema.parse({
      ...input,
      task_id: taskId,
      id: this.idGenerator(),
      receipt_digest: receiptDigest,
      created_at: this.now().toISOString(),
    });
    return this.receipts.insert(record);
  }
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
