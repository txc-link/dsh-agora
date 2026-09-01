import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  EvidenceManifestRecord,
  ExecutionBaselineRecord,
  IExecutionBaselineRepository,
  IEvidenceManifestRepository,
  ITaskSpecRevisionRepository,
  TaskSpecRevisionRecord,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError } from './errors.js';
import { GovernedExecutionService } from './governed-execution-service.js';

class RevisionMemoryRepository implements ITaskSpecRevisionRepository {
  readonly records: TaskSpecRevisionRecord[] = [];
  insert(record: TaskSpecRevisionRecord) { this.records.push(record); return record; }
  getById(id: string) { return this.records.find((record) => record.id === id) ?? null; }
  getLatest(taskId: string) { return [...this.records].filter((record) => record.task_id === taskId).sort((a, b) => b.revision - a.revision)[0] ?? null; }
  getByIdempotencyKey(key: string) { return this.records.find((record) => record.idempotency_key === key) ?? null; }
  listByTask(taskId: string) { return this.records.filter((record) => record.task_id === taskId).sort((a, b) => a.revision - b.revision); }
}

class BaselineMemoryRepository implements IExecutionBaselineRepository {
  readonly records: ExecutionBaselineRecord[] = [];
  insert(record: ExecutionBaselineRecord) { this.records.push(record); return record; }
  getById(id: string) { return this.records.find((record) => record.id === id) ?? null; }
  getByIdempotencyKey(key: string) { return this.records.find((record) => record.idempotency_key === key) ?? null; }
  listByTask(taskId: string) { return this.records.filter((record) => record.task_id === taskId); }
}

