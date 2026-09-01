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
import { GovernedExecutionService } from '@agora-ts/core';
import { buildApp } from './app.js';

class RevisionMemoryRepository implements ITaskSpecRevisionRepository {
  private readonly records: TaskSpecRevisionRecord[] = [];
  insert(record: TaskSpecRevisionRecord) { this.records.push(record); return record; }
  getById(id: string) { return this.records.find((record) => record.id === id) ?? null; }
  getLatest(taskId: string) { return [...this.records].filter((record) => record.task_id === taskId).sort((a, b) => b.revision - a.revision)[0] ?? null; }
  getByIdempotencyKey(key: string) { return this.records.find((record) => record.idempotency_key === key) ?? null; }
  listByTask(taskId: string) { return this.records.filter((record) => record.task_id === taskId).sort((a, b) => a.revision - b.revision); }
}

class BaselineMemoryRepository implements IExecutionBaselineRepository {
  private readonly records: ExecutionBaselineRecord[] = [];
  insert(record: ExecutionBaselineRecord) { this.records.push(record); return record; }
  getById(id: string) { return this.records.find((record) => record.id === id) ?? null; }
  getByIdempotencyKey(key: string) { return this.records.find((record) => record.idempotency_key === key) ?? null; }
  listByTask(taskId: string) { return this.records.filter((record) => record.task_id === taskId); }
}

class ManifestMemoryRepository implements IEvidenceManifestRepository {
  private readonly records: EvidenceManifestRecord[] = [];
  insert(record: EvidenceManifestRecord) { this.records.push(record); return record; }
  getById(id: string) { return this.records.find((record) => record.id === id) ?? null; }
  getByIdempotencyKey(key: string) { return this.records.find((record) => record.idempotency_key === key) ?? null; }
  listByTask(taskId: string) { return this.records.filter((record) => record.task_id === taskId); }
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function makeService() {
  let id = 0;
  return new GovernedExecutionService({
    taskSpecRevisions: new RevisionMemoryRepository(),
    executionBaselines: new BaselineMemoryRepository(),
    evidenceManifests: new ManifestMemoryRepository(),
    idGenerator: () => `route-id-${++id}`,
    now: () => new Date('2026-09-01T10:00:00.000Z'),
  });
}

const taskPayload = {
  title: '研究任务',
  description: '形成一页建议',
  type: 'research',
  priority: 'normal',
  locale: 'zh-CN',
  project_id: null,
  objective: '比较长期记忆方案',
  acceptance_criteria: ['给出推荐架构'],
  scope: {},
  constraints: [],
  context_refs: [],
  input_artifact_refs: [],
  memory_refs: [],
};

describe('governed execution routes', () => {
  it('creates and lists the immutable execution chain', async () => {
    const app = buildApp({ governedExecutionService: makeService() });
    const revisionResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks/task-1/spec-revisions',
      payload: {
        base_task_version: 1,
        payload: taskPayload,
        created_by: 'human:ceo',
        idempotency_key: 'revision-1',
      },
    });
    expect(revisionResponse.statusCode).toBe(201);
    const revision = revisionResponse.json();

    const revisionList = await app.inject({ method: 'GET', url: '/api/tasks/task-1/spec-revisions' });
    expect(revisionList.statusCode).toBe(200);
    expect(revisionList.json().revisions).toHaveLength(1);

    const baselineResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks/task-1/execution-baselines',
      payload: {
        task_revision_id: revision.id,
        task_revision_digest: revision.payload_digest,
        plan_digest: digest('plan'),
        approval_refs: ['approval:ceo'],
        budget: {
          max_wall_clock_seconds: 600,
          max_tokens: 1000,
          max_tool_calls: 20,
          max_cost_usd: 2,
          max_external_actions: 0,
        },
        evidence_obligations: ['artifact:report'],
        expires_at: null,
        approved_by: 'human:ceo',
        idempotency_key: 'baseline-1',
      },
    });
    expect(baselineResponse.statusCode).toBe(201);
    const baseline = baselineResponse.json();

    const manifestResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks/task-1/evidence-manifests',
      payload: {
        task_revision_id: revision.id,
        execution_baseline_id: baseline.id,
        execution_baseline_digest: baseline.baseline_digest,
        run_refs: ['run:1'],
        output_artifact_refs: [{ kind: 'artifact', ref: 'artifact:1', digest: digest('report') }],
        created_by: 'agent:ea',
        idempotency_key: 'evidence-1',
      },
    });
    expect(manifestResponse.statusCode).toBe(201);
    expect(manifestResponse.json().status).toBe('sealed');

    const manifestList = await app.inject({ method: 'GET', url: '/api/tasks/task-1/evidence-manifests' });
    expect(manifestList.statusCode).toBe(200);
    expect(manifestList.json().manifests).toHaveLength(1);
    await app.close();
  });

  it('does not accept a payload reviewer when human approval is configured', async () => {
    const app = buildApp({
      governedExecutionService: makeService(),
      apiAuth: { enabled: true, token: 'server-token' },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks/task-1/execution-baselines',
      headers: { authorization: 'Bearer server-token' },
      payload: { approved_by: 'spoofed-reviewer' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().message).toContain('dashboard human actor');
    await app.close();
  });
});
