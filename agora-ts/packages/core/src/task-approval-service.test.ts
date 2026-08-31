import { describe, expect, it, vi } from 'vitest';
import type { ApprovalRequestRecord, IApprovalRequestRepository, TaskRecord } from '@agora-ts/contracts';
import { TaskApprovalService } from './task-approval-service.js';

function makeTask(): TaskRecord {
  return {
    id: 'OC-APPROVAL-1',
    title: 'Approval task',
    description: '',
    type: 'coding',
    priority: 'normal',
    creator: 'archon',
    locale: 'zh-CN',
    state: 'active',
    current_stage: 'review',
    version: 2,
    workflow: {
      type: 'custom',
      stages: [
        { id: 'review', mode: 'discuss', gate: { type: 'approval', approver_role: 'reviewer' } },
      ],
    },
    team: {
      members: [
        { role: 'architect', agentId: 'opus', member_kind: 'controller', model_preference: 'strong_reasoning' },
      ],
    },
    created_at: '2026-04-03T00:00:00.000Z',
    updated_at: '2026-04-03T00:00:00.000Z',
  } as unknown as TaskRecord;
}

function createService() {
  const task = makeTask();
  const stage = task.workflow.stages?.[0];
  if (!stage) {
    throw new Error('approval fixture is missing review stage');
  }
  const logs: Array<Record<string, unknown>> = [];
  const mirrors: Array<Record<string, unknown>> = [];
  const resolved: Array<Record<string, unknown>> = [];
  const gateDecisions: Array<Record<string, unknown>> = [];
  const routeGateCommand = vi.fn();
  const recordApproval = vi.fn();
  const recordArchonReview = vi.fn();
  const recordQuorumVote = vi.fn((
    taskId: string,
    stageId: string,
    voterId: string,
    vote: 'approve' | 'reject',
    comment: string,
  ) => {
    void taskId;
    void stageId;
    void voterId;
    void vote;
    void comment;
    return { approved: 2, total: 3 };
  });
  const advanceSatisfiedStage = vi.fn(() => ({ ...task, current_stage: 'done' }));
  const rewindRejectedStage = vi.fn(() => ({ ...task, current_stage: 'draft' }));

  const options = {
    getTaskOrThrow: () => task,
    assertTaskActive: () => {},
    getCurrentStageOrThrow: () => stage,
    assertStageRosterAction: () => {},
    assertApprovalAuthority: () => {},
    routeGateCommand: (currentTask: TaskRecord, currentStage: { id: string }, command: string, callerId: string) => {
      routeGateCommand(currentTask.id, currentStage.id, command, callerId);
    },
    getApproverRole: () => 'reviewer',
    recordApproval: (taskId: string, stageId: string, approverRole: string, approverId: string, comment: string) => {
      recordApproval(taskId, stageId, approverRole, approverId, comment);
    },
    recordArchonReview: (taskId: string, stageId: string, decision: 'approved' | 'rejected', reviewerId: string, note: string) => {
      recordArchonReview(taskId, stageId, decision, reviewerId, note);
    },
    recordQuorumVote: (taskId: string, stageId: string, voterId: string, vote: 'approve' | 'reject', comment: string) => recordQuorumVote(taskId, stageId, voterId, vote, comment),
    insertFlowLog: (input: Record<string, unknown>) => {
      logs.push(input);
    },
    mirrorConversationEntry: (taskId: string, input: Record<string, unknown>) => {
      mirrors.push({ taskId, ...input });
    },
    resolvePendingApprovalRequest: (taskId: string, stageId: string, status: 'approved' | 'rejected', resolvedBy: string, resolutionComment: string) => {
      resolved.push({ taskId, stageId, status, resolvedBy, resolutionComment });
    },
    advanceSatisfiedStage,
    rewindRejectedStage,
    publishGateDecisionBroadcast: (currentTask: TaskRecord, input: Record<string, unknown>) => {
      gateDecisions.push({ taskId: currentTask.id, ...input });
    },
  };

  const service = new TaskApprovalService(options);

  return {
    service,
    options,
    task,
    stage,
    logs,
    mirrors,
    resolved,
    gateDecisions,
    routeGateCommand,
    recordApproval,
    recordArchonReview,
    recordQuorumVote,
    advanceSatisfiedStage,
    rewindRejectedStage,
  };
}

