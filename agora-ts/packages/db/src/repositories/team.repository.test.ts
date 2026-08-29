/**
 * team.repository.test.ts — org-aware-work-os S1 team 存储 (TDD).
 *
 * Verifies migration 038 (org_teams) + TeamRepository CRUD:
 *   insert/getByName/listByProject/listByMember/update/delete
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgoraDatabase, runMigrations, TeamRepository } from '../index.js';

const tempPaths: string[] = [];

function freshRepo(): { repo: TeamRepository; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'agora-ts-teams-'));
  tempPaths.push(dir);
  const db = createAgoraDatabase({ dbPath: join(dir, 'teams.db') });
  runMigrations(db);
  return { repo: new TeamRepository(db), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

afterEach(() => {
  while (tempPaths.length) {
    const dir = tempPaths.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('TeamRepository', () => {
  it('insert + getById: members/responsibilities JSON 往返', () => {
    const { repo, cleanup } = freshRepo();
    const team = repo.insert({
      project_id: 'p1', name: 'dev', lead: 'agent:lead-1',
      members: ['agent:lead-1', 'agent:dev-1'],
      responsibilities: ['dev'],
    });
    expect(team.id).toBeTruthy();
    const loaded = repo.getById(team.id);
    expect(loaded?.members).toEqual(['agent:lead-1', 'agent:dev-1']);
    expect(loaded?.responsibilities).toEqual(['dev']);
    expect(loaded?.parent_id).toBeNull();
    cleanup();
  });

  it('getByName 按 project 隔离; 同名冲突拒绝', () => {
    const { repo, cleanup } = freshRepo();
    repo.insert({ project_id: 'p1', name: 'dev', lead: 'agent:a' });
    repo.insert({ project_id: 'p2', name: 'dev', lead: 'agent:b' });
    expect(repo.getByName('p1', 'dev')?.lead).toBe('agent:a');
    expect(repo.getByName('p2', 'dev')?.lead).toBe('agent:b');
    expect(() => repo.insert({ project_id: 'p1', name: 'dev', lead: 'agent:c' })).toThrow();
    cleanup();
  });

  it('listByMember 跨项目检索成员所在 team', () => {
    const { repo, cleanup } = freshRepo();
    repo.insert({ project_id: 'p1', name: 'dev', lead: 'agent:a', members: ['agent:a', 'agent:w1'] });
    repo.insert({ project_id: 'p2', name: 'ops', lead: 'agent:b', members: ['agent:b'] });
    const mine = repo.listByMember('agent:w1');
    expect(mine).toHaveLength(1);
    expect(mine[0].name).toBe('dev');
    cleanup();
  });

  it('update: 改 lead/members/responsibilities/parent_id', () => {
    const { repo, cleanup } = freshRepo();
    const parent = repo.insert({ project_id: 'p1', name: 'org', lead: 'agent:root' });
    const team = repo.insert({ project_id: 'p1', name: 'dev', lead: 'agent:a', members: ['agent:a'] });
    const updated = repo.update(team.id, {
      lead: 'agent:l2', members: ['agent:l2', 'agent:w1'], responsibilities: ['dev', 'review'], parent_id: parent.id,
    });
    expect(updated?.lead).toBe('agent:l2');
    expect(updated?.members).toEqual(['agent:l2', 'agent:w1']);
    expect(updated?.responsibilities).toEqual(['dev', 'review']);
    expect(updated?.parent_id).toBe(parent.id);
    // parent_id 可清回 null (显式 patch)
    const cleared = repo.update(team.id, { parent_id: null });
    expect(cleared?.parent_id).toBeNull();
    expect(repo.update('no-such', { lead: 'x' })).toBeNull();
    cleanup();
  });

  it('delete 删除且不可再取', () => {
    const { repo, cleanup } = freshRepo();
    const team = repo.insert({ project_id: 'p1', name: 'dev', lead: 'agent:a' });
    expect(repo.delete(team.id)).toBe(true);
    expect(repo.getById(team.id)).toBeNull();
    expect(repo.delete(team.id)).toBe(false);
    cleanup();
  });
});
