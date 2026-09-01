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
import { ActionAuditService } from '@agora-ts/core';
import { buildApp } from './app.js';

class AttemptRepository implements IActionAttemptRepository {
  readonly records: ActionAttemptRecord[] = [];
  insert(record: ActionAttemptRecord) { this.records.push(record); return record; }
  getById(id: string) { return this.records.find((record) => record.id === id) ?? null; }
  getByIdempotencyKey(key: string) { return this.records.find((record) => record.idempotency_key === key) ?? null; }
  listByTask(taskId: string) { return this.records.filter((record) => record.task_id === taskId); }
}
class ReceiptRepository implements IActionReceiptRepository {
  readonly records: ActionReceiptRecord[] = [];
  insert(record: ActionReceiptRecord) { this.records.push(record); return record; }
  getById(id: string) { return this.records.find((record) => record.id === id) ?? null; }
  getByAttemptId(id: string) { return this.records.find((record) => record.attempt_id === id) ?? null; }
  getByIdempotencyKey(key: string) { return this.records.find((record) => record.idempotency_key === key) ?? null; }
  listByTask(taskId: string) { return this.records.filter((record) => record.task_id === taskId); }
}
class One<T extends { id: string }>
  { constructor(private readonly record: T) {} getById(id: string) { return this.record.id === id ? this.record : null; } }

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const plan: CollaborationPlanRecord = {
  id: 'plan-1', task_id: 'task-1', requirement_id: 'requirement-1', task_revision_id: 'revision-1', task_revision_digest: digest('revision'),
  subtask_spec_ids: ['spec-1'], delegation_authority_ids: ['authority-1'], coordination_run_ref: null, plan_digest: digest('plan'), status: 'approved',
  created_by: 'human:ceo', idempotency_key: 'plan-key', created_at: '2026-09-01T09:00:00.000Z',
};
const authority: DelegationAuthorityRecord = {
  id: 'authority-1', task_id: 'task-1', requirement_id: 'requirement-1', scope: 'task', subtask_spec_id: null, delegator_ref: 'agent:ea', delegate_ref: 'agent:worker',
  allowed_actions: ['dispatch_subtask'], max_delegation_depth: 0, expires_at: '2026-09-02T10:00:00.000Z', created_by: 'human:ceo', authority_digest: digest('authority'), status: 'active',
  idempotency_key: 'authority-key', created_at: '2026-09-01T09:00:00.000Z',
};
const baseline: ExecutionBaselineRecord = {
  id: 'baseline-1', task_id: 'task-1', task_revision_id: 'revision-1', task_revision_digest: digest('revision'), plan_digest: plan.plan_digest,
  input_refs: [], approval_refs: [], policy_refs: [], coordination_run_ref: null, agent_composition_refs: [], skill_adoption_refs: [],
  budget: { max_wall_clock_seconds: 600, max_tokens: null, max_tool_calls: null, max_cost_usd: null, max_external_actions: 0 }, evidence_obligations: [], expires_at: null,
  approved_by: 'human:ceo', baseline_digest: digest('baseline'), status: 'approved', idempotency_key: 'baseline-key', created_at: '2026-09-01T09:00:00.000Z',
};

function makeService() {
  let id = 0;
  return new ActionAuditService({
    attempts: new AttemptRepository(), receipts: new ReceiptRepository(), plans: new One(plan) as ICollaborationPlanRepository,
    authorities: new One(authority) as IDelegationAuthorityRepository, baselines: new One(baseline) as IExecutionBaselineRepository,
    idGenerator: () => `route-audit-${++id}`, now: () => new Date('2026-09-01T10:00:00.000Z'),
  });
}

describe('action audit routes', () => {
  it('admits an action, records its receipt and lists both resources', async () => {
    const app = buildApp({ actionAuditService: makeService() });
    const attemptResponse = await app.inject({ method: 'POST', url: '/api/tasks/task-1/action-attempts', payload: {
      collaboration_plan_id: 'plan-1', execution_baseline_id: 'baseline-1', delegation_authority_id: 'authority-1', subtask_spec_id: 'spec-1',
      actor_ref: 'agent:worker', action: 'dispatch_subtask', subject_ref: 'subtask:spec-1', idempotency_key: 'attempt-1',
    } });
    expect(attemptResponse.statusCode).toBe(201);
    const attempt = attemptResponse.json();
    const receiptResponse = await app.inject({ method: 'POST', url: '/api/tasks/task-1/action-receipts', payload: {
      attempt_id: attempt.id, outcome: 'succeeded', provider_ref: 'runtime:dispatch-1', evidence_refs: ['artifact:1'], created_by: 'runtime:worker', idempotency_key: 'receipt-1',
    } });
    expect(receiptResponse.statusCode).toBe(201);
    expect(receiptResponse.json().outcome).toBe('succeeded');
    expect((await app.inject({ method: 'GET', url: '/api/tasks/task-1/action-attempts' })).json().attempts).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/api/tasks/task-1/action-receipts' })).json().receipts).toHaveLength(1);
    await app.close();
  });

  it('returns a denied attempt while preserving a denied receipt', async () => {
    const app = buildApp({ actionAuditService: makeService() });
    const response = await app.inject({ method: 'POST', url: '/api/tasks/task-1/action-attempts', payload: {
      actor_ref: 'agent:worker', action: 'write_artifact', subject_ref: 'artifact:1', idempotency_key: 'attempt-denied',
    } });
    expect(response.statusCode).toBe(201);
    expect(response.json().decision).toBe('deny');
    const receipts = await app.inject({ method: 'GET', url: '/api/tasks/task-1/action-receipts' });
    expect(receipts.json().receipts[0].outcome).toBe('denied');
    await app.close();
  });
});
