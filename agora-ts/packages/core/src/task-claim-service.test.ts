/**
 * task-claim-service.test.ts — org-aware-work-os S2 (TDD red → green)
 *
 * Core 编排: claim = 校验任务存在 + 未认领 + 写入 claim → claimed;
 * release = claimed → released; 冲突/重复被拒。纯 Core, 无平台名 (§1)。
 */

import { describe, expect, it, vi } from 'vitest';
import type { ITaskClaimRepository, TaskClaimRecord } from '@agora-ts/contracts';
import { TaskClaimService, type ClaimTaskInput } from './task-claim-service.js';

const NOW = '2026-08-30T00:00:00.000Z';

function makeRecord(overrides: Partial<TaskClaimRecord> = {}): TaskClaimRecord {
  return {
    id: 'claim-1',
    taskId: 'task-1',
    agentRef: 'agent:dev-1',
    status: 'pending',
    claimedAt: null,
    releasedAt: null,
    expiresAt: null,
    reason: null,
    createdAt: NOW,
    metadata: null,
    ...overrides,
  };
}

interface FakeRepo extends ITaskClaimRepository {
  _records: TaskClaimRecord[];
  _counter: number;
}

function makeService(overrides: { taskExists?: (id: string) => boolean; repo?: Partial<ITaskClaimRepository> } = {}) {
  const records: TaskClaimRecord[] = [];
  const repo: FakeRepo = {
    _records: records,
    _counter: 0,
    insert: vi.fn((input) => {
      const rec: TaskClaimRecord = {
        id: input.id ?? `claim-${++repo._counter}`,
        taskId: input.taskId,
        agentRef: input.agentRef,
        status: 'pending',
        claimedAt: null,
        releasedAt: null,
        expiresAt: input.expiresAt ?? null,
        reason: input.reason ?? null,
        createdAt: NOW,
        metadata: input.metadata ?? null,
      };
      records.push(rec);
      return rec;
    }),
    getById: vi.fn((id) => records.find((r) => r.id === id) ?? null),
    getByTaskId: vi.fn((taskId) => records.find((r) => r.taskId === taskId) ?? null),
    listByAgent: vi.fn((agentRef) => records.filter((r) => r.agentRef === agentRef)),
    listPending: vi.fn(() => records.filter((r) => r.status === 'pending')),
    listClaimed: vi.fn(() => records.filter((r) => r.status === 'claimed')),
    updateStatus: vi.fn((id, status, at) => {
      const rec = records.find((r) => r.id === id);
      if (!rec) return null;
      rec.status = status;
      if (status === 'claimed') rec.claimedAt = at;
      if (status === 'released') rec.releasedAt = at;
      return rec;
    }),
    ...overrides.repo,
  };
  const taskExists = overrides.taskExists ?? (() => true);
  return { service: new TaskClaimService({ claimRepo: repo, taskExists }), repo };
}

function makeInput(overrides: Partial<ClaimTaskInput> = {}): ClaimTaskInput {
  return {
    taskId: 'task-1',
    agentRef: 'agent:dev-1',
    reason: 'match responsibility dev',
    ...overrides,
  };
}

describe('TaskClaimService.claim', () => {
  it('任务存在 + 未认领 → claim 写入且状态 claimed', () => {
    const { service, repo } = makeService();
    const result = service.claim(makeInput());
    expect(result.status).toBe('claimed');
    expect(result.claimedAt).not.toBeNull();
    expect(repo.insert).toHaveBeenCalledTimes(1);
  });

  it('任务不存在 → throw 且不写 claim', () => {
    const { service, repo } = makeService({ taskExists: () => false });
    expect(() => service.claim(makeInput())).toThrow(/task/i);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('同一任务已被认领 → throw 重复认领', () => {
    const repo: Partial<ITaskClaimRepository> = {
      getByTaskId: vi.fn().mockReturnValue(makeRecord({ status: 'claimed' })),
    };
    const { service } = makeService({ repo });
    expect(() => service.claim(makeInput())).toThrow(/already claimed|重复|claim/i);
  });

  it('同一任务有 released 旧记录 → 允许重新认领 (覆盖旧记录)', () => {
    const repo: Partial<ITaskClaimRepository> = {
      getByTaskId: vi.fn().mockReturnValue(makeRecord({ status: 'released' })),
    };
    const { service } = makeService({ repo });
    const result = service.claim(makeInput());
    expect(result.status).toBe('claimed');
  });
});

describe('TaskClaimService.release', () => {
  it('claimed → released (agent 主动释放)', () => {
    const repo: Partial<ITaskClaimRepository> = {
      getById: vi.fn().mockReturnValue(makeRecord({ status: 'claimed', claimedAt: NOW })),
      updateStatus: vi.fn().mockReturnValue(makeRecord({ status: 'released', releasedAt: NOW })),
    };
    const { service } = makeService({ repo });
    const result = service.release('claim-1', 'agent:dev-1');
    expect(result.status).toBe('released');
    expect(result.releasedAt).toBe(NOW);
  });

  it('释放者不是认领者 → throw', () => {
    const repo: Partial<ITaskClaimRepository> = {
      getById: vi.fn().mockReturnValue(makeRecord({ status: 'claimed', claimedAt: NOW, agentRef: 'agent:other' })),
    };
    const { service } = makeService({ repo });
    expect(() => service.release('claim-1', 'agent:dev-1')).toThrow(/owner|agent|claim/i);
  });

  it('claim 不存在 → throw', () => {
    const { service } = makeService();
    expect(() => service.release('nope', 'agent:dev-1')).toThrow(/not found|claim/i);
  });
});

describe('TaskClaimService.expire', () => {
  it('过期未执行 → expired (认领超时释放)', () => {
    const repo: Partial<ITaskClaimRepository> = {
      getById: vi.fn().mockReturnValue(makeRecord({ status: 'claimed', claimedAt: NOW, expiresAt: '2026-08-29T00:00:00.000Z' })),
      updateStatus: vi.fn().mockReturnValue(makeRecord({ status: 'expired', releasedAt: NOW })),
    };
    const { service } = makeService({ repo });
    const result = service.expire('claim-1', '2026-08-30T00:00:00.000Z');
    expect(result.status).toBe('expired');
  });

  it('未过期 → 不释放 (返回原记录)', () => {
    const rec = makeRecord({ status: 'claimed', claimedAt: NOW, expiresAt: '2026-08-31T00:00:00.000Z' });
    const repo: Partial<ITaskClaimRepository> = {
      getById: vi.fn().mockReturnValue(rec),
      updateStatus: vi.fn(),
    };
    const { service } = makeService({ repo });
    const result = service.expire('claim-1', '2026-08-30T00:00:00.000Z');
    expect(result.status).toBe('claimed');
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });
});
