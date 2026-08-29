/**
 * borrow-request.repository.test.ts — P3.5-1 TDD (red → green)
 *
 * borrow_requests 持久化 (U4=A: ACL 跟 scope 一起持久化).
 * Pattern: approval-request.repository.test.ts (tmp db + runMigrations).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAgoraDatabase, runMigrations } from '../database.js';
import { BorrowRequestRepository } from './borrow-request.repository.js';

const tempPaths: string[] = [];

function makeDbPath() {
  const dir = mkdtempSync(join(tmpdir(), 'agora-ts-borrow-'));
  tempPaths.push(dir);
  return join(dir, 'borrow.db');
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeRepo() {
  const db = createAgoraDatabase({ dbPath: makeDbPath() });
  runMigrations(db);
  return new BorrowRequestRepository(db);
}

const baseInput = {
  actor: 'agent:matrix-bridge',
  target: 'agora://workspace/repoA',
  scope: 'agora://workspace/repoA',
  permissions: ['read', 'write'] as string[],
  posture: 'Auto',
  ttlMs: 3600_000,
  reason: 'R4 thread mirror',
};

describe('borrow request repository', () => {
  it('inserts and reloads a borrow request', () => {
    const repo = makeRepo();
    const stored = repo.insert(baseInput);
    expect(stored.id).toBeTruthy();
    expect(stored.status).toBe('pending');

    const reloaded = repo.getById(stored.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.actor).toBe('agent:matrix-bridge');
    expect(reloaded!.scope).toBe('agora://workspace/repoA');
    expect(reloaded!.permissions).toEqual(['read', 'write']);
    expect(reloaded!.posture).toBe('Auto');
    expect(reloaded!.ttlMs).toBe(3600_000);
  });

  it('lists by actor', () => {
    const repo = makeRepo();
    repo.insert(baseInput);
    repo.insert({ ...baseInput, actor: 'agent:other' });
    const mine = repo.listByActor('agent:matrix-bridge');
    expect(mine).toHaveLength(1);
    expect(mine[0]!.actor).toBe('agent:matrix-bridge');
  });

  it('lists pending requests across actors', () => {
    const repo = makeRepo();
    repo.insert(baseInput);
    repo.insert({ ...baseInput, actor: 'agent:other' });
    const pending = repo.listPending();
    expect(pending).toHaveLength(2);
    expect(pending.every((r) => r.status === 'pending')).toBe(true);
  });

  it('records a decision and reloads it', () => {
    const repo = makeRepo();
    const stored = repo.insert(baseInput);
    const decided = repo.recordDecision(stored.id, 'grant', new Date().toISOString());
    expect(decided!.status).toBe('granted');
    expect(decided!.outcome).toBe('grant');

    const reloaded = repo.getById(stored.id);
    expect(reloaded!.status).toBe('granted');
    expect(reloaded!.outcome).toBe('grant');
    expect(reloaded!.decidedAt).toBeTruthy();
  });

  it('recordDecision on unknown id returns null', () => {
    const repo = makeRepo();
    const decided = repo.recordDecision('missing-id', 'grant', new Date().toISOString());
    expect(decided).toBeNull();
  });
});
