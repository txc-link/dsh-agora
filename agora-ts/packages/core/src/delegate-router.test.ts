import { describe, expect, it, vi } from 'vitest';
import { DelegateRouter } from './delegate-router.js';
import { OrgHierarchyResolver } from './org-hierarchy-resolver.js';
import type { ITeamRepository, TeamInsertInput, TeamRecord } from '@agora-ts/contracts';

type Notify = { targetRef: string; event: string; data: Record<string, unknown> };

function makeRepo(): ITeamRepository {
  const rows = new Map<string, TeamRecord>();
  let counter = 0;
  return {
    insert(input: TeamInsertInput): TeamRecord {
      const id = input.id ?? `team-${++counter}`;
      const rec: TeamRecord = {
        id,
        project_id: input.project_id,
        name: input.name,
        lead: input.lead,
        members: input.members ?? [input.lead],
        responsibilities: input.responsibilities ?? [],
        parent_id: input.parent_id ?? null,
        created_at: '2026-08-30T00:00:00.000Z',
        metadata: null,
      };
      rows.set(id, rec);
      return rec;
    },
    getById: (id) => rows.get(id) ?? null,
    getByName: (p, n) => [...rows.values()].find((t) => t.project_id === p && t.name === n) ?? null,
    listByProject: (p) => [...rows.values()].filter((t) => t.project_id === p),
    listByMember: (a) => [...rows.values()].filter((t) => t.members.includes(a)),
    update: () => null,
    delete: () => false,
  };
}

/** org → dev(lead dl, w1) → impl(lead il) */
function makeOrg() {
  const repo = makeRepo();
  const root = repo.insert({ id: 't-root', project_id: 'p1', name: 'org', lead: 'agent:root', members: ['agent:root'] });
  const dev = repo.insert({ id: 't-dev', project_id: 'p1', name: 'dev', lead: 'agent:dl', members: ['agent:dl', 'agent:w1'], parent_id: 't-root' });
  repo.insert({ id: 't-impl', project_id: 'p1', name: 'impl', lead: 'agent:il', members: ['agent:il'], parent_id: 't-dev' });
  const resolver = new OrgHierarchyResolver({ teamRepo: repo });
  return { repo, root, dev, resolver };
}

describe('DelegateRouter.delegateSubtree', () => {
  it('子树全员通知 (排除 fromRef), 事件 task_delegated', () => {
    const { repo, dev, resolver } = makeOrg();
    const notifications: Notify[] = [];
    const router = new DelegateRouter({
      teamRepo: repo,
      resolver,
      notify: (targetRef, payload) => notifications.push({ targetRef, event: payload.event_type, data: payload.data }),
    });
    const result = router.delegateSubtree({ teamId: dev.id, taskId: 'OC-1', fromRef: 'agent:w1' });
    expect(result.ok).toBe(true);
    expect(result.data?.recipients).toEqual(['agent:dl', 'agent:il']);
    expect(result.data?.notified).toBe(2);
    expect(result.data?.depth).toBe(2);
    expect(notifications[0]).toMatchObject({ targetRef: 'agent:dl', event: 'task_delegated' });
    expect(notifications[0].data.task_id).toBe('OC-1');
  });

  it('深度超限被拒 (maxDepth=2, 链长 3)', () => {
    const { repo, resolver } = makeOrg();
    const router = new DelegateRouter({ teamRepo: repo, resolver, maxDepth: 2 });
    const result = router.delegateSubtree({ teamId: 't-impl', taskId: 'OC-1' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('exceeds limit 2');
  });

  it('环检测: parent 链成环 → 拒绝 (非静默截断)', () => {
    const { repo, dev, resolver } = makeOrg();
    // root.parent = impl → root→impl→dev→root 环
    (repo.getById('t-root') as TeamRecord).parent_id = 't-impl';
    const router = new DelegateRouter({ teamRepo: repo, resolver });
    const result = router.delegateSubtree({ teamId: dev.id, taskId: 'OC-1' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('cycle');
  });

  it('team 不存在被拒', () => {
    const { repo, resolver } = makeOrg();
    const router = new DelegateRouter({ teamRepo: repo, resolver });
    expect(router.delegateSubtree({ teamId: 'nope', taskId: 'x' }).ok).toBe(false);
  });

  it('未注入 notify 也成功 (仅路由解析)', () => {
    const { repo, dev, resolver } = makeOrg();
    const router = new DelegateRouter({ teamRepo: repo, resolver });
    const result = router.delegateSubtree({ teamId: dev.id, taskId: 'OC-2' });
    expect(result.ok).toBe(true);
    expect(result.data?.notified).toBe(0);
  });
});

describe('DelegateRouter.escalateUp', () => {
  it('上报链第一个 lead; 事件 task_escalated', () => {
    const { repo, resolver } = makeOrg();
    const notifications: Notify[] = [];
    const router = new DelegateRouter({
      teamRepo: repo,
      resolver,
      notify: (targetRef, payload) => notifications.push({ targetRef, event: payload.event_type, data: payload.data }),
    });
    const result = router.escalateUp({ agentRef: 'agent:w1', taskId: 'OC-3' });
    expect(result.ok).toBe(true);
    expect(result.data?.routedTo).toBe('agent:dl');
    expect(result.data?.chain).toEqual(['agent:dl', 'agent:root']);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ targetRef: 'agent:dl', event: 'task_escalated' });
  });

  it('无 team 归属 → 拒绝', () => {
    const { repo, resolver } = makeOrg();
    const router = new DelegateRouter({ teamRepo: repo, resolver });
    const result = router.escalateUp({ agentRef: 'agent:lonely' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no lead above');
  });
});
