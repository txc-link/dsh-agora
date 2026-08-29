/**
 * stuck.ts — Phase 4 (v2.1): stuck auto-reassign decision layer.
 *
 * v2.0 (matrix-connector) detects stuck tasks and alerts; its own comment
 * states it must NOT auto-reassign because no Core endpoint exists. This
 * module is that Core endpoint's decision core (§1: reassignment policy is
 * Core orchestration; the adapter only feeds the signal).
 *
 * Every decision emits an audit event (U2: "每次重派决策落 audit trail").
 * Persistence of audit events belongs to Phase 3.5 store, not here.
 *
 * Decisions: decisions.md §U2 + §U3=C (three posture).
 */

import type { Posture, ScopeAuthorization } from './types.js';

export interface StuckSignal {
  readonly taskId: string;
  /** How long the task has been idle (ms). */
  readonly idleMs: number;
  readonly stage: string | null;
  readonly executorAgentId: string | null;
  readonly creator: string | null;
  readonly subtasksDone: number;
  readonly subtasksTotal: number;
}

export type ReassignDecision =
  | { readonly outcome: 'auto_reassign' } // Auto: reassign by rule
  | { readonly outcome: 'needs_confirm' } // Strict: single human confirm
  | { readonly outcome: 'escalate' }      // Dangerous: never auto, escalate
  | { readonly outcome: 'deny'; readonly reason: string };

export interface ReassignAuditEvent {
  readonly ts: string;
  readonly taskId: string;
  readonly posture: Posture | 'none';
  readonly outcome: ReassignDecision['outcome'];
  readonly actor: string;
  readonly reason: string;
}

export interface ReassignResult {
  readonly decision: ReassignDecision;
  readonly audit: ReassignAuditEvent;
}

function auditFor(
  taskId: string,
  posture: Posture | 'none',
  decision: ReassignDecision,
  actor: string,
  reason: string,
): ReassignAuditEvent {
  return {
    ts: new Date().toISOString(),
    taskId,
    posture,
    outcome: decision.outcome,
    actor,
    reason,
  };
}

/**
 * Decide what to do with a stuck task, under the target scope's posture.
 *
 * Fail-safe order:
 *  1. No scope authorization → deny
 *  2. Invalid signal (empty taskId / idleMs <= 0 / unknown executor) → deny
 *  3. Dangerous → escalate (never auto)
 *  4. Strict → needs_confirm
 *  5. Auto → auto_reassign
 */
export function decideReassign(
  signal: StuckSignal,
  scopeAuth: ScopeAuthorization | undefined,
  actor: string,
): ReassignResult {
  const taskId = signal.taskId;

  if (scopeAuth === undefined) {
    const decision: ReassignDecision = { outcome: 'deny', reason: 'no scope authorization on target' };
    return { decision, audit: auditFor(taskId, 'none', decision, actor, decision.reason) };
  }
  if (typeof taskId !== 'string' || taskId.length === 0) {
    const decision: ReassignDecision = { outcome: 'deny', reason: 'invalid stuck signal: empty taskId' };
    return { decision, audit: auditFor(taskId, scopeAuth.posture, decision, actor, decision.reason) };
  }
  if (signal.idleMs <= 0) {
    const decision: ReassignDecision = { outcome: 'deny', reason: 'invalid stuck signal: idleMs <= 0' };
    return { decision, audit: auditFor(taskId, scopeAuth.posture, decision, actor, decision.reason) };
  }
  if (typeof signal.executorAgentId !== 'string' || signal.executorAgentId.length === 0) {
    const decision: ReassignDecision = { outcome: 'deny', reason: 'invalid stuck signal: unknown executor' };
    return { decision, audit: auditFor(taskId, scopeAuth.posture, decision, actor, decision.reason) };
  }

  if (scopeAuth.posture === 'Dangerous') {
    const decision: ReassignDecision = { outcome: 'escalate' };
    return { decision, audit: auditFor(taskId, scopeAuth.posture, decision, actor, 'dangerous posture: escalated, never auto-reassign') };
  }
  if (scopeAuth.posture === 'Strict') {
    const decision: ReassignDecision = { outcome: 'needs_confirm' };
    return { decision, audit: auditFor(taskId, scopeAuth.posture, decision, actor, 'strict posture: human confirm required') };
  }
  const decision: ReassignDecision = { outcome: 'auto_reassign' };
  return { decision, audit: auditFor(taskId, scopeAuth.posture, decision, actor, 'auto posture: rule-based reassign') };
}
