import {
  actionAttemptSchema,
  actionReceiptSchema,
  type ActionAttemptDto,
  type ActionReceiptDto,
  type IActionAttemptRepository,
  type IActionReceiptRepository,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

type Row = Record<string, unknown>;

export class ActionAttemptRepository implements IActionAttemptRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: ActionAttemptDto): ActionAttemptDto {
    this.db.prepare(`
      INSERT INTO action_attempts (
        id, task_id, collaboration_plan_id, execution_baseline_id, delegation_authority_id,
        subtask_spec_id, actor_ref, action, subject_ref, decision, decision_reason,
        attempt_digest, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.task_id,
      record.collaboration_plan_id,
      record.execution_baseline_id,
      record.delegation_authority_id,
      record.subtask_spec_id,
      record.actor_ref,
      record.action,
      record.subject_ref,
      record.decision,
      record.decision_reason,
      record.attempt_digest,
      record.idempotency_key,
      record.created_at,
    );
    return this.getById(record.id) as ActionAttemptDto;
  }

  getById(id: string): ActionAttemptDto | null {
    const row = this.db.prepare('SELECT * FROM action_attempts WHERE id = ?').get(id) as Row | undefined;
    return row ? parseAttempt(row) : null;
  }

  getByIdempotencyKey(key: string): ActionAttemptDto | null {
    const row = this.db.prepare('SELECT * FROM action_attempts WHERE idempotency_key = ?').get(key) as Row | undefined;
    return row ? parseAttempt(row) : null;
  }

  listByTask(taskId: string): ActionAttemptDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM action_attempts WHERE task_id = ? ORDER BY created_at ASC, id ASC
    `).all(taskId) as Row[];
    return rows.map(parseAttempt);
  }
}

export class ActionReceiptRepository implements IActionReceiptRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: ActionReceiptDto): ActionReceiptDto {
    this.db.prepare(`
      INSERT INTO action_receipts (
        id, task_id, attempt_id, outcome, provider_ref, evidence_refs, error_code,
        summary, receipt_digest, created_by, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.task_id,
      record.attempt_id,
      record.outcome,
      record.provider_ref,
      stringifyJsonValue(record.evidence_refs),
      record.error_code,
      record.summary,
      record.receipt_digest,
      record.created_by,
      record.idempotency_key,
      record.created_at,
    );
    return this.getById(record.id) as ActionReceiptDto;
  }

  getById(id: string): ActionReceiptDto | null {
    const row = this.db.prepare('SELECT * FROM action_receipts WHERE id = ?').get(id) as Row | undefined;
    return row ? parseReceipt(row) : null;
  }

  getByAttemptId(attemptId: string): ActionReceiptDto | null {
    const row = this.db.prepare('SELECT * FROM action_receipts WHERE attempt_id = ?').get(attemptId) as Row | undefined;
    return row ? parseReceipt(row) : null;
  }

  getByIdempotencyKey(key: string): ActionReceiptDto | null {
    const row = this.db.prepare('SELECT * FROM action_receipts WHERE idempotency_key = ?').get(key) as Row | undefined;
    return row ? parseReceipt(row) : null;
  }

  listByTask(taskId: string): ActionReceiptDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM action_receipts WHERE task_id = ? ORDER BY created_at ASC, id ASC
    `).all(taskId) as Row[];
    return rows.map(parseReceipt);
  }
}

function parseAttempt(row: Row): ActionAttemptDto {
  return actionAttemptSchema.parse({
    id: String(row.id),
    task_id: String(row.task_id),
    collaboration_plan_id: row.collaboration_plan_id === null ? null : String(row.collaboration_plan_id),
    execution_baseline_id: row.execution_baseline_id === null ? null : String(row.execution_baseline_id),
    delegation_authority_id: row.delegation_authority_id === null ? null : String(row.delegation_authority_id),
    subtask_spec_id: row.subtask_spec_id === null ? null : String(row.subtask_spec_id),
    actor_ref: String(row.actor_ref),
    action: String(row.action),
    subject_ref: String(row.subject_ref),
    decision: String(row.decision),
    decision_reason: String(row.decision_reason),
    attempt_digest: String(row.attempt_digest),
    idempotency_key: String(row.idempotency_key),
    created_at: String(row.created_at),
  });
}

function parseReceipt(row: Row): ActionReceiptDto {
  return actionReceiptSchema.parse({
    id: String(row.id),
    task_id: String(row.task_id),
    attempt_id: String(row.attempt_id),
    outcome: String(row.outcome),
    provider_ref: row.provider_ref === null ? null : String(row.provider_ref),
    evidence_refs: parseJsonValue(row.evidence_refs, []),
    error_code: row.error_code === null ? null : String(row.error_code),
    summary: row.summary === null ? null : String(row.summary),
    receipt_digest: String(row.receipt_digest),
    created_by: String(row.created_by),
    idempotency_key: String(row.idempotency_key),
    created_at: String(row.created_at),
  });
}
