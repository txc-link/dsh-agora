/**
 * task-claim-command.test.ts — org-aware-work-os S2 CLI runner (TDD)
 *
 * runTaskClaimCommand: claim | release | list | claimable. Plain JSON out.
 */

import { describe, expect, it, vi } from 'vitest';
import type { ITaskClaimRepository, ITaskRepository, TaskClaimRecord } from '@agora-ts/contracts';
import { TaskClaimService } from './task-claim-service.js';
import { runTaskClaimCommand } from './task-claim-command.js';

function makeClaim(overrides: Partial<TaskClaimRecord> = {}): TaskClaimRecord {
  return {
    id: 'claim-1',
    taskId: 'task-1',
    agentRef: 'agent:dev-1',
    status: 'claimed',
    claimedAt: '2026-08-30T00:00:00.000Z',
    releasedAt: null,
    expiresAt: null,
    reason: null,
    createdAt: '2026-08-30T00:00:00.000Z',
    metadata: null,
    ...overrides,
  };
}

function makeDeps(overrides: {
  claims?: TaskClaimRecord[];
  tasks?: { id: string; title: string; type: string; skill_policy: unknown; state: string }[];
} = {}) {
  const claims = overrides.claims ?? [];
  const tasks = overrides.tasks ?? [];
  const claimRepo: ITaskClaimRepository = {
    insert: vi.fn((input) => makeClaim({ taskId: input.taskId, agentRef: input.agentRef, status: 'pending' })),
    getById: vi.fn((id) => claims.find((c) => c.id === id) ?? null),
    getByTaskId: vi.fn((taskId) => claims.find((c) => c.taskId === taskId) ?? null),
    listByAgent: vi.fn((agentRef) => claims.filter((c) => c.agentRef === agentRef)),
    listPending: vi.fn(() => claims.filter((c) => c.status === 'pending')),
    listClaimed: vi.fn(() => claims.filter((c) => c.status === 'claimed')),
    updateStatus: vi.fn((id, status) => {
      const rec = claims.find((c) => c.id === id);
      if (!rec) return null;
      rec.status = status;
      return rec;
    }),
  };
  const taskRepo = {
    getTask: vi.fn((taskId: string) => tasks.find((t) => t.id === taskId) ?? null),
    listTasks: vi.fn((state?: string) => tasks.filter((t) => !state || t.state === state)),
  } as unknown as ITaskRepository;
  const claimService = new TaskClaimService({
    claimRepo,
    taskExists: (taskId) => tasks.some((t) => t.id === taskId),
  });
  return { deps: { claimService, claimRepo, taskRepo }, claimRepo };
}

describe('runTaskClaimCommand', () => {
  it('claim: 缺 --task → error', async () => {
    const { deps } = makeDeps();
    const result = await runTaskClaimCommand(deps, { subcommand: 'claim', agentRef: 'agent:dev-1' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('--task');
  });

  it('claim: 成功认领', async () => {
    const { deps } = makeDeps({ tasks: [{ id: 'task-1', title: 't', type: 'dev', skill_policy: null, state: 'created' }] });
    const result = await runTaskClaimCommand(deps, { subcommand: 'claim', taskId: 'task-1', agentRef: 'agent:dev-1' });
    expect(result.ok).toBe(true);
  });

  it('claim: 任务不存在 → error', async () => {
    const { deps } = makeDeps();
    const result = await runTaskClaimCommand(deps, { subcommand: 'claim', taskId: 'nope', agentRef: 'agent:dev-1' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('release: 成功释放', async () => {
    const { deps } = makeDeps({ claims: [makeClaim()] });
    const result = await runTaskClaimCommand(deps, { subcommand: 'release', claimId: 'claim-1', agentRef: 'agent:dev-1' });
    expect(result.ok).toBe(true);
  });

  it('list: --agent 过滤', async () => {
    const { deps } = makeDeps({ claims: [makeClaim(), makeClaim({ id: 'claim-2', agentRef: 'agent:other', taskId: 'task-2' })] });
    const result = await runTaskClaimCommand(deps, { subcommand: 'list', listAgent: 'agent:dev-1' });
    expect(result.ok).toBe(true);
    expect((result.data as { claims: unknown[] }).claims.length).toBe(1);
  });

  it('claimable: 匹配 created+active 任务, 排除已认领与不可工作状态', async () => {
    const { deps } = makeDeps({
      claims: [makeClaim({ taskId: 'task-2' })],
      tasks: [
        { id: 'task-1', title: 'dev task', type: 'dev', skill_policy: { global_refs: ['typescript'], role_refs: {}, enforcement: 'required' }, state: 'created' },
        { id: 'task-2', title: 'claimed task', type: 'dev', skill_policy: null, state: 'active' },
        { id: 'task-3', title: 'active task', type: 'dev', skill_policy: null, state: 'active' },
        { id: 'task-4', title: 'done task', type: 'dev', skill_policy: null, state: 'done' },
      ],
    });
    const result = await runTaskClaimCommand(deps, {
      subcommand: 'claimable', matchAgentRef: 'agent:dev-1', matchRoleId: 'role-dev', matchSkills: 'typescript',
    });
    expect(result.ok).toBe(true);
    const data = result.data as { claimable: { task_id: string }[]; count: number };
    expect(data.count).toBe(2);
    expect(data.claimable.map((c) => c.task_id).sort()).toEqual(['task-1', 'task-3']);
  });

  it('claimable: 缺 --role → error', async () => {
    const { deps } = makeDeps();
    const result = await runTaskClaimCommand(deps, { subcommand: 'claimable' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('--role');
  });
});
