import { createHash, randomUUID } from 'node:crypto';
import {
  createEvidenceManifestRequestSchema,
  createExecutionBaselineRequestSchema,
  createTaskSpecRevisionRequestSchema,
  type CreateEvidenceManifestRequestDto,
  type CreateExecutionBaselineRequestDto,
  type CreateTaskSpecRevisionRequestDto,
  type EvidenceManifestRecord,
  type ExecutionBaselineRecord,
  type IExecutionBaselineRepository,
  type IEvidenceManifestRepository,
  type ITaskSpecRevisionRepository,
  type TaskSpecRevisionRecord,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError } from './errors.js';

export interface GovernedExecutionServiceOptions {
  taskSpecRevisions: ITaskSpecRevisionRepository;
  executionBaselines: IExecutionBaselineRepository;
  evidenceManifests: IEvidenceManifestRepository;
  now?: () => Date;
  idGenerator?: () => string;
}

/**
 * Owns the immutable planning boundary between a mutable task and an execution.
 * Provider-specific adapters only receive the resulting references/digests.
 */
export class GovernedExecutionService {
  private readonly taskSpecRevisions: ITaskSpecRevisionRepository;
  private readonly executionBaselines: IExecutionBaselineRepository;
  private readonly evidenceManifests: IEvidenceManifestRepository;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;

  constructor(options: GovernedExecutionServiceOptions) {
    this.taskSpecRevisions = options.taskSpecRevisions;
    this.executionBaselines = options.executionBaselines;
    this.evidenceManifests = options.evidenceManifests;
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
  }

  createTaskSpecRevision(input: CreateTaskSpecRevisionRequestDto): TaskSpecRevisionRecord {
    const parsed = createTaskSpecRevisionRequestSchema.parse(input);
    const payloadDigest = digest(parsed.payload);
    const existing = this.taskSpecRevisions.getByIdempotencyKey(parsed.idempotency_key);
    if (existing) {
      if (
        existing.task_id !== parsed.task_id
        || existing.base_task_version !== parsed.base_task_version
        || existing.parent_revision !== (parsed.parent_revision ?? null)
        || existing.payload_digest !== payloadDigest
      ) {
        throw new ConflictError(`TaskSpecRevision idempotency key ${parsed.idempotency_key} was already used with a different request`);
      }
      return existing;
    }

    const latest = this.taskSpecRevisions.getLatest(parsed.task_id);
    const expectedParent = latest?.revision ?? null;
    const suppliedParent = parsed.parent_revision ?? null;
    if (suppliedParent !== expectedParent) {
      throw new ConflictError(
        `Task ${parsed.task_id} revision parent conflict: expected ${expectedParent ?? 'none'}, got ${suppliedParent ?? 'none'}`,
      );
    }

    const record: TaskSpecRevisionRecord = {
      id: this.idGenerator(),
      task_id: parsed.task_id,
      revision: (latest?.revision ?? 0) + 1,
      base_task_version: parsed.base_task_version,
      parent_revision: suppliedParent,
      payload: parsed.payload,
      payload_digest: payloadDigest,
      created_by: parsed.created_by,
      idempotency_key: parsed.idempotency_key,
      created_at: this.now().toISOString(),
    };
    return this.taskSpecRevisions.insert(record);
  }

  getTaskSpecRevision(id: string): TaskSpecRevisionRecord {
    const record = this.taskSpecRevisions.getById(id);
    if (!record) throw new NotFoundError(`TaskSpecRevision ${id} not found`);
    return record;
  }

  listTaskSpecRevisions(taskId: string): TaskSpecRevisionRecord[] {
    return this.taskSpecRevisions.listByTask(taskId);
  }

