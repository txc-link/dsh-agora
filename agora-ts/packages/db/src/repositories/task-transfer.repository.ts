/**
 * task-transfer.repository.ts — task_transfers store (T_transfer).
 *
 * Follows task-claim.repository.ts pattern: prepared statements, JSON metadata
 * via the shared json helpers.
 */

import { randomUUID } from 'node:crypto';
import type {
  ITaskTransferRepository,
  TaskTransferRecord,
  TaskTransferStatus,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

export class TaskTransferRepository implements ITaskTransferRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(input: {
    id?: string;
    taskId: string;
    fromRuntimeRef: string;
    toRuntimeRef: string;
    targetEmploymentId?: string | null;
    reason: string;
    decidedBy?: string | null;
    approvalId?: string | null;
    status?: TaskTransferStatus;
    metadata?: Record<string, unknown> | null;
    now?: () => string;
  }): TaskTransferRecord {
    const now = input.now ?? (() => new Date().toISOString());
    const id = input.id ?? randomUUID();
    const createdAt = now();
    this.db.prepare(`
      INSERT INTO task_transfers (
        id, task_id, from_runtime_ref, to_runtime_ref, target_employment_id,
        reason, decided_by, approval_id, status, applied_at, rejected_at,
        cancelled_at, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
    `).run(
      id,
      input.taskId,
      input.fromRuntimeRef,
      input.toRuntimeRef,
      input.targetEmploymentId ?? null,
      input.reason,
      input.decidedBy ?? null,
      input.approvalId ?? null,
      input.status ?? 'pending',
      stringifyJsonValue(input.metadata ?? null),
      createdAt,
    );
    const stored = this.getById(id);
    if (stored === null) {
      throw new Error('task transfer insert failed: reload returned null');
    }
    return stored;
  }

  getById(id: string): TaskTransferRecord | null {
    const row = this.db.prepare('SELECT * FROM task_transfers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.parseRow(row) : null;
  }

  listByTask(taskId: string): TaskTransferRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM task_transfers WHERE task_id = ? ORDER BY created_at DESC, id DESC',
    ).all(taskId) as Record<string, unknown>[];
    return rows.map((row) => this.parseRow(row));
  }

  listPending(limit = 50): TaskTransferRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM task_transfers WHERE status = 'pending' ORDER BY created_at DESC, id DESC LIMIT ?",
    ).all(limit) as Record<string, unknown>[];
    return rows.map((row) => this.parseRow(row));
  }

  applyTransfer(
    id: string,
    decidedBy: string,
    opts: { approvalId?: string | null; comment?: string | null; now?: () => string } = {},
  ): TaskTransferRecord | null {
    const now = opts.now ?? (() => new Date().toISOString());
    this.db.prepare(
      "UPDATE task_transfers SET status = 'applied', decided_by = ?, approval_id = COALESCE(?, approval_id), applied_at = ?, metadata = ? WHERE id = ? AND status = 'pending'",
    ).run(decidedBy, opts.approvalId ?? null, now(), stringifyJsonValue(opts.comment ? { comment: opts.comment } : null), id);
    return this.getById(id);
  }

  rejectTransfer(
    id: string,
    decidedBy: string,
    opts: { approvalId?: string | null; comment?: string | null; now?: () => string } = {},
  ): TaskTransferRecord | null {
    const now = opts.now ?? (() => new Date().toISOString());
    this.db.prepare(
      "UPDATE task_transfers SET status = 'rejected', decided_by = ?, approval_id = COALESCE(?, approval_id), rejected_at = ?, metadata = ? WHERE id = ? AND status = 'pending'",
    ).run(decidedBy, opts.approvalId ?? null, now(), stringifyJsonValue(opts.comment ? { comment: opts.comment } : null), id);
    return this.getById(id);
  }

  cancelTransfer(id: string, decidedBy: string): TaskTransferRecord | null {
    const now = new Date().toISOString();
    this.db.prepare(
      "UPDATE task_transfers SET status = 'cancelled', decided_by = ?, cancelled_at = ? WHERE id = ? AND status = 'pending'",
    ).run(decidedBy, now, id);
    return this.getById(id);
  }

  private parseRow(row: Record<string, unknown>): TaskTransferRecord {
    return {
      id: String(row.id),
      taskId: String(row.task_id),
      fromRuntimeRef: String(row.from_runtime_ref),
      toRuntimeRef: String(row.to_runtime_ref),
      targetEmploymentId: row.target_employment_id == null ? null : String(row.target_employment_id),
      reason: String(row.reason),
      decidedBy: row.decided_by == null ? null : String(row.decided_by),
      approvalId: row.approval_id == null ? null : String(row.approval_id),
      status: String(row.status) as TaskTransferStatus,
      appliedAt: row.applied_at == null ? null : String(row.applied_at),
      rejectedAt: row.rejected_at == null ? null : String(row.rejected_at),
      cancelledAt: row.cancelled_at == null ? null : String(row.cancelled_at),
      metadata: parseJsonValue<Record<string, unknown> | null>(row.metadata, null),
      createdAt: String(row.created_at),
    };
  }
}