describe('TaskApprovalService', () => {
  it('records approval decisions and advances the task', () => {
    const fixture = createService();

    const approved = fixture.service.approveTask('OC-APPROVAL-1', {
      approverId: 'reviewer-1',
      approverAccountId: 42,
      comment: 'ship it',
    });

    expect(fixture.routeGateCommand).toHaveBeenCalledWith('OC-APPROVAL-1', 'review', 'approve', 'reviewer-1');
    expect(fixture.recordApproval).toHaveBeenCalledWith('OC-APPROVAL-1', 'review', 'reviewer', 'reviewer-1', 'ship it');
    expect(fixture.advanceSatisfiedStage).toHaveBeenCalledWith(fixture.task, 'reviewer-1');
    expect(fixture.logs).toContainEqual(expect.objectContaining({
      event: 'gate_passed',
      task_id: 'OC-APPROVAL-1',
      stage_id: 'review',
    }));
    expect(fixture.resolved).toContainEqual({
      taskId: 'OC-APPROVAL-1',
      stageId: 'review',
      status: 'approved',
      resolvedBy: 'reviewer-1',
      resolutionComment: 'ship it',
    });
    expect(fixture.gateDecisions).toContainEqual(expect.objectContaining({
      taskId: 'OC-APPROVAL-1',
      decision: 'approved',
      reviewer: 'reviewer-1',
      gateType: 'approval',
    }));
    expect(approved.current_stage).toBe('done');
  });

  it('rewinds rejected approval decisions and broadcasts rejection', () => {
    const fixture = createService();

    const rejected = fixture.service.rejectTask('OC-APPROVAL-1', {
      rejectorId: 'reviewer-2',
      rejectorAccountId: 7,
      reason: 'needs more evidence',
    });

    expect(fixture.routeGateCommand).toHaveBeenCalledWith('OC-APPROVAL-1', 'review', 'reject', 'reviewer-2');
    expect(fixture.rewindRejectedStage).toHaveBeenCalledWith(
      fixture.task,
      'review',
      'rejected',
      'reviewer-2',
      'needs more evidence',
    );
    expect(fixture.logs).toContainEqual(expect.objectContaining({
      event: 'gate_failed',
      task_id: 'OC-APPROVAL-1',
      stage_id: 'review',
    }));
    expect(fixture.gateDecisions).toContainEqual(expect.objectContaining({
      taskId: 'OC-APPROVAL-1',
      decision: 'rejected',
      reviewer: 'reviewer-2',
      gateType: 'approval',
    }));
    expect(rejected.current_stage).toBe('draft');
  });

  it('records archon approval decisions separately from normal approval', () => {
    const fixture = createService();

    const approved = fixture.service.archonApproveTask('OC-APPROVAL-1', {
      reviewerId: 'archon-1',
      comment: 'approved by archon',
    });

    expect(fixture.routeGateCommand).toHaveBeenCalledWith('OC-APPROVAL-1', 'review', 'archon-approve', 'archon-1');
    expect(fixture.recordArchonReview).toHaveBeenCalledWith('OC-APPROVAL-1', 'review', 'approved', 'archon-1', 'approved by archon');
    expect(fixture.logs).toContainEqual(expect.objectContaining({
      kind: 'archon',
      event: 'archon_approved',
      task_id: 'OC-APPROVAL-1',
    }));
    expect(fixture.gateDecisions).toContainEqual(expect.objectContaining({
      taskId: 'OC-APPROVAL-1',
      decision: 'approved',
      reviewer: 'archon-1',
      gateType: 'archon_review',
    }));
    expect(approved.current_stage).toBe('done');
  });

  it('returns quorum state for confirm actions', () => {
    const fixture = createService();

    const result = fixture.service.confirmTask('OC-APPROVAL-1', {
      voterId: 'reviewer-3',
      vote: 'approve',
      comment: 'looks good',
    });

    expect(fixture.routeGateCommand).toHaveBeenCalledWith('OC-APPROVAL-1', 'review', 'confirm', 'reviewer-3');
    expect(fixture.recordQuorumVote).toHaveBeenCalledWith('OC-APPROVAL-1', 'review', 'reviewer-3', 'approve', 'looks good');
    expect(result.quorum).toEqual({ approved: 2, total: 3 });
    expect(fixture.logs).toContainEqual(expect.objectContaining({
      event: 'quorum_vote',
      task_id: 'OC-APPROVAL-1',
      stage_id: 'review',
    }));
  });
});

// ─── Approval queue + decide-by-id (2026-08-31 next-batch) ────────────────
class InMemoryApprovalRequestRepository implements Pick<IApprovalRequestRepository, 'getById' | 'listPending'> {
  private rows = new Map<string, ApprovalRequestRecord>();
  insert(row: ApprovalRequestRecord): void {
    this.rows.set(row.id, row);
  }
  getById(id: string): ApprovalRequestRecord | null {
    return this.rows.get(id) ?? null;
  }
  listPending(options?: { limit?: number }): ApprovalRequestRecord[] {
    const limit = options?.limit ?? 100;
    return Array.from(this.rows.values())
      .filter((r) => r.status === 'pending')
      .sort((a, b) => a.requested_at.localeCompare(b.requested_at))
      .slice(0, limit);
  }
}

function makeApprovalRow(overrides: Partial<ApprovalRequestRecord> & { id: string; gate_type?: string; status?: ApprovalRequestRecord['status']; requested_at?: string }): ApprovalRequestRecord {
  return {
    id: overrides.id,
    task_id: 'OC-APPROVAL-1',
    stage_id: 'review',
    gate_type: overrides.gate_type ?? 'approval',
    requested_by: 'archon',
    status: overrides.status ?? 'pending',
    summary_path: null,
    request_comment: 'needs review',
    resolution_comment: null,
    resolved_by: null,
    requested_at: overrides.requested_at ?? '2026-08-31T00:00:00.000Z',
    resolved_at: null,
    metadata: null,
  } as ApprovalRequestRecord;
}

