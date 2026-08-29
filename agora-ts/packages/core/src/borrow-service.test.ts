/**
 * borrow-service.test.ts — P3.5-1 TDD (red → green)
 *
 * Core 编排: createBorrow = 存 store → resolve scopeAuth → decideBorrow →
 * 回写决策. 纯 Core, 无平台名 (§1).
 */

import { describe, expect, it, vi } from 'vitest';
import type { IBorrowRequestRepository } from '@agora-ts/contracts';
import { BorrowService, type CreateBorrowInput } from './borrow-service.js';
import type { ScopeAuthorization } from './worksite/types.js';

const scopeAuth: ScopeAuthorization = {
  scope: 'agora://workspace/repoA',
  posture: 'Auto',
  permissions: ['read', 'write'],
};

function makeInput(overrides: Partial<CreateBorrowInput> = {}): CreateBorrowInput {
  return {
    actor: 'agent:matrix-bridge',
    target: 'agora://workspace/repoA',
    scope: 'agora://workspace/repoA',
    permissions: ['read'],
    posture: 'Auto',
    ttlMs: 3600_000,
    reason: 'mirror thread',
    ...overrides,
  };
}

function makeService(scopeAuthResolver: (target: string) => ScopeAuthorization | undefined) {
  const repo: IBorrowRequestRepository = {
    insert: vi.fn().mockReturnValue({
      id: 'borrow-1',
      status: 'pending',
      createdAt: '2026-08-30T00:00:00Z',
      ...makeInput(),
      permissions: [...makeInput().permissions],
    }),
    getById: vi.fn().mockReturnValue(null),
    listByActor: vi.fn().mockReturnValue([]),
    listPending: vi.fn().mockReturnValue([]),
    recordDecision: vi.fn().mockImplementation((id, outcome, decidedAt) => ({
      id,
      status: 'granted',
      outcome,
      decidedAt,
      createdAt: '2026-08-30T00:00:00Z',
      ...makeInput(),
      permissions: [...makeInput().permissions],
    })),
  };
  return { service: new BorrowService({ borrowRepo: repo, scopeAuthResolver }), repo };
}

describe('BorrowService.createBorrow', () => {
  it('Auto + read → persisted with decision grant (存 + 决策 + 回写)', () => {
    const { service, repo } = makeService(() => scopeAuth);
    const result = service.createBorrow(makeInput());

    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.recordDecision).toHaveBeenCalledTimes(1);
    expect(result.decision.outcome).toBe('grant');
    expect(result.request.id).toBe('borrow-1');
  });

  it('no scope authorization → deny + decision recorded', () => {
    const { service, repo } = makeService(() => undefined);
    const result = service.createBorrow(makeInput());

    expect(result.decision.outcome).toBe('deny');
    expect(repo.recordDecision).toHaveBeenCalledTimes(1);
    const [, outcome] = (repo.recordDecision as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(outcome).toBe('deny');
  });

  it('expired ttl → deny', () => {
    const { service } = makeService(() => scopeAuth);
    const result = service.createBorrow(makeInput({ ttlMs: 0 }));
    expect(result.decision.outcome).toBe('deny');
  });

  it('Dangerous posture → needs_dual recorded', () => {
    const { service, repo } = makeService(() => scopeAuth);
    const result = service.createBorrow(makeInput({ posture: 'Dangerous' }));
    expect(result.decision.outcome).toBe('needs_dual');
    const [, outcome] = (repo.recordDecision as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(outcome).toBe('needs_dual');
  });

  it('scopeAuthResolver is consulted for the target', () => {
    const resolve = vi.fn().mockReturnValue(scopeAuth);
    const { service } = makeService(resolve);
    service.createBorrow(makeInput());
    expect(resolve).toHaveBeenCalledWith('agora://workspace/repoA');
  });
});
