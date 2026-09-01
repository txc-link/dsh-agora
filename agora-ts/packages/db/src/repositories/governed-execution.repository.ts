import {
  evidenceManifestSchema,
  executionBaselineSchema,
  taskSpecRevisionSchema,
  type EvidenceManifestDto,
  type ExecutionBaselineDto,
  type TaskSpecRevisionDto,
  type IEvidenceManifestRepository,
  type IExecutionBaselineRepository,
  type ITaskSpecRevisionRepository,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

type Row = Record<string, unknown>;

export class TaskSpecRevisionRepository implements ITaskSpecRevisionRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: TaskSpecRevisionDto): TaskSpecRevisionDto {
    this.db.prepare(`
      INSERT INTO task_spec_revisions (
        id, task_id, revision, base_task_version, parent_revision, payload,
        payload_digest, created_by, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.task_id,
      record.revision,
      record.base_task_version,
      record.parent_revision ?? null,
      stringifyJsonValue(record.payload),
      record.payload_digest,
      record.created_by,
      record.idempotency_key,
      record.created_at,
    );
    return this.getById(record.id) as TaskSpecRevisionDto;
  }

  getById(id: string): TaskSpecRevisionDto | null {
    const row = this.db.prepare('SELECT * FROM task_spec_revisions WHERE id = ?').get(id) as Row | undefined;
    return row ? parseTaskSpecRevision(row) : null;
  }

  getLatest(taskId: string): TaskSpecRevisionDto | null {
    const row = this.db.prepare(`
      SELECT * FROM task_spec_revisions WHERE task_id = ? ORDER BY revision DESC LIMIT 1
    `).get(taskId) as Row | undefined;
    return row ? parseTaskSpecRevision(row) : null;
  }

  getByIdempotencyKey(key: string): TaskSpecRevisionDto | null {
    const row = this.db.prepare('SELECT * FROM task_spec_revisions WHERE idempotency_key = ?').get(key) as Row | undefined;
    return row ? parseTaskSpecRevision(row) : null;
  }

  listByTask(taskId: string): TaskSpecRevisionDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM task_spec_revisions WHERE task_id = ? ORDER BY revision ASC
    `).all(taskId) as Row[];
    return rows.map(parseTaskSpecRevision);
  }
}

export class ExecutionBaselineRepository implements IExecutionBaselineRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: ExecutionBaselineDto): ExecutionBaselineDto {
    this.db.prepare(`
      INSERT INTO execution_baselines (
        id, task_id, task_revision_id, task_revision_digest, plan_digest, input_refs,
        approval_refs, policy_refs, coordination_run_ref, agent_composition_refs,
        skill_adoption_refs, budget, evidence_obligations, expires_at, approved_by,
        baseline_digest, status, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.task_id,
      record.task_revision_id,
      record.task_revision_digest,
      record.plan_digest,
      stringifyJsonValue(record.input_refs),
      stringifyJsonValue(record.approval_refs),
      stringifyJsonValue(record.policy_refs),
      record.coordination_run_ref ?? null,
      stringifyJsonValue(record.agent_composition_refs),
      stringifyJsonValue(record.skill_adoption_refs),
      stringifyJsonValue(record.budget),
      stringifyJsonValue(record.evidence_obligations),
      record.expires_at,
      record.approved_by,
      record.baseline_digest,
      record.status,
      record.idempotency_key,
      record.created_at,
    );
    return this.getById(record.id) as ExecutionBaselineDto;
  }

  getById(id: string): ExecutionBaselineDto | null {
    const row = this.db.prepare('SELECT * FROM execution_baselines WHERE id = ?').get(id) as Row | undefined;
    return row ? parseExecutionBaseline(row) : null;
  }

  getByIdempotencyKey(key: string): ExecutionBaselineDto | null {
    const row = this.db.prepare('SELECT * FROM execution_baselines WHERE idempotency_key = ?').get(key) as Row | undefined;
    return row ? parseExecutionBaseline(row) : null;
  }

  listByTask(taskId: string): ExecutionBaselineDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM execution_baselines WHERE task_id = ? ORDER BY created_at ASC, id ASC
    `).all(taskId) as Row[];
    return rows.map(parseExecutionBaseline);
  }
}

