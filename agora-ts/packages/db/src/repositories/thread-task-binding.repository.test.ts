/**
 * thread-task-binding.repository.test.ts — R-C / T-1.5 TDD (red → green).
 *
 * SQLite-backed IThreadTaskBindingRepository via the shared in-memory
 * tmp-DB + runMigrations pattern.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAgoraDatabase, runMigrations } from '../database.js';
import { ThreadTaskBindingRepository } from './thread-task-binding.repository.js';

const tempPaths: string[] = [];

function makeDbPath() {
  const dir = mkdtempSync(join(tmpdir(), 'agora-ts-thread-binding-'));
  tempPaths.push(dir);
  return join(dir, 'binding.db');
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeRepo() {
  const dbPath = makeDbPath();
  const db = createAgoraDatabase({ dbPath });
  runMigrations(db);
  return new ThreadTaskBindingRepository(db);
}

describe('ThreadTaskBindingRepository', () => {
  it('bind inserts a row and returns the binding', () => {
    const repo = makeRepo();
    const b = repo.bind({ threadKey: 'mx_a0000000000000001', taskId: 'T-1' });
    expect(b.threadKey).toBe('mx_a0000000000000001');
    expect(b.taskId).toBe('T-1');
    expect(b.createdAt).toBe(b.updatedAt);
  });

  it('bind same threadKey again is idempotent on createdAt', () => {
    const repo = makeRepo();
    const first = repo.bind({ threadKey: 'mx_a0000000000000001', taskId: 'T-1' });
    // Tiny sleep so updatedAt would differ if it bumped.
    const second = repo.bind({ threadKey: 'mx_a0000000000000001', taskId: 'T-1' });
    expect(second.createdAt).toBe(first.createdAt);
    expect(repo.list().length).toBe(1);
  });

  it('bind same threadKey to a different taskId replaces atomically', () => {
    const repo = makeRepo();
    repo.bind({ threadKey: 'mx_a0000000000000001', taskId: 'T-1' });
    repo.bind({ threadKey: 'mx_a0000000000000001', taskId: 'T-2' });
    expect(repo.getByTask('T-1')).toBeUndefined();
    expect(repo.getByTask('T-2')?.threadKey).toBe('mx_a0000000000000001');
    expect(repo.list().length).toBe(1);
  });

  it('bind a different threadKey to an already-bound task replaces', () => {
    const repo = makeRepo();
    repo.bind({ threadKey: 'mx_a0000000000000001', taskId: 'T-1' });
    repo.bind({ threadKey: 'mx_b0000000000000001', taskId: 'T-1' });
    expect(repo.getByThreadKey('mx_a0000000000000001')).toBeUndefined();
    expect(repo.getByThreadKey('mx_b0000000000000001')?.taskId).toBe('T-1');
    expect(repo.list().length).toBe(1);
  });

  it('unbindByThreadKey removes the row', () => {
    const repo = makeRepo();
    repo.bind({ threadKey: 'mx_a0000000000000001', taskId: 'T-1' });
    expect(repo.unbindByThreadKey('mx_a0000000000000001')).toBe(true);
    expect(repo.unbindByThreadKey('mx_a0000000000000001')).toBe(false);
  });

  it('unbindByTask removes the row', () => {
    const repo = makeRepo();
    repo.bind({ threadKey: 'mx_a0000000000000001', taskId: 'T-1' });
    expect(repo.unbindByTask('T-1')).toBe(true);
    expect(repo.unbindByTask('T-1')).toBe(false);
  });

  it('list returns rows ordered by created_at desc, thread_key asc', () => {
    const repo = makeRepo();
    repo.bind({ threadKey: 'mx_b0000000000000001', taskId: 'T-1' });
    repo.bind({ threadKey: 'mx_a0000000000000001', taskId: 'T-2' });
    const keys = repo.list().map((b) => b.threadKey);
    expect(keys).toContain('mx_a0000000000000001');
    expect(keys).toContain('mx_b0000000000000001');
    expect(keys.length).toBe(2);
  });
});