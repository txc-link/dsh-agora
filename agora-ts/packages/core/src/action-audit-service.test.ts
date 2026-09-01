import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  ActionAttemptRecord,
  ActionReceiptRecord,
  CollaborationPlanRecord,
  DelegationAuthorityRecord,
  ExecutionBaselineRecord,
  ICollaborationPlanRepository,
  IDelegationAuthorityRepository,
  IExecutionBaselineRepository,
  IActionAttemptRepository,
  IActionReceiptRepository,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError } from './errors.js';
import { ActionAuditService } from './action-audit-service.js';

class AttemptMemoryRepository implements IActionAttemptRepository {
  readonly records: ActionAttemptRecord[] = [];
  insert(record: ActionAttemptRecord) { this.records.push(record); return record; }
  getById(id: string) { return this.records.find((record) => record.id === id) ?? null; }
  getByIdempotencyKey(key: string) { return this.records.find((record) => record.idempotency_key === key) ?? null; }
  listByTask(taskId: string) { return this.records.filter((record) => record.task_id === taskId); }
}

class ReceiptMemoryRepository implements IActionReceiptRepository {
  readonly records: ActionReceiptRecord[] = [];
  insert(record: ActionReceiptRecord) { this.records.push(record); return record; }
  getById(id: string) { return this.records.find((record) => record.id === id) ?? null; }
  getByAttemptId(attemptId: string) { return this.records.find((record) => record.attempt_id === attemptId) ?? null; }
  getByIdempotencyKey(key: string) { return this.records.find((record) => record.idempotency_key === key) ?? null; }
  listByTask(taskId: string) { return this.records.filter((record) => record.task_id === taskId); }
}

class SingleRecordRepository<T extends { id: string; task_id: string }> {
  constructor(private readonly record: T | null) {}
  getById(id: string) { return this.record?.id === id ? this.record : null; }
}

function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }

const plan: CollaborationPlanRecord = {
  id: 'plan-1', task_id: 'task-1', requirement_id: 'requirement-1', task_revision_id: 'revision-1', task_revision_digest: digest('revision'),
  subtask_spec_ids: ['spec-1'], delegation_authority_ids: ['authority-1'], coordination_run_ref: null, plan_digest: digest('plan'),
  status: 'approved', created_by: 'human:ceo', idempotency_key: 'plan-key', created_at: '2026-09-01T09:00:00.000Z',
};
const authority: DelegationAuthorityRecord = {
  id: 'authority-1', task_id: 'task-1', requirement_id: 'requirement-1', scope: 'task', subtask_spec_id: null,
  delegator_ref: 'agent:ea', delegate_ref: 'agent:worker', allowed_actions: ['dispatch_subtask', 'write_artifact'], max_delegation_depth: 0,
  expires_at: '2026-09-02T10:00:00.000Z', created_by: 'human:ceo', authority_digest: digest('authority'), status: 'active',
  idempotency_key: 'authority-key', created_at: '2026-09-01T09:00:00.000Z',
};
const baseline: ExecutionBaselineRecord = {
  id: 'baseline-1', task_id: 'task-1', task_revision_id: 'revision-1', task_revision_digest: digest('revision'), plan_digest: plan.plan_digest,
  input_refs: [], approval_refs: [], policy_refs: [], coordination_run_ref: null, agent_composition_refs: [], skill_adoption_refs: [],
  budget: { max_wall_clock_seconds: 600, max_tokens: null, max_tool_calls: null, max_cost_usd: null, max_external_actions: 0 },
  evidence_obligations: [], expires_at: '2026-09-02T10:00:00.000Z', approved_by: 'human:ceo', baseline_digest: digest('baseline'),
  status: 'approved', idempotency_key: 'baseline-key', created_at: '2026-09-01T09:00:00.000Z',
};

function makeService() {
  let id = 0;
  const attempts = new AttemptMemoryRepository();
  const receipts = new ReceiptMemoryRepository();
  const service = new ActionAuditService({
    attempts,
    receipts,
    plans: new SingleRecordRepository(plan) as ICollaborationPlanRepository,
    authorities: new SingleRecordRepository(authority) as IDelegationAuthorityRepository,
    baselines: new SingleRecordRepository(baseline) as IExecutionBaselineRepository,
    idGenerator: () => `audit-${++id}`,
    now: () => new Date('2026-09-01T10:00:00.000Z'),
  });
  return { service, attempts, receipts };
}

const attemptInput = {
  task_id: 'task-1', collaboration_plan_id: 'plan-1', execution_baseline_id: 'baseline-1', delegation_authority_id: 'authority-1',
  subtask_spec_id: 'spec-1', actor_ref: 'agent:worker', action: 'dispatch_subtask' as const, subject_ref: 'subtask:spec-1',
  idempotency_key: 'attempt-1',
};

describe('ActionAuditService', () => {
  it('admits an authorized operation and records one terminal receipt', () => {
    const { service } = makeService();
    const attempt = service.admit(attemptInput);
    expect(attempt.decision).toBe('admit');
    expect(attempt.attempt_digest).toMatch(/^[a-f0-9]{64}$/u);
    const receipt = service.recordReceipt({
      attempt_id: attempt.id, outcome: 'succeeded', provider_ref: 'runtime:dispatch-1', evidence_refs: ['artifact:1'],
      summary: 'worker completed', created_by: 'runtime:worker', idempotency_key: 'receipt-1',
    });
    expect(receipt.outcome).toBe('succeeded');
    expect(service.recordReceipt({
      attempt_id: attempt.id, outcome: 'succeeded', provider_ref: 'runtime:dispatch-1', evidence_refs: ['artifact:1'],
      summary: 'worker completed', created_by: 'runtime:worker', idempotency_key: 'receipt-1',
    })).toBe(receipt);
    expect(() => service.recordReceipt({
      attempt_id: attempt.id, outcome: 'failed', provider_ref: null, evidence_refs: [], error_code: 'RETRY',
      summary: 'late failure', created_by: 'runtime:worker', idempotency_key: 'receipt-2',
    })).toThrowError(ConflictError);
  });

  it('persists a denied attempt and denied receipt when authorization is missing', () => {
    const { service, receipts } = makeService();
    const attempt = service.admit({ ...attemptInput, delegation_authority_id: null, idempotency_key: 'attempt-denied' });
    expect(attempt.decision).toBe('deny');
    expect(attempt.decision_reason).toContain('delegation authority is required');
    expect(receipts.records).toHaveLength(1);
    expect(receipts.records[0]?.outcome).toBe('denied');
    expect(() => service.getAttempt('missing')).toThrowError(NotFoundError);
  });

  it('rejects stale plan/baseline relationships before admission', () => {
    const { service } = makeService();
    const attempt = service.admit({ ...attemptInput, execution_baseline_id: null, idempotency_key: 'attempt-without-baseline' });
    expect(attempt.decision).toBe('admit');
    const mismatched = service.admit({ ...attemptInput, task_id: 'task-2', idempotency_key: 'attempt-cross-task' });
    expect(mismatched.decision).toBe('deny');
  });
});
