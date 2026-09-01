import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  CollaborationPlanRecord,
  CollaborationRequirementRecord,
  DelegationAuthorityRecord,
  ICollaborationPlanRepository,
  ICollaborationRequirementRepository,
  IDelegationAuthorityRepository,
  ISubTaskSpecRepository,
  SubTaskSpecRecord,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError } from './errors.js';
import { CollaborationGovernanceService } from './collaboration-governance-service.js';

class MemoryRepository<T extends { id: string; idempotency_key: string; task_id: string }> {
  readonly records: T[] = [];
  insert(record: T) { this.records.push(record); return record; }
  getById(id: string) { return this.records.find((record) => record.id === id) ?? null; }
  getByIdempotencyKey(key: string) { return this.records.find((record) => record.idempotency_key === key) ?? null; }
  listByTask(taskId: string) { return this.records.filter((record) => record.task_id === taskId); }
  listByRequirement(requirementId: string) {
    return this.records.filter((record) => 'requirement_id' in record && record.requirement_id === requirementId);
  }
}

function makeService() {
  let id = 0;
  const requirements = new MemoryRepository<CollaborationRequirementRecord>();
  const specs = new MemoryRepository<SubTaskSpecRecord>();
  const authorities = new MemoryRepository<DelegationAuthorityRecord>();
  const plans = new MemoryRepository<CollaborationPlanRecord>();
  const service = new CollaborationGovernanceService({
    requirements: requirements as ICollaborationRequirementRepository,
    specs: specs as ISubTaskSpecRepository,
    authorities: authorities as IDelegationAuthorityRepository,
    plans: plans as ICollaborationPlanRepository,
    idGenerator: () => `id-${++id}`,
    now: () => new Date('2026-09-01T10:00:00.000Z'),
  });
  return { service, requirements, specs, authorities, plans };
}

const revisionDigest = createHash('sha256').update('revision').digest('hex');

function requirementInput(idempotencyKey = 'requirement-1') {
  return {
    task_id: 'task-1', task_revision_id: 'revision-1', task_revision_digest: revisionDigest,
    mode: 'fanout' as const, min_agents: 2, max_agents: 3, required_roles: ['researcher'],
    required_capabilities: ['web-research'], quorum: 2, reviewer_required: true,
    information_domains: ['company'], created_by: 'human:ceo', idempotency_key: idempotencyKey,
  };
}

