/**
 * borrow.ts — Phase 3: Agent borrow + three-posture governance.
 *
 * Core orchestration semantics only (§1): decide whether an agent may
 * borrow execution scope on a work site. No IO, no platform names.
 *
 * Decisions: decisions.md U3=C (three posture + audit + gate retained),
 * U4=A (ACL bundled with scope).
 *
 * Phase 3.5 (not here): Dashboard human approval entry, borrow store,
 * kill switch.
 */

import type { Permission, Posture, ScopeAuthorization } from './types.js';

export interface BorrowRequest {
  /** Borrowing actor, e.g. 'agent:matrix-bridge'. */
  readonly actor: string;
  /** Target work site URI. */
  readonly target: string;
  /** Requested scope (must stay within the scope authorization). */
  readonly scope: string;
  readonly permissions: readonly Permission[];
  /** Requested posture. */
  readonly posture: Posture;
  /** Borrow lifetime in ms. */
  readonly ttlMs: number;
  /** Motivation (audit trail). */
  readonly reason: string;
}

export type BorrowDecision =
  | { readonly outcome: 'grant' }
  | { readonly outcome: 'needs_confirm' } // Strict: single human confirm
  | { readonly outcome: 'needs_dual' }     // Dangerous: dual approval
  | { readonly outcome: 'deny'; readonly reason: string };

/**
 * Decide a borrow request against a work site's scope authorization.
 *
 * Order (fail-safe first):
 *  1. No scope authorization → deny
 *  2. Expired ttl → deny
 *  3. Requested scope outside authorized scope → deny
 *  4. Dangerous → needs_dual
 *  5. Strict → needs_confirm
 *  6. Auto + delete permission → needs_confirm (QM-stricter gate:
 *     critical paths never run on Auto — decisions §U3)
 *  7. Requested permissions ⊄ authorized permissions → deny
 *  8. Auto → grant
 */
export function decideBorrow(
  req: BorrowRequest,
  scopeAuth: ScopeAuthorization | undefined,
): BorrowDecision {
  if (scopeAuth === undefined) {
    return { outcome: 'deny', reason: 'no scope authorization on target work site' };
  }
  if (req.ttlMs <= 0) {
    return { outcome: 'deny', reason: 'borrow ttl expired or invalid' };
  }
  if (!scopeCovers(scopeAuth.scope, req.scope)) {
    return { outcome: 'deny', reason: `requested scope '${req.scope}' outside authorized scope '${scopeAuth.scope}'` };
  }

  if (req.posture === 'Dangerous') {
    return { outcome: 'needs_dual' };
  }
  if (req.posture === 'Strict') {
    return { outcome: 'needs_confirm' };
  }
  if (req.posture === 'Auto' && req.permissions.includes('delete')) {
    return { outcome: 'needs_confirm', };
  }

  for (const p of req.permissions) {
    if (!scopeAuth.permissions.includes(p)) {
      return { outcome: 'deny', reason: `permission '${p}' not granted by scope authorization` };
    }
  }

  return { outcome: 'grant' };
}

/**
 * Whether `requested` stays within the authorized scope prefix.
 * Exact match or a strict descendant path.
 */
export function scopeCovers(authorized: string, requested: string): boolean {
  return requested === authorized || requested.startsWith(`${authorized}/`);
}
