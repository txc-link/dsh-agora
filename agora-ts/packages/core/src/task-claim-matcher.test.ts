/**
 * task-claim-matcher.test.ts — org-aware-work-os S2 (TDD red → green)
 *
 * 职责匹配: agent(role + skills_ref) ↔ task(type + skill_policy)。
 * enforcement=required → 必须全满足; advisory → 部分满足即可。
 * 纯 Core 匹配函数, 无平台名 (§1)。
 */

import { describe, expect, it } from 'vitest';
import {
  matchTaskToAgent,
  type ClaimMatcherAgent,
  type ClaimMatcherTask,
} from './task-claim-matcher.js';

function makeAgent(overrides: Partial<ClaimMatcherAgent> = {}): ClaimMatcherAgent {
  return {
    agentRef: 'agent:dev-1',
    roleId: 'role-dev',
    skillsRef: ['typescript', 'node'],
    ...overrides,
  };
}

function makeTask(overrides: Partial<ClaimMatcherTask> = {}): ClaimMatcherTask {
  return {
    taskId: 'task-1',
    taskType: 'dev',
    skillPolicy: {
      global_refs: ['typescript'],
      role_refs: {},
      enforcement: 'required',
    },
    ...overrides,
  };
}

describe('matchTaskToAgent — global_refs (required)', () => {
  it('agent 技能全满足 global_refs → match (score = 命中数)', () => {
    const result = matchTaskToAgent(makeTask(), makeAgent());
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.missingSkills).toEqual([]);
  });

  it('agent 缺技能 → not matched (enforcement=required)', () => {
    const result = matchTaskToAgent(makeTask(), makeAgent({ skillsRef: ['python'] }));
    expect(result.matched).toBe(false);
    expect(result.missingSkills).toContain('typescript');
  });

  it('global_refs 为空 → matched (无全局技能要求)', () => {
    const result = matchTaskToAgent(
      makeTask({ skillPolicy: { global_refs: [], role_refs: {}, enforcement: 'required' } }),
      makeAgent(),
    );
    expect(result.matched).toBe(true);
  });
});

describe('matchTaskToAgent — global_refs (advisory)', () => {
  it('advisory + 部分满足 → matched', () => {
    const result = matchTaskToAgent(
      makeTask({ skillPolicy: { global_refs: ['typescript', 'react'], role_refs: {}, enforcement: 'advisory' } }),
      makeAgent({ skillsRef: ['typescript'] }),
    );
    expect(result.matched).toBe(true);
  });

  it('advisory + 全不满足 → not matched (0 命中)', () => {
    const result = matchTaskToAgent(
      makeTask({ skillPolicy: { global_refs: ['react', 'vue'], role_refs: {}, enforcement: 'advisory' } }),
      makeAgent({ skillsRef: ['python'] }),
    );
    expect(result.matched).toBe(false);
  });
});

describe('matchTaskToAgent — role_refs', () => {
  it('agent 角色命中 role_refs 且满足技能 → matched', () => {
    const task = makeTask({
      skillPolicy: {
        global_refs: [],
        role_refs: { 'role-dev': ['typescript'] },
        enforcement: 'required',
      },
    });
    const result = matchTaskToAgent(task, makeAgent());
    expect(result.matched).toBe(true);
    expect(result.roleMatched).toBe(true);
  });

  it('agent 角色不在 role_refs → matched (角色非强制, 只看 global)', () => {
    const task = makeTask({
      skillPolicy: {
        global_refs: ['typescript'],
        role_refs: { 'role-other': ['java'] },
        enforcement: 'required',
      },
    });
    const result = matchTaskToAgent(task, makeAgent({ roleId: 'role-dev' }));
    expect(result.matched).toBe(true);
  });

  it('角色命中但缺技能 → not matched (required)', () => {
    const task = makeTask({
      skillPolicy: {
        global_refs: [],
        role_refs: { 'role-dev': ['typescript'] },
        enforcement: 'required',
      },
    });
    const result = matchTaskToAgent(task, makeAgent({ skillsRef: ['python'] }));
    expect(result.matched).toBe(false);
  });
});

describe('matchTaskToAgent — 无 skill_policy', () => {
  it('无 skill_policy → matched (无技能要求, 任务类型即职责)', () => {
    const result = matchTaskToAgent(makeTask({ skillPolicy: null }), makeAgent());
    expect(result.matched).toBe(true);
    expect(result.score).toBe(1);
  });
});
