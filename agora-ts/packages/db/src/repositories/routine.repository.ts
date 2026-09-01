import { randomUUID } from 'node:crypto';
import { routineRunSchema, routineSchema, type IRoutineRepository, type RoutineDto, type RoutineRunDto, type RoutineStatusDto, type RoutineDeliveryStatusDto } from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

type Row = Record<string, unknown>;

export class RoutineRepository implements IRoutineRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: RoutineDto): RoutineDto {
    this.db.prepare(`INSERT INTO routines
      (routine_id, owner_ref, agent_ref, role_ref, name, prompt, schedule, first_run_at, next_run_at, last_run_at,
       target_domain, delivery_binding_ref, status, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(record.routine_id, record.owner_ref, record.agent_ref, record.role_ref, record.name, record.prompt,
        stringifyJsonValue(record.schedule), record.first_run_at, record.next_run_at, record.last_run_at,
        record.target_domain, record.delivery_binding_ref, record.status, stringifyJsonValue(record.metadata), record.created_at, record.updated_at);
    return this.getById(record.routine_id)!;
  }

  getById(routineId: string): RoutineDto | null {
    const row = this.db.prepare('SELECT * FROM routines WHERE routine_id = ?').get(routineId) as Row | undefined;
    return row ? parseRoutine(row) : null;
  }

  list(filters: { owner_ref?: string; agent_ref?: string; status?: RoutineStatusDto } = {}): RoutineDto[] {
    const clauses: string[] = []; const params: string[] = [];
    if (filters.owner_ref) { clauses.push('owner_ref = ?'); params.push(filters.owner_ref); }
    if (filters.agent_ref) { clauses.push('agent_ref = ?'); params.push(filters.agent_ref); }
    if (filters.status) { clauses.push('status = ?'); params.push(filters.status); }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    return (this.db.prepare(`SELECT * FROM routines${where} ORDER BY next_run_at, routine_id`).all(...params) as Row[]).map(parseRoutine);
  }

  updateStatus(routineId: string, status: RoutineStatusDto, updatedAt: string): RoutineDto | null {
    this.db.prepare('UPDATE routines SET status = ?, updated_at = ? WHERE routine_id = ?').run(status, updatedAt, routineId);
    return this.getById(routineId);
  }

  claimDue(input: { now: string; consumer_ref: string; lease_expires_at: string; limit: number; lease_token_factory: () => string }): RoutineRunDto[] {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const due = this.db.prepare(`SELECT * FROM routines WHERE status = 'active' AND next_run_at <= ? ORDER BY next_run_at, routine_id LIMIT ?`)
        .all(input.now, input.limit) as Row[];
      const claimed: RoutineRunDto[] = [];
      for (const row of due) {
        const routine = parseRoutine(row);
        const runId = randomUUID();
        const lease = input.lease_token_factory();
        const createdAt = input.now;
        this.db.prepare(`INSERT OR IGNORE INTO routine_runs
          (id, routine_id, scheduled_for, status, consumer_ref, lease_token, lease_expires_at, attempt_count, error, runtime_dispatch_id, result, artifact_id, delivery_status, delivery_error, created_at, updated_at)
          VALUES (?, ?, ?, 'claimed', ?, ?, ?, 1, NULL, NULL, NULL, NULL, 'pending', NULL, ?, ?)`)
          .run(runId, routine.routine_id, routine.next_run_at, input.consumer_ref, lease, input.lease_expires_at, createdAt, createdAt);
        const next = nextRunAfter(routine, new Date(routine.next_run_at));
        this.db.prepare('UPDATE routines SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE routine_id = ? AND next_run_at = ?')
          .run(routine.next_run_at, next, input.now, routine.routine_id, routine.next_run_at);
        const inserted = this.db.prepare('SELECT * FROM routine_runs WHERE routine_id = ? AND scheduled_for = ?').get(routine.routine_id, routine.next_run_at) as Row | undefined;
        if (inserted) claimed.push(parseRun(inserted));
      }
      this.db.exec('COMMIT');
      return claimed;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  reclaimExpired(now: string, updatedAt: string, limit = 20): number {
    const rows = this.db.prepare("SELECT id, routine_id, scheduled_for FROM routine_runs WHERE status = 'claimed' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ? ORDER BY lease_expires_at LIMIT ?").all(now, limit) as Row[];
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of rows) {
        this.db.prepare("UPDATE routine_runs SET status = 'failed', error = 'routine lease expired; reclaimed', lease_token = NULL, lease_expires_at = NULL, updated_at = ? WHERE id = ? AND status = 'claimed' AND lease_expires_at <= ?").run(updatedAt, String(row.id), now);
        this.db.prepare("UPDATE routines SET next_run_at = CASE WHEN next_run_at > ? THEN ? ELSE next_run_at END, updated_at = ? WHERE routine_id = ?").run(String(row.scheduled_for), String(row.scheduled_for), updatedAt, String(row.routine_id));
      }
      this.db.exec('COMMIT'); return rows.length;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  attachDispatch(id: string, leaseToken: string, dispatchId: string, updatedAt: string): RoutineRunDto | null {
    const updated = this.db.prepare("UPDATE routine_runs SET runtime_dispatch_id = ?, updated_at = ? WHERE id = ? AND status = 'claimed' AND lease_token = ?")
      .run(dispatchId, updatedAt, id, leaseToken);
    if (updated.changes === 0) return null;
    return this.getRun(id);
  }

  markSucceeded(id: string, leaseToken: string, updatedAt: string, result: Record<string, unknown> | null = null): RoutineRunDto | null {
    const updated = this.db.prepare("UPDATE routine_runs SET status = 'succeeded', result = ?, lease_expires_at = NULL, updated_at = ? WHERE id = ? AND status = 'claimed' AND lease_token = ?")
      .run(stringifyJsonValue(result), updatedAt, id, leaseToken);
    if (updated.changes === 0) return null;
    return this.getRun(id);
  }

  markFailed(id: string, leaseToken: string, error: string, updatedAt: string): RoutineRunDto | null {
    const updated = this.db.prepare("UPDATE routine_runs SET status = 'failed', error = ?, lease_expires_at = NULL, updated_at = ? WHERE id = ? AND status = 'claimed' AND lease_token = ?")
      .run(error, updatedAt, id, leaseToken);
    if (updated.changes === 0) return null;
    return this.getRun(id);
  }

  updateArtifact(id: string, artifactId: string, updatedAt: string): RoutineRunDto | null {
    this.db.prepare('UPDATE routine_runs SET artifact_id = ?, updated_at = ? WHERE id = ?').run(artifactId, updatedAt, id);
    return this.getRun(id);
  }

  updateDelivery(id: string, status: RoutineDeliveryStatusDto, error: string | null, updatedAt: string): RoutineRunDto | null {
    this.db.prepare('UPDATE routine_runs SET delivery_status = ?, delivery_error = ?, updated_at = ? WHERE id = ?')
      .run(status, error, updatedAt, id);
    return this.getRun(id);
  }

  listRuns(filters: { routine_id?: string; status?: RoutineRunDto['status']; delivery_status?: RoutineDeliveryStatusDto } = {}): RoutineRunDto[] {
    const clauses: string[] = []; const params: string[] = [];
    if (filters.routine_id) { clauses.push('routine_id = ?'); params.push(filters.routine_id); }
    if (filters.status) { clauses.push('status = ?'); params.push(filters.status); }
    if (filters.delivery_status) { clauses.push('delivery_status = ?'); params.push(filters.delivery_status); }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    return (this.db.prepare(`SELECT * FROM routine_runs${where} ORDER BY scheduled_for DESC, id DESC`).all(...params) as Row[]).map(parseRun);
  }

  private getRun(id: string): RoutineRunDto | null {
    const row = this.db.prepare('SELECT * FROM routine_runs WHERE id = ?').get(id) as Row | undefined;
    return row ? parseRun(row) : null;
  }
}

function parseRoutine(row: Row): RoutineDto {
  return routineSchema.parse({
    routine_id: String(row.routine_id), owner_ref: String(row.owner_ref), agent_ref: String(row.agent_ref), role_ref: String(row.role_ref),
    name: String(row.name), prompt: String(row.prompt), schedule: parseJsonValue(row.schedule, {}), first_run_at: String(row.first_run_at),
    next_run_at: String(row.next_run_at), last_run_at: row.last_run_at === null ? null : String(row.last_run_at),
    target_domain: String(row.target_domain), delivery_binding_ref: String(row.delivery_binding_ref), status: String(row.status),
    metadata: parseJsonValue(row.metadata, {}), created_at: String(row.created_at), updated_at: String(row.updated_at),
  });
}

function parseRun(row: Row): RoutineRunDto {
  return routineRunSchema.parse({
    id: String(row.id), routine_id: String(row.routine_id), scheduled_for: String(row.scheduled_for), status: String(row.status),
    consumer_ref: row.consumer_ref === null ? null : String(row.consumer_ref), lease_token: row.lease_token === null ? null : String(row.lease_token),
    lease_expires_at: row.lease_expires_at === null ? null : String(row.lease_expires_at), attempt_count: Number(row.attempt_count),
    runtime_dispatch_id: row.runtime_dispatch_id === null || row.runtime_dispatch_id === undefined ? null : String(row.runtime_dispatch_id),
    result: parseJsonValue(row.result, null), artifact_id: row.artifact_id === null || row.artifact_id === undefined ? null : String(row.artifact_id),
    delivery_status: row.delivery_status === undefined || row.delivery_status === null ? 'pending' : String(row.delivery_status),
    delivery_error: row.delivery_error === null || row.delivery_error === undefined ? null : String(row.delivery_error),
    error: row.error === null ? null : String(row.error), created_at: String(row.created_at), updated_at: String(row.updated_at),
  });
}

function nextRunAfter(routine: RoutineDto, scheduled: Date): string {
  if (routine.schedule.kind === 'interval') return new Date(scheduled.getTime() + routine.schedule.interval_seconds * 1_000).toISOString();
  try {
    const current = zonedParts(scheduled, routine.schedule.timezone);
    const nextLocalDate = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
    const [hour, minute] = routine.schedule.local_time.split(':').map(Number);
    const utcGuess = Date.UTC(nextLocalDate.getUTCFullYear(), nextLocalDate.getUTCMonth(), nextLocalDate.getUTCDate(), hour, minute);
    const observed = zonedParts(new Date(utcGuess), routine.schedule.timezone);
    const observedLocalMs = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute);
    return new Date(utcGuess - (observedLocalMs - utcGuess)).toISOString();
  } catch {
    // Invalid IANA zone should be caught by deployment validation; keep the
    // run recoverable rather than stopping the entire routine worker.
    return new Date(scheduled.getTime() + 86_400_000).toISOString();
  }
}

function zonedParts(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  return { year: values.year!, month: values.month!, day: values.day!, hour: values.hour!, minute: values.minute! };
}
