/**
 * borrow-request.repository.ts — Phase 3.5 borrow store (U4=A).
 *
 * Persists borrow requests so ACL + scope + posture are queryable in one
 * lookup. Pattern follows approval-request.repository.ts.
 */

import { randomUUID } from 'node:crypto';
import type { IBorrowRequestRepository, BorrowRequestRecord } from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

export class BorrowRequestRepository implements IBorrowRequestRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(input: {
    id?: string;
    actor: string;
    target: string;
    scope: string;
    permissions: string[];
    posture: string;
    ttlMs: number;
    reason: string;
    metadata?: Record<string, unknown> | null;
  }): BorrowRequestRecord {
    const id = input.id ?? randomUUID();
    const createdAt = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO borrow_requests (
        id, actor, target, scope, permissions, posture, ttl_ms, reason,
        status, outcome, decided_at, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)
    `).run(
      id,
      input.actor,
      input.target,
      input.scope,
      stringifyJsonValue(input.permissions),
      input.posture,
      input.ttlMs,
      input.reason,
      createdAt,
      stringifyJsonValue(input.metadata ?? null),
    );
    const stored = this.getById(id);
    if (stored === null) {
      throw new Error('borrow request insert failed: reload returned null');
    }
    return stored;
  }

  getById(id: string): BorrowRequestRecord | null {
    const row = this.db.prepare('SELECT * FROM borrow_requests WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.parseRow(row) : null;
  }

  listByActor(actor: string): BorrowRequestRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM borrow_requests WHERE actor = ? ORDER BY created_at DESC, id DESC',
    ).all(actor) as Record<string, unknown>[];
    return rows.map((row) => this.parseRow(row));
  }

  listPending(): BorrowRequestRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM borrow_requests WHERE status = 'pending' ORDER BY created_at DESC, id DESC",
    ).all() as Record<string, unknown>[];
    return rows.map((row) => this.parseRow(row));
  }

  recordDecision(id: string, outcome: string, decidedAt: string): BorrowRequestRecord | null {
    const status = this.statusForOutcome(outcome);
    const info = this.db.prepare(`
      UPDATE borrow_requests
      SET status = ?, outcome = ?, decided_at = ?
      WHERE id = ?
    `).run(status, outcome, decidedAt, id);
    if (info.changes === 0) {
      return null;
    }
    return this.getById(id);
  }

  private statusForOutcome(outcome: string): BorrowRequestRecord['status'] {
    switch (outcome) {
      case 'grant': return 'granted';
      case 'deny': return 'denied';
      case 'needs_confirm': return 'needs_confirm';
      case 'needs_dual': return 'needs_dual';
      default: return 'pending';
    }
  }

  private parseRow(row: Record<string, unknown>): BorrowRequestRecord {
    return {
      id: row.id as string,
      actor: row.actor as string,
      target: row.target as string,
      scope: row.scope as string,
      permissions: parseJsonValue<string[]>(row.permissions, []),
      posture: row.posture as string,
      ttlMs: Number(row.ttl_ms),
      reason: row.reason as string,
      status: row.status as BorrowRequestRecord['status'],
      outcome: row.outcome as string | null,
      decidedAt: row.decided_at as string | null,
      createdAt: row.created_at as string,
      metadata: parseJsonValue<Record<string, unknown> | null>(row.metadata, null),
    };
  }
}