  createExecutionBaseline(input: CreateExecutionBaselineRequestDto): ExecutionBaselineRecord {
    const parsed = createExecutionBaselineRequestSchema.parse(input);
    const revision = this.getTaskSpecRevision(parsed.task_revision_id);
    if (revision.task_id !== parsed.task_id) {
      throw new ConflictError(`TaskSpecRevision ${parsed.task_revision_id} does not belong to task ${parsed.task_id}`);
    }
    if (revision.payload_digest !== parsed.task_revision_digest) {
      throw new ConflictError(`TaskSpecRevision ${parsed.task_revision_id} digest does not match the request`);
    }
    if (parsed.expires_at && Date.parse(parsed.expires_at) <= this.now().getTime()) {
      throw new ConflictError('ExecutionBaseline expires_at must be in the future');
    }

    const baselineDigest = digest(parsed);
    const existing = this.executionBaselines.getByIdempotencyKey(parsed.idempotency_key);
    if (existing) {
      if (existing.baseline_digest !== baselineDigest) {
        throw new ConflictError(`ExecutionBaseline idempotency key ${parsed.idempotency_key} was already used with a different request`);
      }
      return existing;
    }

    const record: ExecutionBaselineRecord = {
      id: this.idGenerator(),
      ...parsed,
      coordination_run_ref: parsed.coordination_run_ref ?? null,
      baseline_digest: baselineDigest,
      status: 'approved',
      created_at: this.now().toISOString(),
    };
    return this.executionBaselines.insert(record);
  }

  getExecutionBaseline(id: string): ExecutionBaselineRecord {
    const record = this.executionBaselines.getById(id);
    if (!record) throw new NotFoundError(`ExecutionBaseline ${id} not found`);
    return record;
  }

  listExecutionBaselines(taskId: string): ExecutionBaselineRecord[] {
    return this.executionBaselines.listByTask(taskId);
  }

  sealEvidenceManifest(input: CreateEvidenceManifestRequestDto): EvidenceManifestRecord {
    const parsed = createEvidenceManifestRequestSchema.parse(input);
    const baseline = this.getExecutionBaseline(parsed.execution_baseline_id);
    if (baseline.task_id !== parsed.task_id) {
      throw new ConflictError(`ExecutionBaseline ${parsed.execution_baseline_id} does not belong to task ${parsed.task_id}`);
    }
    if (baseline.task_revision_id !== parsed.task_revision_id) {
      throw new ConflictError('EvidenceManifest task revision does not match the execution baseline');
    }
    if (baseline.baseline_digest !== parsed.execution_baseline_digest) {
      throw new ConflictError('EvidenceManifest baseline digest does not match the execution baseline');
    }
    if (baseline.status !== 'approved') {
      throw new ConflictError(`ExecutionBaseline ${baseline.id} is ${baseline.status} and cannot seal evidence`);
    }
    if (baseline.expires_at && Date.parse(baseline.expires_at) <= this.now().getTime()) {
      throw new ConflictError(`ExecutionBaseline ${baseline.id} has expired`);
    }

    const manifestDigest = digest(parsed);
    const existing = this.evidenceManifests.getByIdempotencyKey(parsed.idempotency_key);
    if (existing) {
      if (existing.manifest_digest !== manifestDigest) {
        throw new ConflictError(`EvidenceManifest idempotency key ${parsed.idempotency_key} was already used with a different request`);
      }
      return existing;
    }

    const record: EvidenceManifestRecord = {
      id: this.idGenerator(),
      ...parsed,
      notes: parsed.notes ?? null,
      manifest_digest: manifestDigest,
      status: 'sealed',
      sealed_at: this.now().toISOString(),
    };
    return this.evidenceManifests.insert(record);
  }

  getEvidenceManifest(id: string): EvidenceManifestRecord {
    const record = this.evidenceManifests.getById(id);
    if (!record) throw new NotFoundError(`EvidenceManifest ${id} not found`);
    return record;
  }

  listEvidenceManifests(taskId: string): EvidenceManifestRecord[] {
    return this.evidenceManifests.listByTask(taskId);
  }
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