describe('CollaborationGovernanceService', () => {
  it('builds a requirement, immutable subtask specs, authority, and plan chain', () => {
    const { service } = makeService();
    const requirement = service.createRequirement(requirementInput());
    const first = service.createSubTaskSpec({
      task_id: 'task-1', requirement_id: requirement.id, ordinal: 1, title: '资料检索', objective: '检索一手资料',
      acceptance_criteria: ['列出来源'], dependency_spec_ids: [], required_capabilities: ['web-research'],
      preferred_role: 'researcher', assignee_ref: 'agent:researcher', information_domain: 'company',
      created_by: 'agent:ea', idempotency_key: 'spec-1',
    });
    const second = service.createSubTaskSpec({
      task_id: 'task-1', requirement_id: requirement.id, ordinal: 2, parent_spec_id: first.id,
      title: '复核结论', objective: '复核资料结论', acceptance_criteria: ['指出矛盾'], dependency_spec_ids: [first.id],
      required_capabilities: ['critical-review'], preferred_role: 'reviewer', assignee_ref: null,
      information_domain: 'company', created_by: 'agent:ea', idempotency_key: 'spec-2',
    });
    const authority = service.grantDelegationAuthority({
      task_id: 'task-1', requirement_id: requirement.id, scope: 'subtask', subtask_spec_id: first.id,
      delegator_ref: 'agent:ea', delegate_ref: 'agent:researcher', allowed_actions: ['read_context', 'write_artifact'],
      max_delegation_depth: 0, expires_at: '2026-09-02T10:00:00.000Z', created_by: 'human:ceo', idempotency_key: 'auth-1',
    });
    const plan = service.createPlan({
      task_id: 'task-1', requirement_id: requirement.id, task_revision_id: 'revision-1', task_revision_digest: revisionDigest,
      subtask_spec_ids: [first.id, second.id], delegation_authority_ids: [authority.id], coordination_run_ref: 'coordination:1',
      created_by: 'agent:ea', idempotency_key: 'plan-1',
    });

    expect(requirement.status).toBe('draft');
    expect(first.spec_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(second.parent_spec_id).toBe(first.id);
    expect(authority.status).toBe('active');
    expect(plan.status).toBe('proposed');
    expect(service.listSubTaskSpecsByRequirement(requirement.id)).toHaveLength(2);
    expect(service.listPlans('task-1')).toEqual([plan]);
  });

  it('enforces task boundaries, expiry, and idempotency', () => {
    const { service } = makeService();
    const requirement = service.createRequirement(requirementInput());
    const same = service.createRequirement(requirementInput());
    expect(same).toBe(requirement);
    expect(() => service.createRequirement({ ...requirementInput(), required_roles: ['different'] })).toThrowError(ConflictError);
    expect(() => service.createSubTaskSpec({
      task_id: 'task-2', requirement_id: requirement.id, ordinal: 1, title: '越界', objective: '不应创建',
      acceptance_criteria: ['不可'], dependency_spec_ids: [], required_capabilities: [], information_domain: 'company', created_by: 'agent:ea', idempotency_key: 'spec-cross-task',
    })).toThrowError(ConflictError);
    const spec = service.createSubTaskSpec({
      task_id: 'task-1', requirement_id: requirement.id, ordinal: 1, title: '资料检索', objective: '检索',
      acceptance_criteria: ['有来源'], dependency_spec_ids: [], required_capabilities: [], information_domain: 'company', created_by: 'agent:ea', idempotency_key: 'spec-1',
    });
    expect(() => service.createSubTaskSpec({
      task_id: 'task-1', requirement_id: requirement.id, ordinal: 1, title: '资料检索', objective: '变化',
      acceptance_criteria: ['有来源'], dependency_spec_ids: [], required_capabilities: [], information_domain: 'company', created_by: 'agent:ea', idempotency_key: 'spec-1',
    })).toThrowError(ConflictError);
    expect(() => service.grantDelegationAuthority({
      task_id: 'task-1', requirement_id: requirement.id, scope: 'subtask', subtask_spec_id: spec.id,
      delegator_ref: 'agent:ea', delegate_ref: 'agent:researcher', allowed_actions: ['delegate'], max_delegation_depth: 1,
      expires_at: '2026-09-01T09:00:00.000Z', created_by: 'human:ceo', idempotency_key: 'auth-expired',
    })).toThrowError(ConflictError);
    expect(() => service.getPlan('missing')).toThrowError(NotFoundError);
  });

  it('rejects a plan with a stale revision or duplicate references', () => {
    const { service } = makeService();
    const requirement = service.createRequirement(requirementInput());
    const spec = service.createSubTaskSpec({
      task_id: 'task-1', requirement_id: requirement.id, ordinal: 1, title: '资料', objective: '检索',
      acceptance_criteria: ['有来源'], dependency_spec_ids: [], required_capabilities: [], information_domain: 'company', created_by: 'agent:ea', idempotency_key: 'spec-1',
    });
    expect(() => service.createPlan({
      task_id: 'task-1', requirement_id: requirement.id, task_revision_id: 'revision-other', task_revision_digest: revisionDigest,
      subtask_spec_ids: [spec.id], delegation_authority_ids: [], created_by: 'agent:ea', idempotency_key: 'plan-stale',
    })).toThrowError(ConflictError);
    expect(() => service.createPlan({
      task_id: 'task-1', requirement_id: requirement.id, task_revision_id: 'revision-1', task_revision_digest: revisionDigest,
      subtask_spec_ids: [spec.id, spec.id], delegation_authority_ids: [], created_by: 'agent:ea', idempotency_key: 'plan-duplicate',
    })).toThrowError(ConflictError);
  });
});