export class EvidenceManifestRepository implements IEvidenceManifestRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: EvidenceManifestDto): EvidenceManifestDto {
    this.db.prepare(`
      INSERT INTO evidence_manifests (
        id, task_id, task_revision_id, execution_baseline_id, execution_baseline_digest,
        input_refs, approval_refs, policy_refs, run_refs, output_artifact_refs, notes,
        created_by, manifest_digest, status, idempotency_key, sealed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.task_id,
      record.task_revision_id,
      record.execution_baseline_id,
      record.execution_baseline_digest,
      stringifyJsonValue(record.input_refs),
      stringifyJsonValue(record.approval_refs),
      stringifyJsonValue(record.policy_refs),
      stringifyJsonValue(record.run_refs),
      stringifyJsonValue(record.output_artifact_refs),
      record.notes ?? null,
      record.created_by,
      record.manifest_digest,
      record.status,
      record.idempotency_key,
      record.sealed_at,
    );
    return this.getById(record.id) as EvidenceManifestDto;
  }

  getById(id: string): EvidenceManifestDto | null {
    const row = this.db.prepare('SELECT * FROM evidence_manifests WHERE id = ?').get(id) as Row | undefined;
    return row ? parseEvidenceManifest(row) : null;
  }

  getByIdempotencyKey(key: string): EvidenceManifestDto | null {
    const row = this.db.prepare('SELECT * FROM evidence_manifests WHERE idempotency_key = ?').get(key) as Row | undefined;
    return row ? parseEvidenceManifest(row) : null;
  }

  listByTask(taskId: string): EvidenceManifestDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM evidence_manifests WHERE task_id = ? ORDER BY sealed_at ASC, id ASC
    `).all(taskId) as Row[];
    return rows.map(parseEvidenceManifest);
  }
}

function parseTaskSpecRevision(row: Row): TaskSpecRevisionDto {
  return taskSpecRevisionSchema.parse({
    id: String(row.id),
    task_id: String(row.task_id),
    revision: Number(row.revision),
    base_task_version: Number(row.base_task_version),
    parent_revision: row.parent_revision === null ? null : Number(row.parent_revision),
    payload: parseJsonValue(row.payload, {}),
    payload_digest: String(row.payload_digest),
    created_by: String(row.created_by),
    idempotency_key: String(row.idempotency_key),
    created_at: String(row.created_at),
  });
}

function parseExecutionBaseline(row: Row): ExecutionBaselineDto {
  return executionBaselineSchema.parse({
    id: String(row.id),
    task_id: String(row.task_id),
    task_revision_id: String(row.task_revision_id),
    task_revision_digest: String(row.task_revision_digest),
    plan_digest: String(row.plan_digest),
    input_refs: parseJsonValue(row.input_refs, []),
    approval_refs: parseJsonValue(row.approval_refs, []),
    policy_refs: parseJsonValue(row.policy_refs, []),
    coordination_run_ref: row.coordination_run_ref === null ? null : String(row.coordination_run_ref),
    agent_composition_refs: parseJsonValue(row.agent_composition_refs, []),
    skill_adoption_refs: parseJsonValue(row.skill_adoption_refs, []),
    budget: parseJsonValue(row.budget, {}),
    evidence_obligations: parseJsonValue(row.evidence_obligations, []),
    expires_at: row.expires_at === null ? null : String(row.expires_at),
    approved_by: String(row.approved_by),
    baseline_digest: String(row.baseline_digest),
    status: String(row.status),
    idempotency_key: String(row.idempotency_key),
    created_at: String(row.created_at),
  });
}

function parseEvidenceManifest(row: Row): EvidenceManifestDto {
  return evidenceManifestSchema.parse({
    id: String(row.id),
    task_id: String(row.task_id),
    task_revision_id: String(row.task_revision_id),
    execution_baseline_id: String(row.execution_baseline_id),
    execution_baseline_digest: String(row.execution_baseline_digest),
    input_refs: parseJsonValue(row.input_refs, []),
    approval_refs: parseJsonValue(row.approval_refs, []),
    policy_refs: parseJsonValue(row.policy_refs, []),
    run_refs: parseJsonValue(row.run_refs, []),
    output_artifact_refs: parseJsonValue(row.output_artifact_refs, []),
    notes: row.notes === null ? null : String(row.notes),
    created_by: String(row.created_by),
    manifest_digest: String(row.manifest_digest),
    status: String(row.status),
    idempotency_key: String(row.idempotency_key),
    sealed_at: String(row.sealed_at),
  });
}
