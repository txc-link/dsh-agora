import type { IPlanningBindingRepository, PlanningBinding, PlanningBindingUpsertInput, PlanningSyncMode, PlanningSyncStatus } from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';

interface PlanningBindingRow {
  task_id: string;
  domain: 'work' | 'life';
  external_task_provider: string | null;
  external_task_ref: string | null;
  external_task_project_ref: string | null;
  calendar_provider: string | null;
  calendar_event_ref: string | null;
  sync_mode: PlanningSyncMode;
  last_sync_status: PlanningSyncStatus;
  last_sync_at: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export class PlanningBindingRepository implements IPlanningBindingRepository {
  constructor(private readonly db: AgoraDatabase) {}

  upsert(input: PlanningBindingUpsertInput): PlanningBinding {
    const taskId = required(input.taskId, 'taskId');
    if (!input.externalTask && !input.calendarEvent) throw new TypeError('planning binding requires an external task or calendar event');
    const existing = this.getByTask(taskId);
    if (existing && existing.domain !== input.domain) {
      throw new Error(`planning binding domain cannot change from ${existing.domain} to ${input.domain}`);
    }
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO planning_bindings (
        task_id, domain, external_task_provider, external_task_ref, external_task_project_ref,
        calendar_provider, calendar_event_ref, sync_mode, last_sync_status,
        last_sync_at, last_sync_error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        domain = excluded.domain,
        external_task_provider = COALESCE(excluded.external_task_provider, planning_bindings.external_task_provider),
        external_task_ref = COALESCE(excluded.external_task_ref, planning_bindings.external_task_ref),
        external_task_project_ref = COALESCE(excluded.external_task_project_ref, planning_bindings.external_task_project_ref),
        calendar_provider = COALESCE(excluded.calendar_provider, planning_bindings.calendar_provider),
        calendar_event_ref = COALESCE(excluded.calendar_event_ref, planning_bindings.calendar_event_ref),
        sync_mode = excluded.sync_mode,
        updated_at = excluded.updated_at
    `).run(
      taskId, input.domain,
      input.externalTask?.provider ?? null,
      input.externalTask?.ref ?? null,
      input.externalTask?.projectRef ?? null,
      input.calendarEvent?.provider ?? null,
      input.calendarEvent?.ref ?? null,
      input.syncMode ?? existing?.syncMode ?? 'manual',
      existing?.lastSyncStatus ?? 'pending',
      existing?.lastSyncAt ?? null,
      existing?.lastSyncError ?? null,
      existing?.createdAt ?? now,
      now,
    );
    const stored = this.getByTask(taskId);
    if (!stored) throw new Error('planning binding upsert failed');
    return stored;
  }

  getByTask(taskId: string): PlanningBinding | undefined {
    const row = this.db.prepare('SELECT * FROM planning_bindings WHERE task_id = ?').get(taskId) as PlanningBindingRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  list(): readonly PlanningBinding[] {
    const rows = this.db.prepare('SELECT * FROM planning_bindings ORDER BY updated_at DESC, task_id ASC').all() as unknown as PlanningBindingRow[];
    return rows.map(mapRow);
  }

  removeByTask(taskId: string): boolean {
    return this.db.prepare('DELETE FROM planning_bindings WHERE task_id = ?').run(taskId).changes > 0;
  }

  setSyncMode(taskId: string, mode: PlanningSyncMode): PlanningBinding {
    const result = this.db.prepare(`
      UPDATE planning_bindings
      SET sync_mode = ?, last_sync_status = 'pending', last_sync_error = NULL, updated_at = ?
      WHERE task_id = ?
    `).run(mode, new Date().toISOString(), required(taskId, 'taskId'));
    if (result.changes === 0) throw new Error(`planning binding not found: ${taskId}`);
    return this.requireByTask(taskId);
  }

  recordSyncResult(taskId: string, input: { status: PlanningSyncStatus; syncedAt: string; error?: string | null }): PlanningBinding {
    const result = this.db.prepare(`
      UPDATE planning_bindings
      SET last_sync_status = ?, last_sync_at = ?, last_sync_error = ?, updated_at = ?
      WHERE task_id = ?
    `).run(input.status, input.syncedAt, input.error ?? null, input.syncedAt, required(taskId, 'taskId'));
    if (result.changes === 0) throw new Error(`planning binding not found: ${taskId}`);
    return this.requireByTask(taskId);
  }

  private requireByTask(taskId: string): PlanningBinding {
    const binding = this.getByTask(taskId);
    if (!binding) throw new Error(`planning binding not found: ${taskId}`);
    return binding;
  }
}

function mapRow(row: PlanningBindingRow): PlanningBinding {
  return Object.freeze({
    taskId: row.task_id,
    domain: row.domain,
    externalTaskProvider: row.external_task_provider,
    externalTaskRef: row.external_task_ref,
    externalTaskProjectRef: row.external_task_project_ref,
    calendarProvider: row.calendar_provider,
    calendarEventRef: row.calendar_event_ref,
    syncMode: row.sync_mode,
    lastSyncStatus: row.last_sync_status,
    lastSyncAt: row.last_sync_at,
    lastSyncError: row.last_sync_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  return normalized;
}
