import type {
  CommitmentRecord,
  EmploymentRecord,
  ExecutiveRequestPriority,
  ExecutiveRequestRecord,
  ExecutiveRequestStatus,
  IExecutiveAssistantRepository,
  IOrganizationRepository,
  PositionRecord,
} from '@agora-ts/contracts';

export interface ExecutiveTaskPort {
  createAssignedTask(input: {
    requestId: string;
    organizationId: string;
    informationDomain: string;
    title: string;
    description: string;
    requestedBy: string;
    priority: ExecutiveRequestPriority;
    requestedCapabilities: string[];
    taskType: string;
    projectId: string | null;
    assigneePositionId: string;
    assigneePositionTitle: string;
    assigneeEmploymentId: string;
    assigneeRef: string;
  }): { taskId: string };
  getTaskState(taskId: string): string | null;
}

export interface ExecutiveAssistantServiceOptions {
  repository: IExecutiveAssistantRepository;
  organizationRepository: IOrganizationRepository;
  taskPort: ExecutiveTaskPort;
  now?: () => Date;
}

export interface ExecutiveIntakeInput {
  organizationId: string;
  requestedBy: string;
  title: string;
  body: string;
  priority: ExecutiveRequestPriority;
  requestedCapabilities?: string[];
  taskType?: string;
  projectId?: string | null;
  dueAt?: string | null;
  targetPositionId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type ExecutiveAssistantResult =
  | { ok: true; request: ExecutiveRequestRecord; commitment: CommitmentRecord | null }
  | { ok: false; error: string };

function normalizeList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function activeEmploymentByPosition(
  repository: IOrganizationRepository,
  organizationId: string,
): Map<string, EmploymentRecord> {
  return new Map(
    repository.listEmployments(organizationId, false)
      .filter((employment) => employment.status === 'active')
      .map((employment) => [employment.positionId, employment]),
  );
}

function scorePosition(position: PositionRecord, capabilities: string[]): number {
  const declared = new Set(normalizeList([...position.responsibilities, ...position.skills]));
  return capabilities.reduce((score, capability) => score + (declared.has(capability) ? 1 : 0), 0);
}

export class ExecutiveAssistantService {
  private readonly repository: IExecutiveAssistantRepository;
  private readonly organizations: IOrganizationRepository;
  private readonly taskPort: ExecutiveTaskPort;
  private readonly now: () => Date;

  constructor(options: ExecutiveAssistantServiceOptions) {
    this.repository = options.repository;
    this.organizations = options.organizationRepository;
    this.taskPort = options.taskPort;
    this.now = options.now ?? (() => new Date());
  }

  intake(input: ExecutiveIntakeInput): ExecutiveAssistantResult {
    if (!input.title.trim() || !input.body.trim() || !input.requestedBy.trim()) {
      return { ok: false, error: 'title, body and requestedBy are required' };
    }
    const organization = this.organizations.getOrganization(input.organizationId);
    if (!organization) return { ok: false, error: `organization '${input.organizationId}' not found` };
    if (input.dueAt && Number.isNaN(Date.parse(input.dueAt))) {
      return { ok: false, error: 'dueAt must be an ISO datetime' };
    }
    const capabilities = normalizeList(input.requestedCapabilities);
    let request = this.repository.insertRequest({
      organizationId: input.organizationId,
      requestedBy: input.requestedBy.trim(),
      title: input.title.trim(),
      body: input.body.trim(),
      priority: input.priority,
      requestedCapabilities: capabilities,
      taskType: input.taskType?.trim() || 'quick',
      projectId: input.projectId ?? null,
      dueAt: input.dueAt ?? null,
      metadata: input.metadata ?? null,
    });

    const positions = this.organizations.listPositions(input.organizationId).filter((position) => position.status === 'active');
    const employments = activeEmploymentByPosition(this.organizations, input.organizationId);
    const assistant = positions
      .filter((position) => position.kind === 'executive_assistant' && employments.has(position.id))
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    if (!assistant) {
      request = this.block(request, 'no active executive assistant employment');
      return { ok: true, request, commitment: null };
    }

    let owner = assistant;
    let status: 'triage' | 'delegated' = 'triage';
    if (input.targetPositionId) {
      const target = positions.find((position) => position.id === input.targetPositionId);
      if (!target || !employments.has(target.id)) {
        request = this.block(request, `target position '${input.targetPositionId}' is not actively staffed`);
        return { ok: true, request, commitment: null };
      }
      owner = target;
      status = target.id === assistant.id ? 'triage' : 'delegated';
    } else if (capabilities.length > 0) {
      const candidates = positions
        .filter((position) => position.id !== assistant.id && employments.has(position.id))
        .map((position) => ({ position, score: scorePosition(position, capabilities) }))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score || left.position.id.localeCompare(right.position.id));
      if (candidates[0]) {
        owner = candidates[0].position;
        status = 'delegated';
      }
    }

