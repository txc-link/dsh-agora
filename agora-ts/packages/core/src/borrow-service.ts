/**
 * borrow-service.ts — Phase 3.5 Core orchestration for Agent borrow.
 *
 * createBorrow = persist request (U4=A: ACL + scope + posture in one
 * store) → resolve scope authorization → decideBorrow → record decision.
 * Pure Core orchestration: no platform names (§1). The scopeAuthResolver
 * is injected by the composition root (typically worksite
 * resolveScopeAuthorization).
 */

import type { IBorrowRequestRepository, BorrowRequestRecord } from '@agora-ts/contracts';
import { decideBorrow, type BorrowDecision } from './worksite/borrow.js';
import type { Permission, Posture, ScopeAuthorization } from './worksite/types.js';

export interface CreateBorrowInput {
  actor: string;
  target: string;
  scope: string;
  permissions: readonly Permission[];
  posture: Posture;
  ttlMs: number;
  reason: string;
}

export interface BorrowServiceOptions {
  borrowRepo: IBorrowRequestRepository;
  /** Resolve a target work site's scope authorization (composition root). */
  scopeAuthResolver: (target: string) => ScopeAuthorization | undefined;
}

export interface CreateBorrowResult {
  request: BorrowRequestRecord;
  decision: BorrowDecision;
}

export class BorrowService {
  constructor(private readonly opts: BorrowServiceOptions) {}

  createBorrow(input: CreateBorrowInput): CreateBorrowResult {
    const request = this.opts.borrowRepo.insert({
      actor: input.actor,
      target: input.target,
      scope: input.scope,
      permissions: [...input.permissions],
      posture: input.posture,
      ttlMs: input.ttlMs,
      reason: input.reason,
    });

    const scopeAuth = this.opts.scopeAuthResolver(input.target);
    const decision = decideBorrow({ ...input, permissions: [...input.permissions] }, scopeAuth);
    this.opts.borrowRepo.recordDecision(request.id, decision.outcome, new Date().toISOString());

    return { request, decision };
  }
}
