export type ExecutiveRequestPriority = 'low' | 'normal' | 'high';
export type ExecutiveRequestStatus = 'received' | 'triage' | 'delegated' | 'blocked' | 'completed' | 'cancelled';
export type CommitmentStatus = 'open' | 'fulfilled' | 'cancelled';

export interface ExecutiveRequestRecord {
  id: string;
  organizationId: string;
  requestedBy: string;
  title: string;
  body: string;
  priority: ExecutiveRequestPriority;
  requestedCapabilities: string[];
  taskType: string;
  projectId: string | null;
  dueAt: string | null;
  status: ExecutiveRequestStatus;
  assignedPositionId: string | null;
  assignedEmploymentId: string | null;
  taskId: string | null;
  blockedReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CommitmentRecord {
  id: string;
  organizationId: string;
  requestId: string;
  ownerPositionId: string;
  ownerEmploymentId: string;
  taskId: string;
  summary: string;
  dueAt: string | null;
  status: CommitmentStatus;
  evidenceRefs: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
  fulfilledAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface InsertExecutiveRequestInput {
  id?: string;
  organizationId: string;
  requestedBy: string;
  title: string;
  body: string;
  priority: ExecutiveRequestPriority;
  requestedCapabilities: string[];
  taskType: string;
  projectId?: string | null;
  dueAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface InsertCommitmentInput {
  id?: string;
  organizationId: string;
  requestId: string;
  ownerPositionId: string;
  ownerEmploymentId: string;
  taskId: string;
  summary: string;
  dueAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface IExecutiveAssistantRepository {
  insertRequest(input: InsertExecutiveRequestInput): ExecutiveRequestRecord;
  getRequest(requestId: string): ExecutiveRequestRecord | null;
  listRequests(organizationId: string, status?: ExecutiveRequestStatus): ExecutiveRequestRecord[];
  updateRequestRouting(
    requestId: string,
    input: {
      status: 'triage' | 'delegated';
      assignedPositionId: string;
      assignedEmploymentId: string;
      taskId: string;
    },
    expectedVersion: number,
  ): ExecutiveRequestRecord | null;
  updateRequestStatus(
    requestId: string,
    status: ExecutiveRequestStatus,
    expectedVersion: number,
    blockedReason?: string | null,
    completedAt?: string | null,
  ): ExecutiveRequestRecord | null;

  insertCommitment(input: InsertCommitmentInput): CommitmentRecord;
  getCommitmentByRequest(requestId: string): CommitmentRecord | null;
  listCommitments(organizationId: string, status?: CommitmentStatus): CommitmentRecord[];
  updateCommitmentStatus(
    commitmentId: string,
    status: CommitmentStatus,
    expectedVersion: number,
    evidenceRefs: string[],
    fulfilledAt?: string | null,
  ): CommitmentRecord | null;
}
