import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ExecutionBaselineDto, EvidenceManifestDto, TaskSpecRevisionDto } from '@agora-ts/contracts';
import { createAgoraDatabase, runMigrations } from './database.js';
import { ExecutionBaselineRepository, EvidenceManifestRepository, TaskSpecRevisionRepository } from './repositories/governed-execution.repository.js';
import { TaskRepository } from './repositories/task.repository.js';

const tempPaths: string[] = [];
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function makeDb() {
  const dir = mkdtempSync(join(tmpdir(), 'agora-governed-execution-'));
  tempPaths.push(dir);
  const db = createAgoraDatabase({ dbPath: join(dir, 'agora.db') });
  runMigrations(db);
  new TaskRepository(db).insertTask({
    id: 'task-1', title: '研究任务', description: null, type: 'research', priority: 'normal', creator: 'human:ceo', locale: 'zh-CN',
    team: { members: [] }, workflow: { stages: [] }, control: { mode: 'normal' },
  });
  return db;
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const revision: TaskSpecRevisionDto = {
  id: 'revision-1', task_id: 'task-1', revision: 1, base_task_version: 1, parent_revision: null,
  payload: {
    title: '研究任务', description: null, type: 'research', priority: 'normal', locale: 'zh-CN', project_id: null,
    objective: '比较记忆方案', acceptance_criteria: ['输出建议'], scope: {}, constraints: [], context_refs: [], input_artifact_refs: [], memory_refs: [],
  }, payload_digest: digest('payload'), created_by: 'human:ceo', idempotency_key: 'revision-key', created_at: '2026-09-01T10:00:00.000Z',
};

const baseline: ExecutionBaselineDto = {
  id: 'baseline-1', task_id: 'task-1', task_revision_id: 'revision-1', task_revision_digest: revision.payload_digest, plan_digest: digest('plan'),
  input_refs: [], approval_refs: ['approval:1'], policy_refs: [], coordination_run_ref: null, agent_composition_refs: [], skill_adoption_refs: [],
  budget: { max_wall_clock_seconds: 600, max_tokens: null, max_tool_calls: null, max_cost_usd: null, max_external_actions: 0 },
  evidence_obligations: ['artifact:report'], expires_at: null, approved_by: 'human:ceo', baseline_digest: digest('baseline'),
  status: 'approved', idempotency_key: 'baseline-key', created_at: '2026-09-01T10:00:00.000Z',
};

const manifest: EvidenceManifestDto = {
  id: 'manifest-1', task_id: 'task-1', task_revision_id: 'revision-1', execution_baseline_id: 'baseline-1', execution_baseline_digest: baseline.baseline_digest,
  input_refs: [], approval_refs: ['approval:1'], policy_refs: [], run_refs: ['run:1'], output_artifact_refs: [{ kind: 'artifact', ref: 'artifact:1', digest: digest('report') }],
  notes: null, created_by: 'agent:ea', manifest_digest: digest('manifest'), status: 'sealed', idempotency_key: 'manifest-key', sealed_at: '2026-09-01T10:10:00.000Z',
};

describe('governed execution repositories', () => {
  it('round-trips immutable revision, baseline and evidence records', () => {
    const db = makeDb();
    try {
      const revisions = new TaskSpecRevisionRepository(db);
      const baselines = new ExecutionBaselineRepository(db);
      const manifests = new EvidenceManifestRepository(db);

      expect(revisions.insert(revision)).toEqual(revision);
      expect(revisions.getById('revision-1')).toEqual(revision);
      expect(revisions.getByIdempotencyKey('revision-key')).toEqual(revision);
      expect(revisions.getLatest('task-1')).toEqual(revision);

      expect(baselines.insert(baseline)).toEqual(baseline);
      expect(baselines.getById('baseline-1')).toEqual(baseline);
      expect(baselines.getByIdempotencyKey('baseline-key')).toEqual(baseline);

      expect(manifests.insert(manifest)).toEqual(manifest);
      expect(manifests.getById('manifest-1')).toEqual(manifest);
      expect(manifests.getByIdempotencyKey('manifest-key')).toEqual(manifest);
      expect(manifests.listByTask('task-1')).toEqual([manifest]);
    } finally {
      db.close();
    }
  });
});
