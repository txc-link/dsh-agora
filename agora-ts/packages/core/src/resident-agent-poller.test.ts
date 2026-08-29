/**
 * resident-agent-poller.test.ts — org-aware-work-os S2 (TDD red → green)
 *
 * ResidentAgentPoller: 定时轮询任务台 → 对每个常驻 agent 用 matcher
 * 找匹配任务 → 自动认领 (claim)。可手动触发 pollOnce。
 * 纯 Core 编排, 无平台名 (§1)。
 */

import { describe, expect, it, vi } from 'vitest';
import type { TaskSkillPolicyDto } from '@agora-ts/contracts';
import { ResidentAgentPoller, type PollerAgent, type PollerDeps } from './resident-agent-poller.js';
import type { ClaimMatcherTask } from './task-claim-matcher.js';

function makeTask(overrides: Partial<ClaimMatcherTask> = {}): ClaimMatcherTask {
  return {
    taskId: 'task-1',
    taskType: 'dev',
    skillPolicy: { global_refs: ['typescript'], role_refs: {}, enforcement: 'required' } as TaskSkillPolicyDto,
    ...overrides,
  };
}

function makeAgent(overrides: Partial<PollerAgent> = {}): PollerAgent {
  return {
    agentRef: 'agent:dev-1',
    roleId: 'role-dev',
    skillsRef: ['typescript'],
    pollIntervalMs: 60_000,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<PollerDeps> = {}): PollerDeps {
  const claims: Record<string, { taskId: string; agentRef: string; status: string }> = {};
  const base: PollerDeps = {
    listClaimableTasks: vi.fn(() => []),
    isTaskClaimed: vi.fn((taskId) => claims[taskId]?.status === 'claimed'),
    claim: vi.fn((taskId, agentRef) => {
      claims[taskId] = { taskId, agentRef, status: 'claimed' };
      return { ok: true as const };
    }),
    ...overrides,
  };
  return base;
}

describe('ResidentAgentPoller.pollOnce', () => {
  it('无匹配任务 → 不 claim', () => {
    const deps = makeDeps({ listClaimableTasks: vi.fn(() => []) });
    const poller = new ResidentAgentPoller([makeAgent()], deps);
    const result = poller.pollOnce();
    expect(result.claims.length).toBe(0);
    expect(result.scanned).toBe(0);
  });

  it('匹配任务 → 自动认领', () => {
    const tasks = [makeTask()];
    const deps = makeDeps({
      listClaimableTasks: vi.fn(() => tasks),
      claim: vi.fn((taskId, agentRef) => {
        expect(taskId).toBe('task-1');
        expect(agentRef).toBe('agent:dev-1');
        return { ok: true as const };
      }),
    });
    const poller = new ResidentAgentPoller([makeAgent()], deps);
    const result = poller.pollOnce();
    expect(result.scanned).toBe(1);
    expect(result.claims.length).toBe(1);
    expect(result.claims[0].taskId).toBe('task-1');
    expect(result.claims[0].agentRef).toBe('agent:dev-1');
  });

  it('不匹配 (缺技能) → 不 claim', () => {
    const tasks = [makeTask()];
    const deps = makeDeps({
      listClaimableTasks: vi.fn(() => tasks),
      claim: vi.fn(),
    });
    const poller = new ResidentAgentPoller([makeAgent({ skillsRef: ['python'] })], deps);
    const result = poller.pollOnce();
    expect(result.claims.length).toBe(0);
    expect(deps.claim).not.toHaveBeenCalled();
  });

  it('已认领任务 → 跳过 (不重复认领)', () => {
    const tasks = [makeTask()];
    const deps = makeDeps({
      listClaimableTasks: vi.fn(() => tasks),
      isTaskClaimed: vi.fn(() => true),
      claim: vi.fn(),
    });
    const poller = new ResidentAgentPoller([makeAgent()], deps);
    const result = poller.pollOnce();
    expect(result.claims.length).toBe(0);
    expect(result.skippedClaimed).toBe(1);
    expect(deps.claim).not.toHaveBeenCalled();
  });

  it('多 agent + 多任务 → 各自认领匹配的', () => {
    const devTask = makeTask({ id: 'task-1', type: 'dev' });
    const opsTask = makeTask({ taskId: 'task-2', taskType: 'ops', skillPolicy: { global_refs: ['docker'], role_refs: {}, enforcement: 'required' } as TaskSkillPolicyDto });
    const deps = makeDeps({ listClaimableTasks: vi.fn(() => [devTask, opsTask]) });
    const poller = new ResidentAgentPoller(
      [
        makeAgent({ agentRef: 'agent:dev-1', skillsRef: ['typescript'] }),
        makeAgent({ agentRef: 'agent:ops-1', roleId: 'role-ops', skillsRef: ['docker'] }),
      ],
      deps,
    );
    const result = poller.pollOnce();
    expect(result.claims.length).toBe(2);
    const byTask = Object.fromEntries(result.claims.map((c) => [c.taskId, c.agentRef]));
    expect(byTask['task-1']).toBe('agent:dev-1');
    expect(byTask['task-2']).toBe('agent:ops-1');
  });

  it('每任务最多一个 agent 认领 (先到先得)', () => {
    const tasks = [makeTask()];
    let claimed = false;
    const deps = makeDeps({
      listClaimableTasks: vi.fn(() => tasks),
      isTaskClaimed: vi.fn(() => claimed),
      claim: vi.fn(() => {
        claimed = true;
        return { ok: true as const };
      }),
    });
    const poller = new ResidentAgentPoller(
      [makeAgent({ agentRef: 'agent:dev-1' }), makeAgent({ agentRef: 'agent:dev-2' })],
      deps,
    );
    const result = poller.pollOnce();
    expect(result.claims.length).toBe(1);
  });
});

describe('ResidentAgentPoller.start/stop', () => {
  it('start 定时轮询, stop 停止 (用假 timer)', () => {
    vi.useFakeTimers();
    const deps = makeDeps();
    const poller = new ResidentAgentPoller([makeAgent({ pollIntervalMs: 1000 })], deps);
    const pollOnceSpy = vi.spyOn(poller, 'pollOnce');
    poller.start();
    vi.advanceTimersByTime(3000);
    expect(pollOnceSpy).toHaveBeenCalledTimes(3);
    poller.stop();
    vi.advanceTimersByTime(2000);
    expect(pollOnceSpy).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe('ResidentAgentPoller.pollOnce + expireStale', () => {
  it('每轮先执行 expireStale 扫描 (过期认领先释放再匹配)', () => {
    const expireStale = vi.fn(() => 2);
    const deps = makeDeps({ expireStale });
    const poller = new ResidentAgentPoller([makeAgent()], deps);
    poller.pollOnce();
    expect(expireStale).toHaveBeenCalledTimes(1);
  });

  it('未注入 expireStale 也可轮询 (可选依赖)', () => {
    const deps = makeDeps({});
    const poller = new ResidentAgentPoller([makeAgent()], deps);
    const result = poller.pollOnce();
    expect(result.scanned).toBe(0);
  });
});
