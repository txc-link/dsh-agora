/**
 * borrow-command.test.ts — P3.5-2 TDD (red → green)
 *
 * CLI borrow command thin orchestration: parse args → BorrowService / repo
 * → result. Pure data, no commander, no I/O.
 */

import { describe, expect, it, vi } from 'vitest';
import type { IBorrowRequestRepository } from '@agora-ts/contracts';
import { BorrowService } from './borrow-service.js';
import { runBorrowCommand } from './borrow-command.js';
import type { Permission, Posture, ScopeAuthorization } from './worksite/types.js';
import type { BorrowRequestRecord } from '@agora-ts/contracts';

const scopeAuth: ScopeAuthorization = {
  scope: 'agora://workspace/repoA',
  posture: 'Auto' as Posture,
  permissions: ['read', 'write'] as Permission[],
};

function makeDeps(opts: {
  insert?: ReturnType<typeof vi.fn>;
  recordDecision?: ReturnType<typeof vi.fn>;
  listByActor?: ReturnType<typeof vi.fn>;
  listPending?: ReturnType<typeof vi.fn>;
  getById?: ReturnType<typeof vi.fn>;
  scopeAuth?: ScopeAuthorization | undefined;
} = {}) {
  const insert = opts.insert ?? vi.fn().mockReturnValue({
    id: 'borrow-1',
    status: 'pending',
    createdAt: '2026-08-30T00:00:00Z',
    actor: 'agent:matrix-bridge',
    target: 'agora://workspace/repoA',
    scope: 'agora://workspace/repoA',
    permissions: ['read'],
    posture: 'Auto',
    ttlMs: 3600_000,
    reason: 'mirror thread',
    outcome: null,
    decidedAt: null,
    metadata: null,
  } satisfies BorrowRequestRecord);
  const recordDecision = opts.recordDecision ?? vi.fn().mockImplementation((id, outcome, decidedAt) => ({
    id,
    status: 'granted',
    outcome,
    decidedAt,
    createdAt: '2026-08-30T00:00:00Z',
    actor: 'agent:matrix-bridge',
    target: 'agora://workspace/repoA',
    scope: 'agora://workspace/repoA',
    permissions: ['read'],
    posture: 'Auto',
    ttlMs: 3600_000,
    reason: 'mirror thread',
    metadata: null,
  } satisfies BorrowRequestRecord));
  const listByActor = opts.listByActor ?? vi.fn().mockReturnValue([]);
  const listPending = opts.listPending ?? vi.fn().mockReturnValue([]);
  const getById = opts.getById ?? vi.fn().mockReturnValue(null);

  const repo: IBorrowRequestRepository = { insert, getById, listByActor, listPending, recordDecision };
  const borrowService = new BorrowService({
    borrowRepo: repo,
    scopeAuthResolver: () => opts.scopeAuth ?? scopeAuth,
  });
  return { deps: { borrowService, borrowRepo: repo }, insert, recordDecision, listByActor, listPending, getById };
}

describe('runBorrowCommand create', () => {
  it('returns ok with request + decision when all fields present', async () => {
    const { deps, insert, recordDecision } = makeDeps();
    const result = await runBorrowCommand(deps, {
      subcommand: 'create',
      actor: 'agent:matrix-bridge',
      target: 'agora://workspace/repoA',
      scope: 'agora://workspace/repoA',
      permissions: 'read,write',
      posture: 'Auto',
      ttlMs: 7200_000,
      reason: 'thread mirror',
    });
    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(recordDecision).toHaveBeenCalledTimes(1);
    expect(result.data).toMatchObject({
      request: { id: 'borrow-1' },
      decision: { outcome: 'grant' },
    });
  });

  it('rejects missing required fields', async () => {
    const { deps } = makeDeps();
    const result = await runBorrowCommand(deps, { subcommand: 'create' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/actor is required/);
  });

  it('rejects invalid posture', async () => {
    const { deps } = makeDeps();
    const result = await runBorrowCommand(deps, {
      subcommand: 'create',
      actor: 'a',
      target: 'agora://workspace/repoA',
      scope: 'agora://workspace/repoA',
      posture: 'Wild' as Posture,
      reason: 'r',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid posture/);
  });

  it('rejects invalid permission', async () => {
    const { deps } = makeDeps();
    const result = await runBorrowCommand(deps, {
      subcommand: 'create',
      actor: 'a',
      target: 'agora://workspace/repoA',
      scope: 'agora://workspace/repoA',
      permissions: 'read,fly',
      reason: 'r',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid permission/);
  });

  it('defaults posture Auto and ttlMs 3600000 when omitted', async () => {
    const { deps, insert } = makeDeps();
    await runBorrowCommand(deps, {
      subcommand: 'create',
      actor: 'a',
      target: 'agora://workspace/repoA',
      scope: 'agora://workspace/repoA',
      reason: 'r',
    });
    const passed = insert.mock.calls[0]?.[0] as { posture: Posture; ttlMs: number };
    expect(passed.posture).toBe('Auto');
    expect(passed.ttlMs).toBe(3600_000);
  });
});

describe('runBorrowCommand list', () => {
  it('listPending when --pending flag is set', async () => {
    const { deps, listPending, listByActor } = makeDeps();
    await runBorrowCommand(deps, { subcommand: 'list', listPending: true });
    expect(listPending).toHaveBeenCalledTimes(1);
    expect(listByActor).not.toHaveBeenCalled();
  });

  it('listByActor when actor provided', async () => {
    const { deps, listByActor, listPending } = makeDeps();
    await runBorrowCommand(deps, { subcommand: 'list', listActor: 'agent:matrix-bridge' });
    expect(listByActor).toHaveBeenCalledWith('agent:matrix-bridge');
    expect(listPending).not.toHaveBeenCalled();
  });

  it('defaults to listPending when no flag', async () => {
    const { deps, listPending } = makeDeps();
    await runBorrowCommand(deps, { subcommand: 'list' });
    expect(listPending).toHaveBeenCalledTimes(1);
  });
});

describe('runBorrowCommand show', () => {
  it('returns the row when found', async () => {
    const row = { id: 'borrow-1' } as unknown as BorrowRequestRecord;
    const { deps, getById } = makeDeps({ getById: vi.fn().mockReturnValue(row) });
    const result = await runBorrowCommand(deps, { subcommand: 'show', requestId: 'borrow-1' });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(row);
    expect(getById).toHaveBeenCalledWith('borrow-1');
  });

  it('returns ok=false when not found', async () => {
    const { deps } = makeDeps({ getById: vi.fn().mockReturnValue(null) });
    const result = await runBorrowCommand(deps, { subcommand: 'show', requestId: 'missing' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it('rejects when requestId missing', async () => {
    const { deps } = makeDeps();
    const result = await runBorrowCommand(deps, { subcommand: 'show' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/requestId is required/);
  });
});
