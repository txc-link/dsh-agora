import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  CollaborationPlanDto,
  CollaborationRequirementDto,
  DelegationAuthorityDto,
  SubTaskSpecDto,
  TaskSpecRevisionDto,
} from '@agora-ts/contracts';
import { createAgoraDatabase, runMigrations } from './database.js';
import { TaskRepository } from './repositories/task.repository.js';
import { TaskSpecRevisionRepository } from './repositories/governed-execution.repository.js';
import {
  CollaborationPlanRepository,
  CollaborationRequirementRepository,
  DelegationAuthorityRepository,
  SubTaskSpecRepository,
} from './repositories/collaboration-governance.repository.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const databases: ReturnType<typeof createAgoraDatabase>[] = [];

function makeDb() {
  const db = createAgoraDatabase({ dbPath: ':memory:' });
  databases.push(db);
  runMigrations(db);
  new TaskRepository(db).insertTask({
    id: 'task-1', title: '研究任务', description: null, type: 'research', priority: 'normal', creator: 'human:ceo', locale: 'zh-CN',
    team: { members: [] }, workflow: { stages: [] }, control: { mode: 'normal' },
  });
  const revision: TaskSpecRevisionDto = {
    id: 'revision-1', task_id: 'task-1', revision: 1, base_task_version: 1, parent_revision: null,
    payload: { title: '研究任务', description: null, type: 'research', priority: 'normal', locale: 'zh-CN', project_id: null,
      objective: '比较方案', acceptance_criteria: ['输出建议'], scope: {}, constraints: [], context_refs: [], input_artifact_refs: [], memory_refs: [] },
    payload_digest: digest('payload'), created_by: 'human:ceo', idempotency_key: 'revision-key', created_at: '2026-09-01T10:00:00.000Z',
  };
  new TaskSpecRevisionRepository(db).insert(revision);
  return db;
}

afterEach(() => {
  while (databases.length > 0) databases.pop()!.close();
});

const requirement: CollaborationRequirementDto = {
  id: 'requirement-1', task_id: 'task-1', task_revision_id: 'revision-1', task_revision_digest: digest('payload'),
  mode: 'fanout', min_agents: 2, max_agents: 3, required_roles: ['researcher'], required_capabilities: ['web-research'],
  quorum: 2, reviewer_required: true, information_domains: ['company'], created_by: 'human:ceo',
  requirement_digest: digest('requirement'), status: 'draft', idempotency_key: 'requirement-key', created_at: '2026-09-01T10:00:00.000Z',
};
const spec: SubTaskSpecDto = {
  id: 'spec-1', task_id: 'task-1', requirement_id: 'requirement-1', ordinal: 1, parent_spec_id: null,
  title: '检索', objective: '检索资料', acceptance_criteria: ['列来源'], dependency_spec_ids: [], required_capabilities: ['web-research'],
  preferred_role: 'researcher', assignee_ref: 'agent:researcher', information_domain: 'company', created_by: 'agent:ea',
  spec_digest: digest('spec'), status: 'draft', idempotency_key: 'spec-key', created_at: '2026-09-01T10:01:00.000Z',
};
const authority: DelegationAuthorityDto = {
  id: 'authority-1', task_id: 'task-1', requirement_id: 'requirement-1', scope: 'subtask', subtask_spec_id: 'spec-1',
  delegator_ref: 'agent:ea', delegate_ref: 'agent:researcher', allowed_actions: ['read_context', 'write_artifact'], max_delegation_depth: 0,
  expires_at: '2026-09-02T10:00:00.000Z', created_by: 'human:ceo', authority_digest: digest('authority'), status: 'active',
  idempotency_key: 'authority-key', created_at: '2026-09-01T10:02:00.000Z',
};
const plan: CollaborationPlanDto = {
  id: 'plan-1', task_id: 'task-1', requirement_id: 'requirement-1', task_revision_id: 'revision-1', task_revision_digest: digest('payload'),
  subtask_spec_ids: ['spec-1'], delegation_authority_ids: ['authority-1'], coordination_run_ref: 'coordination:1', plan_digest: digest('plan'),
  status: 'proposed', created_by: 'agent:ea', idempotency_key: 'plan-key', created_at: '2026-09-01T10:03:00.000Z',
};

describe('collaboration governance repositories', () => {
  it('round-trips all collaboration governance records and JSON arrays', () => {
    const db = makeDb();
    const requirements = new CollaborationRequirementRepository(db);
    const specs = new SubTaskSpecRepository(db);
    const authorities = new DelegationAuthorityRepository(db);
    const plans = new CollaborationPlanRepository(db);

    expect(requirements.insert(requirement)).toEqual(requirement);
    expect(requirements.getById('requirement-1')).toEqual(requirement);
    expect(requirements.getByIdempotencyKey('requirement-key')).toEqual(requirement);
    expect(requirements.listByTask('task-1')).toEqual([requirement]);
    expect(specs.insert(spec)).toEqual(spec);
    expect(specs.listByRequirement('requirement-1')).toEqual([spec]);
    expect(authorities.insert(authority)).toEqual(authority);
    expect(authorities.listByTask('task-1')).toEqual([authority]);
    expect(plans.insert(plan)).toEqual(plan);
    expect(plans.getById('plan-1')).toEqual(plan);
    expect(plans.getByIdempotencyKey('plan-key')).toEqual(plan);
    expect(plans.listByRequirement('requirement-1')).toEqual([plan]);
  });
});
