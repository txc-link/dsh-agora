import { describe, expect, it } from 'vitest';
import { GovernedDispatchService } from './governed-dispatch-service.js';

const plan = {
  id: 'plan-1', task_id: 'task-1', requirement_id: 'req-1', task_revision_id: 'rev-1',
  task_revision_digest: 'a'.repeat(64), subtask_spec_ids: ['spec-1'], delegation_authority_ids: ['auth-1'],
  coordination_run_ref: null, plan_digest: 'b'.repeat(64), status: 'approved', created_by: 'human:ceo',
  idempotency_key: 'plan-key', created_at: '2026-09-01T00:00:00.000Z',
} as const;
const authority = {
  id: 'auth-1', task_id: 'task-1', requirement_id: 'req-1', scope: 'subtask', subtask_spec_id: 'spec-1',
  delegator_ref: 'agent:lead', delegate_ref: 'agent:lead', allowed_actions: ['dispatch_subtask'], max_delegation_depth: 1,
  expires_at: null, created_by: 'human:ceo', authority_digest: 'c'.repeat(64), status: 'active', idempotency_key: 'auth-key',
  created_at: '2026-09-01T00:00:00.000Z',
} as const;
const baseline = {
  id: 'baseline-1', task_id: 'task-1', task_revision_id: 'rev-1', task_revision_digest: 'a'.repeat(64), plan_digest: 'b'.repeat(64),
  input_refs: [], approval_refs: ['approval-1'], policy_refs: [], coordination_run_ref: null, agent_composition_refs: [], skill_adoption_refs: [],
  budget: { max_wall_clock_seconds: 300, max_tokens: null, max_tool_calls: null, max_cost_usd: null, max_external_actions: 0 },
  evidence_obligations: ['result'], expires_at: null, approved_by: 'human:ceo', baseline_digest: 'd'.repeat(64), status: 'approved',
  idempotency_key: 'baseline-key', created_at: '2026-09-01T00:00:00.000Z',
} as const;

describe('GovernedDispatchService', () => {
  it('resolves the plan authority and matching baseline into a provider-neutral envelope', () => {
    const service = new GovernedDispatchService({
      plans: { getById: () => plan } as never,
      authorities: { getById: () => authority, listByTask: () => [authority] } as never,
      baselines: { getById: () => baseline, listByTask: () => [baseline] } as never,
    });
    const envelope = service.prepare({
      task_id: 'task-1', collaboration_plan_id: 'plan-1', runtime_target_ref: 'dsh:node-a:research', prompt: 'research',
      idempotency_key: 'dispatch-1', actor_ref: 'agent:lead', action: 'dispatch_subtask', subject_ref: 'spec-1',
    });
    expect(envelope).toMatchObject({ schema: 'agora.governed-dispatch/v1', task_id: 'task-1', action_audit: {
      collaboration_plan_id: 'plan-1', execution_baseline_id: 'baseline-1', delegation_authority_id: 'auth-1', subtask_spec_id: 'spec-1',
    } });
    expect(service.toRuntimeDispatch(envelope).metadata).toMatchObject({ action_audit: expect.objectContaining({ delegation_authority_id: 'auth-1' }) });
  });

  it('rejects an actor without a matching authority', () => {
    const service = new GovernedDispatchService({
      plans: { getById: () => plan } as never,
      authorities: { getById: () => null, listByTask: () => [authority] } as never,
      baselines: { getById: () => baseline, listByTask: () => [baseline] } as never,
    });
    expect(() => service.prepare({
      task_id: 'task-1', collaboration_plan_id: 'plan-1', runtime_target_ref: 'dsh:node-a:research', prompt: 'research',
      idempotency_key: 'dispatch-2', actor_ref: 'agent:other', action: 'dispatch_subtask', subject_ref: 'spec-1',
    })).toThrow(/authority/);
  });
});
