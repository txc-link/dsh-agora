import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAgoraDatabase, runMigrations } from '../database.js';
import { TaskRepository } from './task.repository.js';
import { ApprovalRequestRepository } from './approval-request.repository.js';

const tempPaths: string[] = [];

function makeDbPath() {
  const dir = mkdtempSync(join(tmpdir(), 'agora-ts-approval-request-'));
  tempPaths.push(dir);
  return join(dir, 'tasks.db');
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('approval request repository', () => {
  it('throws a descriptive error when the inserted request cannot be reloaded', () => {
    const db = createAgoraDatabase({ dbPath: makeDbPath() });
    runMigrations(db);
    const tasks = new TaskRepository(db);
    tasks.insertTask({
      id: 'OC-1',
      title: 'approval guard',
      description: '',
      type: 'document',
      priority: 'normal',
      creator: 'archon',
      team: { members: [] },
      workflow: { stages: [] },
    });
    const repository = new ApprovalRequestRepository(db);
    const getById = vi.spyOn(repository, 'getById');

    getById.mockReturnValueOnce(null);

    expect(() => repository.insert({
      id: 'approval-1',
      task_id: 'OC-1',
      stage_id: 'review',
      gate_type: 'archon_review',
      requested_by: 'archon',
    })).toThrow(/failed to retrieve approval request approval-1 after insert/i);
  });

  it('getById returns the stored request by id and null for missing ids', () => {
    const db = createAgoraDatabase({ dbPath: makeDbPath() });
    runMigrations(db);
    const tasks = new TaskRepository(db);
    tasks.insertTask({
      id: 'OC-G-1',
      title: 'getById',
      description: '',
      type: 'document',
      priority: 'normal',
      creator: 'archon',
      team: { members: [] },
      workflow: { stages: [] },
    });
    const repository = new ApprovalRequestRepository(db);
    const inserted = repository.insert({
      id: 'approval-g-1',
      task_id: 'OC-G-1',
      stage_id: 'review',
      gate_type: 'approval',
      requested_by: 'archon',
      request_comment: 'needs review',
    });
    expect(repository.getById('approval-g-1')?.id).toBe(inserted.id);
    expect(repository.getById('approval-g-1')?.request_comment).toBe('needs review');
    expect(repository.getById('missing')).toBeNull();
  });

  it('listPending returns only pending rows ordered by requested_at asc and respects the limit', () => {
    const db = createAgoraDatabase({ dbPath: makeDbPath() });
    runMigrations(db);
    const tasks = new TaskRepository(db);
    for (const id of ['OC-P-1', 'OC-P-2']) {
      tasks.insertTask({
        id,
        title: id,
        description: '',
        type: 'document',
        priority: 'normal',
        creator: 'archon',
        team: { members: [] },
        workflow: { stages: [] },
      });
    }
    const repository = new ApprovalRequestRepository(db);
    const r1 = repository.insert({ id: 'p-1', task_id: 'OC-P-1', stage_id: 's', gate_type: 'approval', requested_by: 'a' });
    const r2 = repository.insert({ id: 'p-2', task_id: 'OC-P-2', stage_id: 's', gate_type: 'archon_review', requested_by: 'b' });
    const r3 = repository.insert({ id: 'p-3', task_id: 'OC-P-1', stage_id: 's2', gate_type: 'approval', requested_by: 'c' });
    // resolve one
    repository.resolve('p-2', { status: 'approved', resolved_by: 'human', resolution_comment: 'ok' });

    const all = repository.listPending();
    expect(all.length).toBe(2);
    expect(all.map((r) => r.id)).toEqual(['p-1', 'p-3']);
    expect(all[0]?.id).toBe(r1.id);
    expect(all[1]?.id).toBe(r3.id);

    const limited = repository.listPending({ limit: 1 });
    expect(limited.length).toBe(1);
    expect(limited[0]?.id).toBe('p-1');
  });

  it('listPending clamps the limit into [1, 500] defensively', () => {
    const db = createAgoraDatabase({ dbPath: makeDbPath() });
    runMigrations(db);
    const repository = new ApprovalRequestRepository(db);
    // no rows; just verify it does not throw for extreme limits
    expect(repository.listPending({ limit: 0 })).toEqual([]);
    expect(repository.listPending({ limit: 10000 })).toEqual([]);
  });
});
