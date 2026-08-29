import { describe, expect, it } from 'vitest';
import { TeamService } from './team-service.js';
import { OrgHierarchyResolver } from './org-hierarchy-resolver.js';
import type { ITeamRepository, TeamInsertInput, TeamRecord } from '@agora-ts/contracts';

function makeRepo(): ITeamRepository & { _rows: Map<string, TeamRecord> } {
  const rows = new Map<string, TeamRecord>();
  let counter = 0;
  return {
    _rows: rows,
    insert(input: TeamInsertInput): TeamRecord {
      const id = input.id ?? `team-${++counter}`;
      if (rows.has(id)) throw new Error('UNIQUE constraint failed');
      for (const existing of rows.values()) {
        if (existing.project_id === input.project_id && existing.name === input.name) {
          throw new Error('UNIQUE constraint failed: org_teams.project_name');
        }
      }
      const rec: TeamRecord = {
        id,
        project_id: input.project_id,
        name: input.name,
        lead: input.lead,
        members: input.members ?? [input.lead],
        responsibilities: input.responsibilities ?? [],
        parent_id: input.parent_id ?? null,
        created_at: '2026-08-30T00:00:00.000Z',
        metadata: input.metadata ?? null,
      };
      rows.set(id, rec);
      return rec;
    },
    getById: (id) => rows.get(id) ?? null,
    getByName: (projectId, name) =>
      [...rows.values()].find((t) => t.project_id === projectId && t.name === name) ?? null,
    listByProject: (projectId) =>
      [...rows.values()].filter((t) => t.project_id === projectId).sort((a, b) => a.id.localeCompare(b.id)),
    listByMember: (agentRef) => [...rows.values()].filter((t) => t.members.includes(agentRef)),
    update: (id, patch) => {
      const rec = rows.get(id);
      if (!rec) return null;
      const next: TeamRecord = {
        ...rec,
        lead: patch.lead ?? rec.lead,
        members: patch.members ?? rec.members,
        responsibilities: patch.responsibilities ?? rec.responsibilities,
        parent_id: patch.parent_id !== undefined ? patch.parent_id : rec.parent_id,
      };
      rows.set(id, next);
      return next;
    },
    delete: (id) => rows.delete(id),
  };
}

function makeTeam(repo: ITeamRepository, name: string, opts: Partial<TeamInsertInput> = {}): TeamRecord {
  return repo.insert({ project_id: 'p1', name, lead: `agent:lead-${name}`, ...opts });
}

