import { describe, expect, it } from 'vitest';
import type {
  CommitmentRecord,
  EmploymentRecord,
  ExecutiveRequestRecord,
  IExecutiveAssistantRepository,
  IOrganizationRepository,
  OrganizationRecord,
  OrganizationUnitRecord,
  PositionRecord,
} from '@agora-ts/contracts';
import { ExecutiveAssistantService, type ExecutiveTaskPort } from './executive-assistant-service.js';

function organizationFixture(withResearcher = true): IOrganizationRepository {
  const organization: OrganizationRecord = {
    id: 'org', slug: 'company', name: 'Company', ownerRef: 'human:ceo', informationDomain: 'work',
    purpose: null, status: 'active', version: 1, createdAt: 'now', updatedAt: 'now', metadata: null,
  };
  const units: OrganizationUnitRecord[] = [
    { id: 'exec', organizationId: 'org', name: 'Executive Office', kind: 'executive_office', parentUnitId: null, responsibilities: [], status: 'active', version: 1, createdAt: 'now', updatedAt: 'now', metadata: null },
    { id: 'research', organizationId: 'org', name: 'Research', kind: 'department', parentUnitId: null, responsibilities: ['research'], status: 'active', version: 1, createdAt: 'now', updatedAt: 'now', metadata: null },
  ];
  const positions: PositionRecord[] = [
    { id: 'ea-position', organizationId: 'org', unitId: 'exec', title: 'Executive Assistant', kind: 'executive_assistant', reportsToPositionId: null, responsibilities: ['intake', 'triage'], skills: ['research'], status: 'active', version: 1, createdAt: 'now', updatedAt: 'now', metadata: null },
    { id: 'research-position', organizationId: 'org', unitId: 'research', title: 'Research Lead', kind: 'lead', reportsToPositionId: 'ea-position', responsibilities: ['research', 'analysis'], skills: ['web-research'], status: 'active', version: 1, createdAt: 'now', updatedAt: 'now', metadata: null },
  ];
  const employments: EmploymentRecord[] = [
    { id: 'ea-employment', organizationId: 'org', positionId: 'ea-position', subjectKind: 'agent', subjectRef: 'agent:ea', employmentKind: 'resident', status: 'active', startedAt: 'now', endedAt: null, endedReason: null, version: 1, createdAt: 'now', updatedAt: 'now', metadata: null },
    ...(withResearcher ? [{ id: 'research-employment', organizationId: 'org', positionId: 'research-position', subjectKind: 'agent' as const, subjectRef: 'agent:research', employmentKind: 'resident' as const, status: 'active' as const, startedAt: 'now', endedAt: null, endedReason: null, version: 1, createdAt: 'now', updatedAt: 'now', metadata: null }] : []),
  ];
  return {
    insertOrganization: () => organization,
    getOrganization: (id) => id === 'org' ? organization : null,
    getOrganizationBySlug: (slug) => slug === 'company' ? organization : null,
    listOrganizations: () => [organization],
    insertUnit: () => units[0], getUnit: (id) => units.find((item) => item.id === id) ?? null,
    listUnits: () => units, updateUnitParent: () => null,
    insertPosition: () => positions[0], getPosition: (id) => positions.find((item) => item.id === id) ?? null,
    listPositions: () => positions, updatePositionManager: () => null,
    insertEmployment: () => employments[0], getEmployment: (id) => employments.find((item) => item.id === id) ?? null,
    getCurrentEmploymentByPosition: (positionId) => employments.find((item) => item.positionId === positionId && item.status !== 'ended') ?? null,
    listEmployments: () => employments, updateEmploymentStatus: () => null,
  } as IOrganizationRepository;
}

