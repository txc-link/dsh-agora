/**
 * task-claim.repository.ts — org-aware-work-os S2 task claim store (2026-08-30).
 *
 * Persists task claims so the claiming state machine (pending → claimed →
 * released/expired) is queryable. Pattern follows borrow-request.repository.ts.
 */

import { randomUUID } from 'node:crypto';
import type { ITaskClaimRepository, TaskClaimRecord, TaskClaimStatus } from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

export class TaskClaimRepository implements ITaskClaimRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(input: {
    id?: string;
    taskId: string;
    agentRef: string;
    reason?: string | null;
    expiresAt?: string | null;
    metadata?: Record<string, unknown> | null;
  }): TaskClaimRecord {
    const id = input.id ?? randomUUID();
    const createdAt = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO task_claims (
        id, task_id, agent_ref, status, claimed_at, released_at, expires_at,
        reason, created_at, metadata
      ) VALUES (?, ?, ?, 'pending', NULL, NULL, ?, ?, ?, ?)
    `).run(
      id,
      input.taskId,
      input.agentRef,
      input.expiresAt ?? null,
      input.reason ?? null,
      createdAt,
      stringifyJsonValue(input.metadata ?? null),
    );
    const stored = this.getById(id);
    if (stored === null) {
      throw new Error('task claim insert failed: reload returned null');
    }
    return stored;
  }

  getById(id: string): TaskClaimRecord | null {
    const row = this.db.prepare('SELECT * FROM task_claims WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.parseRow(row) : null;
  }

  getByTaskId(taskId: string): TaskClaimRecord | null {
    // 最新一条认领记录 (按 created_at 倒序): released/expired 的旧记录允许被重新认领覆盖。
    const row = this.db.prepare(
      'SELECT * FROM task_claims WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
    ).get(taskId) as Record<string, unknown> | undefined;
    return row ? this.parseRow(row) : null;
  }

  listByAgent(agentRef: string): TaskClaimRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM task_claims WHERE agent_ref = ? ORDER BY created_at DESC, id DESC',
    ).all(agentRef) as Record<string, unknown>[];
    return rows.map((row) => this.parseRow(row));
  }

  listPending(): TaskClaimRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM task_claims WHERE status = 'pending' ORDER BY created_at DESC, id DESC",
    ).all() as Record<string, unknown>[];
    return rows.map((row) => this.parseRow(row));
  }

  listClaimed(): TaskClaimRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM task_claims WHERE status = 'claimed' ORDER BY claimed_at DESC, id DESC",
    ).all() as Record<string, unknown>[];
    return rows.map((row) => this.parseRow(row));
  }

  updateStatus(id: string, status: TaskClaimStatus, at: string): TaskClaimRecord | null {
    let info: { changes: number | bigint };
    if (status === 'claimed') {
      info = this.db.prepare('UPDATE task_claims SET status = ?, claimed_at = ? WHERE id = ?').run(status, at, id);
    } else if (status === 'released' || status === 'expired') {
      info = this.db.prepare('UPDATE task_claims SET status = ?, released_at = ? WHERE id = ?').run(status, at, id);
    } else {
      info = this.db.prepare('UPDATE task_claims SET status = ? WHERE id = ?').run(status, id);
    }
    if (info.changes === 0) {
      return null;
    }
    return this.getById(id);
  }

  private parseRow(row: Record<string, unknown>): TaskClaimRecord {
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      agentRef: row.agent_ref as string,
      status: row.status as TaskClaimStatus,
      claimedAt: row.claimed_at as string | null,
      releasedAt: row.released_at as string | null,
      expiresAt: row.expires_at as string | null,
      reason: row.reason as string | null,
      createdAt: row.created_at as string,
      metadata: parseJsonValue<Record<string, unknown> | null>(row.metadata, null),
    };
  }
}