class ManifestMemoryRepository implements IEvidenceManifestRepository {
  readonly records: EvidenceManifestRecord[] = [];
  insert(record: EvidenceManifestRecord) { this.records.push(record); return record; }
  getById(id: string) { return this.records.find((record) => record.id === id) ?? null; }
  getByIdempotencyKey(key: string) { return this.records.find((record) => record.idempotency_key === key) ?? null; }
  listByTask(taskId: string) { return this.records.filter((record) => record.task_id === taskId); }
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function makeService() {
  let id = 0;
  const revisions = new RevisionMemoryRepository();
  const baselines = new BaselineMemoryRepository();
  const manifests = new ManifestMemoryRepository();
  const service = new GovernedExecutionService({
    taskSpecRevisions: revisions,
    executionBaselines: baselines,
    evidenceManifests: manifests,
    idGenerator: () => `id-${++id}`,
    now: () => new Date('2026-09-01T10:00:00.000Z'),
  });
  return { service, revisions, baselines, manifests };
}

const payload = {
  title: '研究任务',
  description: '形成一页建议',
  type: 'research',
  priority: 'normal' as const,
  locale: 'zh-CN' as const,
  project_id: 'project-1',
  objective: '比较长期记忆方案',
  acceptance_criteria: ['给出推荐架构', '列出风险'],
  scope: { domain: 'company' },
  constraints: ['不泄露个人域数据'],
  context_refs: [{ kind: 'document', ref: 'doc:brief' }],
  input_artifact_refs: [],
  memory_refs: [],
};

describe('GovernedExecutionService', () => {
  it('appends immutable task revisions and enforces the parent chain', () => {
    const { service } = makeService();
    const first = service.createTaskSpecRevision({
      task_id: 'task-1', base_task_version: 1, payload, created_by: 'human:ceo', idempotency_key: 'rev-1',
    });
    expect(first.revision).toBe(1);
    expect(first.payload_digest).toMatch(/^[a-f0-9]{64}$/u);

    const second = service.createTaskSpecRevision({
      task_id: 'task-1', base_task_version: 2, parent_revision: 1,
      payload: { ...payload, objective: '比较并选择方案' }, created_by: 'human:ceo', idempotency_key: 'rev-2',
    });
    expect(second.revision).toBe(2);
    expect(() => service.createTaskSpecRevision({
      task_id: 'task-1', base_task_version: 3, parent_revision: 1,
      payload, created_by: 'human:ceo', idempotency_key: 'rev-3',
    })).toThrowError(ConflictError);
  });

  it('returns an idempotent revision only for the same request', () => {
    const { service } = makeService();
    const input = { task_id: 'task-1', base_task_version: 1, payload, created_by: 'human:ceo', idempotency_key: 'same' };
    const first = service.createTaskSpecRevision(input);
    expect(service.createTaskSpecRevision(input)).toBe(first);
    expect(() => service.createTaskSpecRevision({ ...input, payload: { ...payload, objective: 'changed' } })).toThrowError(ConflictError);
  });

  it('pins the exact task revision digest in an approved execution baseline', () => {
    const { service } = makeService();
    const revision = service.createTaskSpecRevision({
      task_id: 'task-1', base_task_version: 1, payload, created_by: 'human:ceo', idempotency_key: 'rev-1',
    });
    expect(() => service.createExecutionBaseline({
      task_id: 'task-1', task_revision_id: revision.id, task_revision_digest: digest('wrong'), plan_digest: digest('plan'),
      input_refs: [], policy_refs: [], agent_composition_refs: [], skill_adoption_refs: [], approval_refs: ['approval:1'], budget: { max_wall_clock_seconds: 600, max_tokens: 1000, max_tool_calls: 20, max_cost_usd: 2, max_external_actions: 0 },
      evidence_obligations: ['artifact:report'], approved_by: 'human:ceo', expires_at: '2026-09-02T10:00:00.000Z', idempotency_key: 'base-1',
    })).toThrowError(ConflictError);

    const baseline = service.createExecutionBaseline({
      task_id: 'task-1', task_revision_id: revision.id, task_revision_digest: revision.payload_digest, plan_digest: digest('plan'),
      input_refs: [{ kind: 'document', ref: 'doc:brief' }], approval_refs: ['approval:1'], policy_refs: ['policy:company'],
      coordination_run_ref: null, agent_composition_refs: ['agent:ea@1'], skill_adoption_refs: ['skill:research@1'],
      budget: { max_wall_clock_seconds: 600, max_tokens: 1000, max_tool_calls: 20, max_cost_usd: 2, max_external_actions: 0 },
      evidence_obligations: ['artifact:report'], approved_by: 'human:ceo', expires_at: '2026-09-02T10:00:00.000Z', idempotency_key: 'base-1',
    });
    expect(baseline.status).toBe('approved');
    expect(baseline.baseline_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(service.createExecutionBaseline({
      task_id: 'task-1', task_revision_id: revision.id, task_revision_digest: revision.payload_digest, plan_digest: digest('plan'),
      input_refs: [{ kind: 'document', ref: 'doc:brief' }], approval_refs: ['approval:1'], policy_refs: ['policy:company'],
      coordination_run_ref: null, agent_composition_refs: ['agent:ea@1'], skill_adoption_refs: ['skill:research@1'],
      budget: { max_wall_clock_seconds: 600, max_tokens: 1000, max_tool_calls: 20, max_cost_usd: 2, max_external_actions: 0 },
      evidence_obligations: ['artifact:report'], approved_by: 'human:ceo', expires_at: '2026-09-02T10:00:00.000Z', idempotency_key: 'base-1',
    })).toBe(baseline);
  });

  it('seals evidence only for the matching, active baseline', () => {
    const { service } = makeService();
    const revision = service.createTaskSpecRevision({ task_id: 'task-1', base_task_version: 1, payload, created_by: 'human:ceo', idempotency_key: 'rev-1' });
    const baseline = service.createExecutionBaseline({
      task_id: 'task-1', task_revision_id: revision.id, task_revision_digest: revision.payload_digest, plan_digest: digest('plan'),
      input_refs: [], policy_refs: [], agent_composition_refs: [], skill_adoption_refs: [], approval_refs: ['approval:1'], budget: { max_wall_clock_seconds: 600, max_tokens: null, max_tool_calls: null, max_cost_usd: null, max_external_actions: 0 },
      evidence_obligations: ['artifact:report'], approved_by: 'human:ceo', expires_at: null, idempotency_key: 'base-1',
    });
    expect(() => service.sealEvidenceManifest({
      task_id: 'task-1', task_revision_id: revision.id, execution_baseline_id: baseline.id,
      execution_baseline_digest: digest('wrong'), input_refs: [], approval_refs: [], policy_refs: [], run_refs: ['coordination:1'], output_artifact_refs: [{ kind: 'artifact', ref: 'artifact:1', digest: digest('report') }],
      created_by: 'agent:ea', idempotency_key: 'evidence-1',
    })).toThrowError(ConflictError);

    const manifest = service.sealEvidenceManifest({
      task_id: 'task-1', task_revision_id: revision.id, execution_baseline_id: baseline.id,
      execution_baseline_digest: baseline.baseline_digest, input_refs: [{ kind: 'document', ref: 'doc:brief' }], approval_refs: ['approval:1'],
      policy_refs: ['policy:company'], run_refs: ['coordination:1'], output_artifact_refs: [{ kind: 'artifact', ref: 'artifact:1', digest: digest('report') }],
      notes: 'sealed', created_by: 'agent:ea', idempotency_key: 'evidence-1',
    });
    expect(manifest.status).toBe('sealed');
    expect(manifest.manifest_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(service.sealEvidenceManifest({
      task_id: 'task-1', task_revision_id: revision.id, execution_baseline_id: baseline.id,
      execution_baseline_digest: baseline.baseline_digest, input_refs: [{ kind: 'document', ref: 'doc:brief' }], approval_refs: ['approval:1'],
      policy_refs: ['policy:company'], run_refs: ['coordination:1'], output_artifact_refs: [{ kind: 'artifact', ref: 'artifact:1', digest: digest('report') }],
      notes: 'sealed', created_by: 'agent:ea', idempotency_key: 'evidence-1',
    })).toBe(manifest);
  });

  it('raises a stable not-found error for unknown references', () => {
    const { service } = makeService();
    expect(() => service.getTaskSpecRevision('missing')).toThrowError(NotFoundError);
    expect(() => service.getExecutionBaseline('missing')).toThrowError(NotFoundError);
    expect(() => service.getEvidenceManifest('missing')).toThrowError(NotFoundError);
  });
});
