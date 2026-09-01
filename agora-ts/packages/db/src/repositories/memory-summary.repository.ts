import { taskMemorySummarySchema, type ITaskMemorySummaryRepository, type TaskMemorySummaryDto } from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';

type Row = Record<string, unknown>;

export class TaskMemorySummaryRepository implements ITaskMemorySummaryRepository {
  constructor(private readonly db: AgoraDatabase) {}

  getByTaskFingerprint(taskId: string, fingerprint: string): TaskMemorySummaryDto | null {
    const row = this.db.prepare('SELECT * FROM task_memory_summaries WHERE task_id = ? AND fingerprint = ?').get(taskId, fingerprint) as Row | undefined;
    return row ? parseRow(row) : null;
  }

  insert(record: TaskMemorySummaryDto): TaskMemorySummaryDto {
    this.db.prepare(`INSERT INTO task_memory_summaries
      (id, task_id, scope_ref, fingerprint, memory_id, status, error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(record.id, record.task_id, record.scope_ref, record.fingerprint, record.memory_id, record.status, record.error, record.created_at, record.updated_at);
    return this.getByTaskFingerprint(record.task_id, record.fingerprint)!;
  }

  markSucceeded(id: string, memoryId: string, updatedAt: string): TaskMemorySummaryDto | null {
    this.db.prepare(`UPDATE task_memory_summaries SET status = 'succeeded', memory_id = ?, error = NULL, updated_at = ? WHERE id = ?`)
      .run(memoryId, updatedAt, id);
    return this.getById(id);
  }

  markFailed(id: string, error: string, updatedAt: string): TaskMemorySummaryDto | null {
    this.db.prepare(`UPDATE task_memory_summaries SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`)
      .run(error, updatedAt, id);
    return this.getById(id);
  }

  listByTask(taskId: string): TaskMemorySummaryDto[] {
    return (this.db.prepare('SELECT * FROM task_memory_summaries WHERE task_id = ? ORDER BY created_at DESC').all(taskId) as Row[]).map(parseRow);
  }

  private getById(id: string): TaskMemorySummaryDto | null {
    const row = this.db.prepare('SELECT * FROM task_memory_summaries WHERE id = ?').get(id) as Row | undefined;
    return row ? parseRow(row) : null;
  }
}

function parseRow(row: Row): TaskMemorySummaryDto {
  return taskMemorySummarySchema.parse({
    id: String(row.id), task_id: String(row.task_id), scope_ref: String(row.scope_ref), fingerprint: String(row.fingerprint),
    memory_id: row.memory_id === null ? null : String(row.memory_id), status: String(row.status), error: row.error === null ? null : String(row.error),
    created_at: String(row.created_at), updated_at: String(row.updated_at),
  });
}