describe('TaskApprovalService approval queue', () => {
  it('listPendingApprovals throws a clear error when the repository is not configured', () => {
    const fixture = createService();
    expect(() => fixture.service.listPendingApprovals()).toThrow(/approval queue not configured/i);
    expect(() => fixture.service.getApprovalRequest('any')).toThrow(/approval queue not configured/i);
    expect(() => fixture.service.decideApproval('any', {
      reviewerId: 'r', decision: 'approve', comment: '',
    })).toThrow(/approval queue not configured/i);
  });

  it('listPendingApprovals returns rows ordered by requested_at asc with a clamped limit', () => {
    const repo = new InMemoryApprovalRequestRepository();
    const base = createService();
    const service = new TaskApprovalService({ ...base.options, approvalRequestRepository: repo });
    repo.insert(makeApprovalRow({ id: 'a', requested_at: '2026-08-31T00:00:00.000Z' }));
    repo.insert(makeApprovalRow({ id: 'b', requested_at: '2026-08-31T00:00:01.000Z' }));
    repo.insert(makeApprovalRow({ id: 'c', requested_at: '2026-08-31T00:00:02.000Z' }));

    expect(service.listPendingApprovals().map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(service.listPendingApprovals({ limit: 2 }).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('decideApproval delegates to approveTask for approval gates and resolves the row', () => {
    const repo = new InMemoryApprovalRequestRepository();
    const base = createService();
    const service = new TaskApprovalService({ ...base.options, approvalRequestRepository: repo });
    repo.insert(makeApprovalRow({ id: 'apr-approval', gate_type: 'approval' }));

    service.decideApproval('apr-approval', {
      reviewerId: 'reviewer-1',
      decision: 'approve',
      comment: 'lgtm',
    });

    expect(base.routeGateCommand).toHaveBeenCalledWith('OC-APPROVAL-1', 'review', 'approve', 'reviewer-1');
    expect(base.recordApproval).toHaveBeenCalledWith('OC-APPROVAL-1', 'review', 'reviewer', 'reviewer-1', 'lgtm');
  });

  it('decideApproval delegates to rejectTask when the decision is reject', () => {
    const repo = new InMemoryApprovalRequestRepository();
    const base = createService();
    const service = new TaskApprovalService({ ...base.options, approvalRequestRepository: repo });
    repo.insert(makeApprovalRow({ id: 'apr-reject', gate_type: 'approval' }));

    service.decideApproval('apr-reject', {
      reviewerId: 'reviewer-2',
      decision: 'reject',
      comment: 'not yet',
    });

    expect(base.routeGateCommand).toHaveBeenCalledWith('OC-APPROVAL-1', 'review', 'reject', 'reviewer-2');
  });

  it('decideApproval routes archon_review rows to archonApproveTask / archonRejectTask', () => {
    const repo = new InMemoryApprovalRequestRepository();
    const base = createService();
    const service = new TaskApprovalService({ ...base.options, approvalRequestRepository: repo });
    repo.insert(makeApprovalRow({ id: 'apr-archon-ok', gate_type: 'archon_review' }));
    repo.insert(makeApprovalRow({ id: 'apr-archon-no', gate_type: 'archon_review' }));

    service.decideApproval('apr-archon-ok', { reviewerId: 'a', decision: 'approve', comment: 'fine' });
    service.decideApproval('apr-archon-no', { reviewerId: 'a', decision: 'reject', comment: 'no' });

    expect(base.routeGateCommand).toHaveBeenCalledWith('OC-APPROVAL-1', 'review', 'archon-approve', 'a');
    expect(base.routeGateCommand).toHaveBeenCalledWith('OC-APPROVAL-1', 'review', 'archon-reject', 'a');
  });

  it('decideApproval rejects unknown ids and already-resolved rows defensively', () => {
    const repo = new InMemoryApprovalRequestRepository();
    const base = createService();
    const service = new TaskApprovalService({ ...base.options, approvalRequestRepository: repo });
    repo.insert(makeApprovalRow({ id: 'apr-done', status: 'approved' }));

    expect(() => service.decideApproval('missing', { reviewerId: 'r', decision: 'approve', comment: '' }))
      .toThrow(/approval request missing not found/i);
    expect(() => service.decideApproval('apr-done', { reviewerId: 'r', decision: 'approve', comment: '' }))
      .toThrow(/approval request apr-done is already approved/i);
  });

  it('decideApproval refuses unsupported gate types rather than guessing', () => {
    const repo = new InMemoryApprovalRequestRepository();
    const base = createService();
    const service = new TaskApprovalService({ ...base.options, approvalRequestRepository: repo });
    repo.insert(makeApprovalRow({ id: 'apr-weird', gate_type: 'unknown_gate' }));

    expect(() => service.decideApproval('apr-weird', { reviewerId: 'r', decision: 'approve', comment: '' }))
      .toThrow(/unsupported gate_type unknown_gate/i);
  });
});