function assistantRepository(): IExecutiveAssistantRepository & { requests: ExecutiveRequestRecord[]; commitments: CommitmentRecord[] } {
  const requests: ExecutiveRequestRecord[] = [];
  const commitments: CommitmentRecord[] = [];
  return {
    requests, commitments,
    insertRequest(input) {
      const existing = input.idempotencyKey
        ? requests.find((item) => item.organizationId === input.organizationId && item.idempotencyKey === input.idempotencyKey)
        : undefined;
      if (existing) return { request: existing, created: false };
      const record: ExecutiveRequestRecord = {
        id: `request-${requests.length + 1}`, organizationId: input.organizationId, requestedBy: input.requestedBy,
        title: input.title, body: input.body, priority: input.priority, requestedCapabilities: input.requestedCapabilities,
        taskType: input.taskType, projectId: input.projectId ?? null, dueAt: input.dueAt ?? null,
        status: 'received', assignedPositionId: null, assignedEmploymentId: null, taskId: null, blockedReason: null,
        version: 1, createdAt: 'now', updatedAt: 'now', completedAt: null, metadata: input.metadata ?? null,
        idempotencyKey: input.idempotencyKey ?? null, intakeDigest: input.intakeDigest ?? null,
      };
      requests.push(record); return { request: record, created: true };
    },
    getRequest: (id) => requests.find((item) => item.id === id) ?? null,
    getRequestByTask: (taskId) => requests.find((item) => item.taskId === taskId) ?? null,
    listRequests: (organizationId, status) => requests.filter((item) => item.organizationId === organizationId && (!status || item.status === status)),
    updateRequestRouting(id, input, expectedVersion) {
      const index = requests.findIndex((item) => item.id === id && item.version === expectedVersion); if (index < 0) return null;
      requests[index] = { ...requests[index], ...input, blockedReason: null, version: expectedVersion + 1 } as ExecutiveRequestRecord;
      return requests[index];
    },
    updateRequestStatus(id, status, expectedVersion, blockedReason, completedAt) {
      const index = requests.findIndex((item) => item.id === id && item.version === expectedVersion); if (index < 0) return null;
      requests[index] = { ...requests[index], status, blockedReason: blockedReason ?? null, completedAt: completedAt ?? null, version: expectedVersion + 1 } as ExecutiveRequestRecord;
      return requests[index];
    },
    insertCommitment(input) {
      const record: CommitmentRecord = {
        id: `commitment-${commitments.length + 1}`, organizationId: input.organizationId, requestId: input.requestId,
        ownerPositionId: input.ownerPositionId, ownerEmploymentId: input.ownerEmploymentId, taskId: input.taskId,
        summary: input.summary, dueAt: input.dueAt ?? null, status: 'open', evidenceRefs: [],
        version: 1, createdAt: 'now', updatedAt: 'now', fulfilledAt: null, metadata: input.metadata ?? null,
      };
      commitments.push(record); return record;
    },
    getCommitmentByRequest: (requestId) => commitments.find((item) => item.requestId === requestId) ?? null,
    listCommitments: (organizationId, status) => commitments.filter((item) => item.organizationId === organizationId && (!status || item.status === status)),
    updateCommitmentStatus(id, status, expectedVersion, evidenceRefs, fulfilledAt) {
      const index = commitments.findIndex((item) => item.id === id && item.version === expectedVersion); if (index < 0) return null;
      const next: CommitmentRecord = {
        ...commitments[index]!, status, evidenceRefs, fulfilledAt: fulfilledAt ?? null, version: expectedVersion + 1,
      };
      commitments[index] = next;
      return next;
    },
  };
}

function taskPort(state: { assigned?: string; taskState?: string; createCalls?: number } = {}): ExecutiveTaskPort {
  return {
    createAssignedTask(input) {
      state.assigned = input.assigneeRef;
      state.createCalls = (state.createCalls ?? 0) + 1;
      return { taskId: 'task-1' };
    },
    getTaskState: () => state.taskState ?? 'active',
  };
}