    const employment = employments.get(owner.id);
    if (!employment) {
      request = this.block(request, `position '${owner.id}' has no active employment`);
      return { ok: true, request, commitment: null };
    }
    try {
      const task = this.taskPort.createAssignedTask({
        requestId: request.id,
        organizationId: input.organizationId,
        informationDomain: organization.informationDomain,
        title: input.title.trim(),
        description: input.body.trim(),
        requestedBy: input.requestedBy.trim(),
        priority: input.priority,
        requestedCapabilities: capabilities,
        taskType: input.taskType?.trim() || 'quick',
        projectId: input.projectId ?? null,
        assigneePositionId: owner.id,
        assigneePositionTitle: owner.title,
        assigneeEmploymentId: employment.id,
        assigneeRef: employment.subjectRef,
      });
      const routed = this.repository.updateRequestRouting(request.id, {
        status,
        assignedPositionId: owner.id,
        assignedEmploymentId: employment.id,
        taskId: task.taskId,
      }, request.version);
      if (!routed) return { ok: false, error: 'executive request changed concurrently' };
      request = routed;
      const commitment = this.repository.insertCommitment({
        organizationId: input.organizationId,
        requestId: request.id,
        ownerPositionId: owner.id,
        ownerEmploymentId: employment.id,
        taskId: task.taskId,
        summary: `Deliver: ${request.title}`,
        dueAt: request.dueAt,
        metadata: { informationDomain: organization.informationDomain },
      });
      return { ok: true, request, commitment };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      request = this.block(request, `task dispatch failed: ${reason}`);
      return { ok: true, request, commitment: null };
    }
  }

  reconcile(requestId: string, evidenceRefs: string[] = []): ExecutiveAssistantResult {
    const request = this.repository.getRequest(requestId);
    if (!request) return { ok: false, error: `executive request '${requestId}' not found` };
    const commitment = this.repository.getCommitmentByRequest(requestId);
    if (!request.taskId || !commitment) return { ok: true, request, commitment };
    const taskState = this.taskPort.getTaskState(request.taskId);
    if (taskState === 'done') {
      const completedAt = this.now().toISOString();
      const fulfilled = this.repository.updateCommitmentStatus(
        commitment.id, 'fulfilled', commitment.version, normalizeList(evidenceRefs), completedAt,
      );
      const completed = this.repository.updateRequestStatus(request.id, 'completed', request.version, null, completedAt);
      if (!fulfilled || !completed) return { ok: false, error: 'request or commitment changed concurrently' };
      return { ok: true, request: completed, commitment: fulfilled };
    }
    if (taskState === 'cancelled') {
      const cancelledCommitment = this.repository.updateCommitmentStatus(
        commitment.id, 'cancelled', commitment.version, normalizeList(evidenceRefs), null,
      );
      const cancelledRequest = this.repository.updateRequestStatus(request.id, 'cancelled', request.version, null, null);
      if (!cancelledCommitment || !cancelledRequest) return { ok: false, error: 'request or commitment changed concurrently' };
      return { ok: true, request: cancelledRequest, commitment: cancelledCommitment };
    }
    return { ok: true, request, commitment };
  }

  reconcileByTask(taskId: string, evidenceRefs: string[] = []): ExecutiveAssistantResult | null {
    const request = this.repository.getRequestByTask(taskId);
    return request ? this.reconcile(request.id, evidenceRefs) : null;
  }

  getRequest(requestId: string): ExecutiveRequestRecord | null {
    return this.repository.getRequest(requestId);
  }

  listInbox(organizationId: string, status?: ExecutiveRequestStatus): ExecutiveRequestRecord[] {
    return this.repository.listRequests(organizationId, status);
  }

  listCommitments(organizationId: string): CommitmentRecord[] {
    return this.repository.listCommitments(organizationId);
  }

  private block(request: ExecutiveRequestRecord, reason: string): ExecutiveRequestRecord {
    return this.repository.updateRequestStatus(request.id, 'blocked', request.version, reason, null) ?? request;
  }
}
