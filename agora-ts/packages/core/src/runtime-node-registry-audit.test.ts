import { describe, expect, it, vi } from 'vitest';
import type { RuntimeNodeDispatchDto, RuntimeNodeDto } from '@agora-ts/contracts';
import { ConflictError } from './errors.js';
import { RuntimeNodeRegistryService } from './runtime-node-registry-service.js';

const node = {
  node_id: 'web-1',
  presence: 'online',
  instance_id: 'instance-1',
} as RuntimeNodeDto;

const dispatch = {
  id: 'dispatch-1',
  node_id: 'web-1',
  task_id: 'task-1',
  runtime_target_ref: 'dsh:web-1:worker',
  metadata: {
    action_audit: {
      delegation_authority_id: 'authority-1',
      actor_ref: 'agent:controller',
      action: 'dispatch_subtask',
      subject_ref: 'dsh:web-1:worker',
      idempotency_key: 'audit-1',
      attempt_id: 'attempt-1',
    },
  },
  status: 'pending',
  result_envelope: null,
  error: null,
} as unknown as RuntimeNodeDispatchDto;

describe('RuntimeNodeRegistryService action audit boundary', () => {
  it('admits audited dispatches and records a terminal provider-neutral receipt', () => {
    const audit = {
      admit: vi.fn(() => ({ id: 'attempt-1', decision: 'admit', decision_reason: 'authorized' })),
      recordReceipt: vi.fn(),
    };
    const repository = {
      getNode: vi.fn(() => node),
      createDispatch: vi.fn(() => dispatch),
      getDispatch: vi.fn(() => dispatch),
      completeDispatch: vi.fn(() => ({
        ...dispatch,
        status: 'completed',
        result_envelope: {
          schema: 'agora.runtime-result/v1',
          answer: 'done',
          claims: [],
          evidence: [{ id: 'e1', kind: 'file', uri: 'artifact:1' }],
        },
      })),
    };
    const service = new RuntimeNodeRegistryService(repository as never, { actionAuditService: audit as never });

    service.createDispatch('web-1', {
      task_id: 'task-1',
      runtime_target_ref: 'dsh:web-1:worker',
      prompt: 'research',
      idempotency_key: 'dispatch-1',
      metadata: {
        action_audit: {
          delegation_authority_id: 'authority-1',
          actor_ref: 'agent:controller',
          action: 'dispatch_subtask',
          subject_ref: 'dsh:web-1:worker',
          idempotency_key: 'audit-1',
        },
      },
    });

    expect(audit.admit).toHaveBeenCalledWith({
      task_id: 'task-1',
      collaboration_plan_id: null,
      execution_baseline_id: null,
      delegation_authority_id: 'authority-1',
      subtask_spec_id: null,
      actor_ref: 'agent:controller',
      action: 'dispatch_subtask',
      subject_ref: 'dsh:web-1:worker',
      idempotency_key: 'audit-1',
    });
    expect(repository.createDispatch).toHaveBeenCalledWith('web-1', expect.objectContaining({
      metadata: expect.objectContaining({
        action_audit: expect.objectContaining({ attempt_id: 'attempt-1' }),
      }),
    }));

    service.completeDispatch('web-1', 'dispatch-1', {
      instance_id: 'instance-1',
      claim_token: 'claim-1',
      status: 'completed',
    });
    expect(audit.recordReceipt).toHaveBeenCalledWith(expect.objectContaining({
      attempt_id: 'attempt-1',
      outcome: 'succeeded',
      provider_ref: 'runtime-dispatch:dispatch-1',
      evidence_refs: ['runtime-dispatch:dispatch-1', 'artifact:1'],
      idempotency_key: 'runtime-dispatch:dispatch-1:succeeded',
    }));
  });

  it('does not enqueue a provider dispatch after a denied admission', () => {
    const audit = {
      admit: vi.fn(() => ({ id: 'attempt-denied', decision: 'deny', decision_reason: 'authority expired' })),
    };
    const repository = {
      getNode: vi.fn(() => node),
      createDispatch: vi.fn(),
    };
    const service = new RuntimeNodeRegistryService(repository as never, { actionAuditService: audit as never });

    expect(() => service.createDispatch('web-1', {
      task_id: 'task-1',
      runtime_target_ref: 'dsh:web-1:worker',
      prompt: 'research',
      idempotency_key: 'dispatch-denied',
      metadata: {
        action_audit: {
          delegation_authority_id: 'authority-expired',
          actor_ref: 'agent:controller',
          action: 'dispatch_subtask',
          subject_ref: 'dsh:web-1:worker',
          idempotency_key: 'audit-denied',
        },
      },
    })).toThrow(ConflictError);
    expect(repository.createDispatch).not.toHaveBeenCalled();
  });

  it('requires the governed envelope for tasks with an approved collaboration plan', () => {
    const repository = {
      getNode: vi.fn(() => node),
      createDispatch: vi.fn(),
    };
    const service = new RuntimeNodeRegistryService(repository as never, {
      actionAuditService: {} as never,
      requireGovernanceForTask: () => true,
    });
    expect(() => service.createDispatch('web-1', {
      task_id: 'task-governed', runtime_target_ref: 'dsh:web-1:worker', prompt: 'work', idempotency_key: 'dispatch-governed',
    })).toThrow(/governed dispatch envelope/);
    expect(repository.createDispatch).not.toHaveBeenCalled();
  });
});