describe('ExecutiveAssistantService', () => {
  it('routes a CEO request to the best occupied position and records a commitment', () => {
    const repository = assistantRepository();
    const state: { assigned?: string } = {};
    const service = new ExecutiveAssistantService({
      repository, organizationRepository: organizationFixture(), taskPort: taskPort(state),
    });
    const result = service.intake({
      organizationId: 'org', requestedBy: 'human:ceo', title: '调研电池行业', body: '形成有来源的报告',
      priority: 'normal', requestedCapabilities: ['research'], taskType: 'research',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request).toMatchObject({ status: 'delegated', assignedPositionId: 'research-position', taskId: 'task-1' });
    expect(result.commitment).toMatchObject({ ownerPositionId: 'research-position', status: 'open' });
    expect(state.assigned).toBe('agent:research');
  });

  it('falls back to the resident EA for triage when no specialist is occupied', () => {
    const service = new ExecutiveAssistantService({
      repository: assistantRepository(), organizationRepository: organizationFixture(false), taskPort: taskPort(),
    });
    const result = service.intake({
      organizationId: 'org', requestedBy: 'human:ceo', title: '安排一项新工作', body: '先判断该找谁',
      priority: 'high', requestedCapabilities: ['unknown'], taskType: 'quick',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request).toMatchObject({ status: 'triage', assignedPositionId: 'ea-position' });
  });

  it('returns the original request and commitment for an identical idempotent replay', () => {
    const repository = assistantRepository();
    const state: { assigned?: string; createCalls?: number } = {};
    const service = new ExecutiveAssistantService({
      repository, organizationRepository: organizationFixture(), taskPort: taskPort(state),
    });
    const input = {
      organizationId: 'org', requestedBy: 'human:ceo', title: 'Prepare brief', body: 'Prepare the morning brief',
      priority: 'normal' as const, requestedCapabilities: ['research', 'analysis'], taskType: 'quick',
      targetPositionId: 'research-position', idempotencyKey: 'paos:proposal-1',
    };

    const first = service.intake(input);
    const replay = service.intake({
      ...input,
      requestedBy: ' human:ceo ',
      title: ' Prepare brief ',
      requestedCapabilities: ['ANALYSIS', 'research', 'analysis'],
    });

    expect(first.ok).toBe(true);
    expect(replay).toEqual(first);
    expect(state.createCalls).toBe(1);
    expect(repository.requests).toHaveLength(1);
    expect(repository.commitments).toHaveLength(1);
  });

  it('rejects reuse of an idempotency key for different normalized input', () => {
    const repository = assistantRepository();
    const state: { assigned?: string; createCalls?: number } = {};
    const service = new ExecutiveAssistantService({
      repository, organizationRepository: organizationFixture(), taskPort: taskPort(state),
    });
    const common = {
      organizationId: 'org', requestedBy: 'human:ceo', body: 'Prepare the morning brief',
      priority: 'normal' as const, idempotencyKey: 'paos:proposal-1',
    };
    expect(service.intake({ ...common, title: 'Prepare brief' }).ok).toBe(true);

    expect(service.intake({ ...common, title: 'Different request' })).toEqual({
      ok: false,
      code: 'idempotency_conflict',
      error: "idempotency key 'paos:proposal-1' was already used for different input",
    });
    expect(state.createCalls).toBe(1);
    expect(repository.requests).toHaveLength(1);
  });

  it('reconciles a done task into fulfilled request and commitment', () => {
    const repository = assistantRepository();
    const taskState = { taskState: 'done' };
    const service = new ExecutiveAssistantService({
      repository, organizationRepository: organizationFixture(), taskPort: taskPort(taskState),
    });
    const created = service.intake({
      organizationId: 'org', requestedBy: 'human:ceo', title: '调研', body: '交付报告',
      priority: 'normal', requestedCapabilities: ['research'], taskType: 'research',
    });
    if (!created.ok) throw new Error(created.error);
    const reconciled = service.reconcileByTask('task-1', ['artifact:report']);
    expect(reconciled).not.toBeNull();
    if (!reconciled) return;
    expect(reconciled.ok).toBe(true);
    if (!reconciled.ok) return;
    expect(reconciled.request.status).toBe('completed');
    expect(reconciled.commitment?.status).toBe('fulfilled');
    expect(reconciled.commitment?.evidenceRefs).toEqual(['artifact:report']);
  });
});
