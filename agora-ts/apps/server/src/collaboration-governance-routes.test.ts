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
import { CollaborationGovernanceService } from '@agora-ts/core';
import { buildApp } from './app.js';

class MemoryRepository<T extends { id: string; idempotency_key: string; task_id: string }> {
  private readonly records: T[] = [];
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
  return new CollaborationGovernanceService({
    requirements: new MemoryRepository<CollaborationRequirementRecord>() as ICollaborationRequirementRepository,
    specs: new MemoryRepository<SubTaskSpecRecord>() as ISubTaskSpecRepository,
    authorities: new MemoryRepository<DelegationAuthorityRecord>() as IDelegationAuthorityRepository,
    plans: new MemoryRepository<CollaborationPlanRecord>() as ICollaborationPlanRepository,
    idGenerator: () => `route-id-${++id}`,
    now: () => new Date('2026-09-01T10:00:00.000Z'),
  });
}

const revisionDigest = createHash('sha256').update('revision').digest('hex');

describe('collaboration governance routes', () => {
  it('creates and lists a requirement, spec, authority and proposed plan', async () => {
    const app = buildApp({ collaborationGovernanceService: makeService() });
    const requirementResponse = await app.inject({
      method: 'POST', url: '/api/tasks/task-1/collaboration-requirements', payload: {
        task_revision_id: 'revision-1', task_revision_digest: revisionDigest, mode: 'fanout', min_agents: 1, max_agents: 2,
        required_capabilities: ['research'], information_domains: ['company'], created_by: 'human:ceo', idempotency_key: 'req-1',
      },
    });
    expect(requirementResponse.statusCode).toBe(201);
    const requirement = requirementResponse.json();

    const specResponse = await app.inject({
      method: 'POST', url: '/api/tasks/task-1/subtask-specs', payload: {
        requirement_id: requirement.id, ordinal: 1, title: '检索', objective: '检索资料', acceptance_criteria: ['列来源'],
        created_by: 'agent:ea', idempotency_key: 'spec-1',
      },
    });
    expect(specResponse.statusCode).toBe(201);
    const spec = specResponse.json();

    const authorityResponse = await app.inject({
      method: 'POST', url: '/api/tasks/task-1/delegation-authorities', payload: {
        requirement_id: requirement.id, scope: 'subtask', subtask_spec_id: spec.id, delegator_ref: 'agent:ea',
        delegate_ref: 'agent:researcher', allowed_actions: ['read_context'], max_delegation_depth: 0,
        expires_at: '2026-09-02T10:00:00.000Z', created_by: 'human:ceo', idempotency_key: 'auth-1',
      },
    });
    expect(authorityResponse.statusCode).toBe(201);
    const authority = authorityResponse.json();

    const planResponse = await app.inject({
      method: 'POST', url: '/api/tasks/task-1/collaboration-plans', payload: {
        requirement_id: requirement.id, task_revision_id: 'revision-1', task_revision_digest: revisionDigest,
        subtask_spec_ids: [spec.id], delegation_authority_ids: [authority.id], created_by: 'agent:ea', idempotency_key: 'plan-1',
      },
    });
    expect(planResponse.statusCode).toBe(201);
    expect(planResponse.json().status).toBe('proposed');
    const listResponse = await app.inject({ method: 'GET', url: '/api/tasks/task-1/collaboration-plans' });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().plans).toHaveLength(1);
    await app.close();
  });

  it('returns a conflict for a plan with a stale revision', async () => {
    const service = makeService();
    const app = buildApp({ collaborationGovernanceService: service });
    const requirement = service.createRequirement({
      task_id: 'task-1', task_revision_id: 'revision-1', task_revision_digest: revisionDigest, mode: 'single', min_agents: 1, max_agents: 1,
      required_roles: [], required_capabilities: [], quorum: 1, reviewer_required: false, information_domains: [], created_by: 'human:ceo', idempotency_key: 'req-1',
    });
    const spec = service.createSubTaskSpec({
      task_id: 'task-1', requirement_id: requirement.id, ordinal: 1, title: '检索', objective: '检索', acceptance_criteria: ['列来源'],
      dependency_spec_ids: [], required_capabilities: [], information_domain: 'company', created_by: 'agent:ea', idempotency_key: 'spec-1',
    });
    const response = await app.inject({
      method: 'POST', url: '/api/tasks/task-1/collaboration-plans', payload: {
        requirement_id: requirement.id, task_revision_id: 'revision-2', task_revision_digest: revisionDigest,
        subtask_spec_ids: [spec.id], created_by: 'agent:ea', idempotency_key: 'plan-stale',
      },
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });
});