describe('TeamService.createTeam', () => {
  it('合法创建: lead 默认入 members', () => {
    const repo = makeRepo();
    const service = new TeamService({ teamRepo: repo });
    const result = service.createTeam({ projectId: 'p1', name: 'dev', lead: 'agent:l1' });
    expect(result.ok).toBe(true);
    expect(result.data?.members).toEqual(['agent:l1']);
  });

  it('lead 不在 members 被拒', () => {
    const service = new TeamService({ teamRepo: makeRepo() });
    const result = service.createTeam({ projectId: 'p1', name: 'dev', lead: 'agent:l1', members: ['agent:x'] });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('must be a member');
  });

  it('同项目同名被拒; 跨项目同名允许', () => {
    const repo = makeRepo();
    const service = new TeamService({ teamRepo: repo });
    expect(service.createTeam({ projectId: 'p1', name: 'dev', lead: 'agent:a' }).ok).toBe(true);
    expect(service.createTeam({ projectId: 'p1', name: 'dev', lead: 'agent:b' }).ok).toBe(false);
    expect(service.createTeam({ projectId: 'p2', name: 'dev', lead: 'agent:c' }).ok).toBe(true);
  });

  it('parent 跨项目被拒', () => {
    const repo = makeRepo();
    const service = new TeamService({ teamRepo: repo });
    const other = service.createTeam({ projectId: 'p2', name: 'org', lead: 'agent:x' });
    const result = service.createTeam({
      projectId: 'p1', name: 'dev', lead: 'agent:a',
      parentId: other.data?.id,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("belongs to project 'p2'");
  });
});

describe('TeamService membership + parent cycle', () => {
  it('addMember/removeMember; lead 不可移除', () => {
    const repo = makeRepo();
    const service = new TeamService({ teamRepo: repo });
    const team = (service.createTeam({ projectId: 'p1', name: 'dev', lead: 'agent:l1' }).data) as TeamRecord;
    service.addMember(team.id, 'agent:w1');
    expect(service.get(team.id)?.members).toEqual(['agent:l1', 'agent:w1']);
    const removed = service.removeMember(team.id, 'agent:w1');
    expect(removed.ok).toBe(true);
    const leadRemove = service.removeMember(team.id, 'agent:l1');
    expect(leadRemove.ok).toBe(false);
    expect(leadRemove.error).toContain('cannot remove lead');
  });

  it('setLead 自动补成员; setParent 环被拒', () => {
    const repo = makeRepo();
    const service = new TeamService({ teamRepo: repo });
    const root = (service.createTeam({ projectId: 'p1', name: 'org', lead: 'agent:root' }).data) as TeamRecord;
    const dev = (service.createTeam({ projectId: 'p1', name: 'dev', lead: 'agent:dl', parentId: root.id }).data) as TeamRecord;
    const worker = (service.createTeam({ projectId: 'p1', name: 'impl', lead: 'agent:wl', parentId: dev.id }).data) as TeamRecord;

    // root 挂到 impl 之下 → 环
    const cycle = service.setParent(root.id, worker.id);
    expect(cycle.ok).toBe(false);
    expect(cycle.error).toContain('cycle');

    // dev 挂到自己子树 (worker) → 成环被拒
    expect(service.setParent(dev.id, null).ok).toBe(true);
    expect(service.setParent(dev.id, worker.id).ok).toBe(false);
    // worker 重挂到 root (不在 worker 链上) → 合法
    expect(service.setParent(worker.id, root.id).ok).toBe(true);
    expect(repo.getById(worker.id)?.parent_id).toBe(root.id);

    // setLead 自动补成员
    const newLead = service.setLead(dev.id, 'agent:newbie');
    expect(newLead.ok).toBe(true);
    expect(newLead.data?.members).toContain('agent:newbie');
  });

  it('deleteTeam: 有子团队被拒; 无子团队可删', () => {
    const repo = makeRepo();
    const service = new TeamService({ teamRepo: repo });
    const root = (service.createTeam({ projectId: 'p1', name: 'org', lead: 'agent:root' }).data) as TeamRecord;
    const dev = (service.createTeam({ projectId: 'p1', name: 'dev', lead: 'agent:dl', parentId: root.id }).data) as TeamRecord;
    const blocked = service.deleteTeam(root.id);
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toContain('child team');
    expect(service.deleteTeam(dev.id).ok).toBe(true);
    expect(service.deleteTeam(root.id).ok).toBe(true);
  });
});

describe('OrgHierarchyResolver', () => {
  it('chainToRoot / leadsAbove / subtreeAgents / orgTree', () => {
    const repo = makeRepo();
    const service = new TeamService({ teamRepo: repo });
    const root = (service.createTeam({ projectId: 'p1', name: 'org', lead: 'agent:root', members: ['agent:root'] }).data) as TeamRecord;
    const dev = (service.createTeam({ projectId: 'p1', name: 'dev', lead: 'agent:dl', parentId: root.id, members: ['agent:dl', 'agent:w1'] }).data) as TeamRecord;
    const impl = (service.createTeam({ projectId: 'p1', name: 'impl', lead: 'agent:il', parentId: dev.id, members: ['agent:il'] }).data) as TeamRecord;

    const resolver = new OrgHierarchyResolver({ teamRepo: repo });
    // worker 在 dev: 链 = dev → org
    expect(resolver.leadsAbove('agent:w1')).toEqual(['agent:dl', 'agent:root']);
    // lead 自身不报自己
    expect(resolver.leadsAbove('agent:dl')).toEqual(['agent:root']);
    // impl 子树 = il + dev 链
    expect(resolver.subtreeAgents(impl.id)).toEqual(['agent:il']);
    expect(resolver.subtreeAgents(dev.id)).toEqual(['agent:dl', 'agent:w1', 'agent:il']);
    // 树: root → dev → impl
    const tree = resolver.orgTree('p1');
    expect(tree).toHaveLength(1);
    expect(tree[0].team.id).toBe(root.id);
    expect(tree[0].children[0].team.id).toBe(dev.id);
    expect(tree[0].children[0].children[0].team.id).toBe(impl.id);
  });
});
