/**
 * thread-task-binding.repository.ts — Phase 4 (R-C / T-1.5) SQLite binding store.
 *
 * Unique constraints (enforced by migration 034):
 *   - thread_key PRIMARY KEY
 *   - task_id UNIQUE
 *
 * Repo's bind() handles rebind by deleting the previous row for either
 * side atomically inside a transaction (preserves the prior createdAt
 * when threadKey matches).
 */

import type {
  IThreadTaskBindingRepository,
  ThreadTaskBinding,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';

interface BindingRow {
  thread_key: string;
  task_id: string;
  created_at: string;
  updated_at: string;
}

export class ThreadTaskBindingRepository implements IThreadTaskBindingRepository {
  public constructor(private readonly db: AgoraDatabase) {}

  public bind(input: { threadKey: string; taskId: string }): ThreadTaskBinding {
    const now = new Date().toISOString();
    const existing = this.getRowByThreadKey(input.threadKey);
    const priorCreatedAt = existing?.createdAt ?? now;

    // Drop any row currently bound to this taskId (UNIQUE enforcement + rebind).
    this.db.prepare('DELETE FROM thread_task_bindings WHERE task_id = ?').run(input.taskId);
    // Drop any row currently bound to this threadKey (PRIMARY KEY enforcement).
    this.db.prepare('DELETE FROM thread_task_bindings WHERE thread_key = ?').run(input.threadKey);
    this.db.prepare(`
      INSERT INTO thread_task_bindings (thread_key, task_id, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(input.threadKey, input.taskId, priorCreatedAt, now);

    const stored = this.getRowByThreadKey(input.threadKey);
    if (!stored) {
      throw new Error('thread_task_binding insert failed: reload returned null');
    }
    return stored;
  }

  public unbindByThreadKey(threadKey: string): boolean {
    const info = this.db.prepare('DELETE FROM thread_task_bindings WHERE thread_key = ?').run(threadKey);
    return info.changes > 0;
  }

  public unbindByTask(taskId: string): boolean {
    const info = this.db.prepare('DELETE FROM thread_task_bindings WHERE task_id = ?').run(taskId);
    return info.changes > 0;
  }

  public getByTask(taskId: string): ThreadTaskBinding | undefined {
    return this.getRowByTask(taskId);
  }

  public getByThreadKey(threadKey: string): ThreadTaskBinding | undefined {
    return this.getRowByThreadKey(threadKey);
  }

  public list(): readonly ThreadTaskBinding[] {
    const rows = this.db.prepare(
      'SELECT * FROM thread_task_bindings ORDER BY created_at DESC, thread_key ASC',
    ).all() as unknown as BindingRow[];
    return rows.map((row) => this.parseRow(row));
  }

  private getRowByThreadKey(threadKey: string): ThreadTaskBinding | undefined {
    const row = this.db.prepare(
      'SELECT * FROM thread_task_bindings WHERE thread_key = ?',
    ).get(threadKey) as BindingRow | undefined;
    return row ? this.parseRow(row) : undefined;
  }

  private getRowByTask(taskId: string): ThreadTaskBinding | undefined {
    const row = this.db.prepare(
      'SELECT * FROM thread_task_bindings WHERE task_id = ?',
    ).get(taskId) as BindingRow | undefined;
    return row ? this.parseRow(row) : undefined;
  }

  private parseRow(row: BindingRow): ThreadTaskBinding {
    return Object.freeze({
      threadKey: row.thread_key,
      taskId: row.task_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}