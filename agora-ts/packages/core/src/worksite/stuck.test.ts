/**
 * stuck.test.ts — Phase 4 (R7) TDD (red → green)
 *
 * v2.1 stuck auto-reassign — Core-side reassign decision layer.
 * Decisions: decisions.md §U2 (reuse v2.0 detection, new decision layer,
 * three posture, audit every decision).
 * Spec: Doc/09-PLANNING/TASKS/2026-08-30-phase-4-stuck-reassign/task_plan.md
 */

import { describe, expect, it } from 'vitest';
import {
  decideReassign,
  type ReassignDecision,
  type StuckSignal,
} from './stuck.js';
import type { ScopeAuthorization } from './types.js';

const scopeAuth: ScopeAuthorization = {
  scope: 'agora://task',
  posture: 'Auto',
  permissions: ['read', 'write'],
};

function makeSignal(overrides: Partial<StuckSignal> = {}): StuckSignal {
  return {
    taskId: 'OC-42',
    idleMs: 15 * 60_000,
    stage: 'implement',
    executorAgentId: 'agent:worker-1',
    creator: 'human:lead',
    subtasksDone: 2,
    subtasksTotal: 5,
    ...overrides,
  };
}

describe('decideReassign — three-posture (U2 + U3=C)', () => {
  it('Auto posture + valid signal → auto_reassign', () => {
    const r = decideReassign(makeSignal(), scopeAuth, 'agent:matrix-bridge');
    expect(r.decision.outcome).toBe('auto_reassign');
  });

  it('Strict posture → needs_confirm', () => {
    const r = decideReassign(
      makeSignal(),
      { ...scopeAuth, posture: 'Strict' },
      'agent:matrix-bridge',
    );
    expect(r.decision.outcome).toBe('needs_confirm');
  });

  it('Dangerous posture → escalate (never auto)', () => {
    const r = decideReassign(
      makeSignal(),
      { ...scopeAuth, posture: 'Dangerous' },
      'agent:matrix-bridge',
    );
    expect(r.decision.outcome).toBe('escalate');
  });

  it('no scope authorization → deny (fail-safe)', () => {
    const r = decideReassign(makeSignal(), undefined, 'agent:matrix-bridge');
    expect(r.decision.outcome).toBe('deny');
  });

  it('empty taskId → deny (invalid signal)', () => {
    const r = decideReassign(
      makeSignal({ taskId: '' }),
      scopeAuth,
      'agent:matrix-bridge',
    );
    expect(r.decision.outcome).toBe('deny');
  });

  it('zero idleMs → deny (not actually stuck)', () => {
    const r = decideReassign(
      makeSignal({ idleMs: 0 }),
      scopeAuth,
      'agent:matrix-bridge',
    );
    expect(r.decision.outcome).toBe('deny');
  });

  it('missing executor → deny (cannot reassign from unknown executor)', () => {
    const r = decideReassign(
      makeSignal({ executorAgentId: null }),
      scopeAuth,
      'agent:matrix-bridge',
    );
    expect(r.decision.outcome).toBe('deny');
  });
});

describe('decideReassign — audit (U2: every decision audited)', () => {
  it('returns an audit event with taskId + outcome', () => {
    const r = decideReassign(makeSignal(), scopeAuth, 'agent:matrix-bridge');
    expect(r.audit.taskId).toBe('OC-42');
    expect(r.audit.outcome).toBe(r.decision.outcome);
    expect(r.audit.actor).toBe('agent:matrix-bridge');
    expect(typeof r.audit.ts).toBe('string');
  });

  it('audit carries the resolved posture', () => {
    const r = decideReassign(
      makeSignal(),
      { ...scopeAuth, posture: 'Dangerous' },
      'agent:matrix-bridge',
    );
    expect(r.audit.posture).toBe('Dangerous');
    expect(r.audit.reason).toBeTruthy();
  });

  it('audit for deny records the reason', () => {
    const r = decideReassign(makeSignal(), undefined, 'agent:matrix-bridge');
    expect(r.decision.outcome).toBe('deny');
    if (r.decision.outcome === 'deny') {
      expect(r.decision.reason).toBeTruthy();
      expect(r.audit.reason).toBe(r.decision.reason);
    }
  });
});
