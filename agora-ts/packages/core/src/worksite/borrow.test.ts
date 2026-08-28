/**
 * borrow.test.ts — Phase 3 TDD (red → green)
 *
 * Agent borrow + three-posture governance + scope-authorization.
 * Spec: Doc/09-PLANNING/TASKS/2026-08-30-phase-3-agent-borrow/task_plan.md §4
 * Decisions: decisions.md U3=C / U4=A
 */

import { describe, expect, it } from 'vitest';
import {
  decideBorrow,
  type BorrowRequest,
  type ScopeAuthorization,
} from './borrow.js';
import {
  type WorkSite,
  type WorksiteMetadata,
} from './types.js';
import {
  resolveScopeAuthorization,
} from './resolver.js';

const baseScope: ScopeAuthorization = {
  scope: 'agora://workspace/repoA',
  posture: 'Auto',
  permissions: ['read', 'write'],
};

function makeRequest(overrides: Partial<BorrowRequest> = {}): BorrowRequest {
  return {
    actor: 'agent:matrix-bridge',
    target: 'agora://workspace/repoA',
    scope: 'agora://workspace/repoA',
    permissions: ['read'],
    posture: 'Auto',
    ttlMs: 3600_000,
    reason: 'R4 thread mirror',
    ...overrides,
  };
}

function makeWorksite(meta: WorksiteMetadata = {}): WorkSite {
  return {
    type: 'task',
    id: 'Ta-1',
    uri: 'agora://task/Ta-1',
    refs: [],
    ...meta,
  } as WorkSite;
}

describe('scope-authorization field (WorkSite)', () => {
  it('accepts a WorkSite with scopeAuthorization on metadata', () => {
    const ws = makeWorksite({ scopeAuthorization: baseScope });
    expect(ws.scopeAuthorization).toEqual(baseScope);
  });

  it('omits scopeAuthorization when absent (no authorization)', () => {
    const ws = makeWorksite();
    expect(ws.scopeAuthorization).toBeUndefined();
  });
});

describe('decideBorrow — three-posture governance (U3=C)', () => {
  it('Auto posture + read permission → grant', () => {
    const d = decideBorrow(makeRequest(), baseScope);
    expect(d.outcome).toBe('grant');
  });

  it('Auto posture + delete permission → upgrade to needs_confirm (QM-stricter gate)', () => {
    const d = decideBorrow(
      makeRequest({ permissions: ['read', 'delete'], posture: 'Auto' }),
      baseScope,
    );
    expect(d.outcome).toBe('needs_confirm');
  });

  it('Strict posture → needs_confirm', () => {
    const d = decideBorrow(makeRequest({ posture: 'Strict' }), baseScope);
    expect(d.outcome).toBe('needs_confirm');
  });

  it('Dangerous posture → needs_dual (dual approval)', () => {
    const d = decideBorrow(makeRequest({ posture: 'Dangerous' }), baseScope);
    expect(d.outcome).toBe('needs_dual');
  });

  it('expired ttl → deny', () => {
    const d = decideBorrow(makeRequest({ ttlMs: 0 }), baseScope);
    expect(d.outcome).toBe('deny');
    expect(d).toHaveProperty('reason');
  });

  it('permissions outside scope authorization → deny', () => {
    const d = decideBorrow(
      makeRequest({ permissions: ['execute'] }),
      baseScope, // permissions: read, write only
    );
    expect(d.outcome).toBe('deny');
  });

  it('no scope authorization → deny (fail-safe)', () => {
    const d = decideBorrow(makeRequest(), undefined);
    expect(d.outcome).toBe('deny');
  });

  it('scope mismatch (requested scope ⊄ authorized scope) → deny', () => {
    const d = decideBorrow(
      makeRequest({ scope: 'agora://workspace/repoB' }),
      baseScope,
    );
    expect(d.outcome).toBe('deny');
  });
});

describe('resolveScopeAuthorization — ACL with scope in one lookup (U4=A)', () => {
  it('returns the bound scope authorization for a matching worksite', async () => {
    const ws = makeWorksite({ scopeAuthorization: baseScope });
    const auth = await resolveScopeAuthorization(ws);
    expect(auth).toEqual(baseScope);
  });

  it('returns undefined for a worksite without scopeAuthorization', async () => {
    const auth = await resolveScopeAuthorization(makeWorksite());
    expect(auth).toBeUndefined();
  });
});
