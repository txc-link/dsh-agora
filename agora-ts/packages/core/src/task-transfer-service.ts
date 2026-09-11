/**
 * task-transfer-service.ts — T_transfer assignee reassignment (shortest path).
 *
 * Implements the agreed slice from follow-up-T-transfer-design.md §3/§5:
 *   - requestTransfer(): CLI / connector slash path — writes a `pending`
 *     task_transfers row and (when an approval repository is wired) opens a
 *     task_transfer approval request.
 *   - transferTask(): dashboard session path — validates and applies the
 *     transfer immediately (Human Gate A4 satisfied by the session caller).
 *   - applyApprovedTransfer(): entry point used by the approval queue when a
 *     task_transfer approval is decided.
 *
 * All rules live here; adapters / REST / CLI / connector delegate to it.
 */

import type {
  ITaskTransferRepository,
  TaskRecord,
  TaskTeamMemberDto,
  TaskTransferHistoryDto,
  TaskTransferRequestDto,
  TaskTransferResultDto,
} from '@agora-ts/contracts';

/** States that may be reassigned. done/cancelled/archived are terminal. */
const TRANSFERABLE_STATES = new Set([
  'active',
  'queued',
  'waiting_approval',
  'blocked',
  'paused',
]);

export interface TaskTransferApprovalInsert {
  id?: string;
  task_id: string;
  stage_id: string;
  gate_type: string;
  requested_by: string;
  summary_path?: string | null;
  request_comment?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface TaskTransferServiceOptions {
  getTask(taskId: string): TaskRecord | null;
  updateTask(
    taskId: string,
    version: number,
    updates: { team: { members: TaskTeamMemberDto[] } },
  ): TaskRecord;
  transferRepository: ITaskTransferRepository;
  /** Resolves a runtime_target_ref; returns null when unknown. */
  getRuntimeTarget(runtimeTargetRef: string): { runtime_target_ref: string } | null;
  /** Optional approval queue wiring; when absent requestTransfer returns pending without an approval row. */
  insertApproval?: (input: TaskTransferApprovalInsert) => { id: string };
  now?: () => string;
}

function currentRuntime(task: TaskRecord): string {
  const controller = task.team.members.find((member) => member.member_kind === 'controller');
  return controller?.runtime_target_ref ?? controller?.agentId ?? task.team.members[0]?.agentId ?? 'unknown';
}

export class TaskTransferService {
  /** 解析后的必选时钟：`exactOptionalPropertyTypes` 下不允许把 `undefined` 显式传给可选参数。 */
  private readonly now: () => string;

  constructor(private readonly options: TaskTransferServiceOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  /**
   * Dashboard-session path: validates then applies immediately (A4 satisfied).
   */
  transferTask(taskId: string, dto: TaskTransferRequestDto): TaskTransferResultDto {
    return this.applyTransfer(taskId, dto, {
      decidedBy: dto.decidedBy?.trim() || 'dashboard',
    });
  }

  /**
   * CLI / connector slash path: writes a pending row and opens an approval
   * request when the approval queue is wired.
   */
  requestTransfer(taskId: string, dto: TaskTransferRequestDto): TaskTransferResultDto {
    const task = this.loadTask(taskId);
    this.assertTransferable(task);
    const fromRef = currentRuntime(task);
    const reason = dto.reason.trim();
    if (!reason) {
      throw new Error('transfer reason is required');
    }
    this.resolveTarget(dto.toRuntimeRef);
    if (fromRef === dto.toRuntimeRef) {
      throw new Error(`task ${taskId} is already bound to ${dto.toRuntimeRef}`);
    }

    const transfer = this.options.transferRepository.insert({
      taskId,
      fromRuntimeRef: fromRef,
      toRuntimeRef: dto.toRuntimeRef,
      targetEmploymentId: dto.targetEmploymentId ?? null,
      reason,
      decidedBy: null,
      status: 'pending',
      metadata: dto.comment ? { comment: dto.comment } : null,
      now: this.now,
    });

    let approvalId: string | null = null;
    if (this.options.insertApproval) {
      const approval = this.options.insertApproval({
        task_id: taskId,
        stage_id: 'transfer',
        gate_type: 'task_transfer',
        requested_by: dto.decidedBy?.trim() || 'connector',
        request_comment: reason,
        metadata: { transfer_id: transfer.id },
      });
      approvalId = approval.id;
    }

    return {
      task: { id: task.id, state: task.state, currentStage: task.current_stage },
      transferId: transfer.id,
      approvalRequired: approvalId !== null,
      approvalId,
      status: transfer.status,
    };
  }

  /**
   * Approval-queue entry point: applies a previously pending transfer after a
   * task_transfer approval is decided (called from TaskApprovalService).
   */
  applyApprovedTransfer(transferId: string, decidedBy: string, approvalId: string): TaskTransferResultDto {
    const transfer = this.options.transferRepository.getById(transferId);
    if (!transfer) {
      throw new Error(`task transfer ${transferId} not found`);
    }
    if (transfer.status !== 'pending') {
      throw new Error(`task transfer ${transferId} is already ${transfer.status}`);
    }
    const task = this.loadTask(transfer.taskId);
    this.assertTransferable(task);
    const updated = this.applyTransferToTask(task, transfer.toRuntimeRef);
    this.options.transferRepository.applyTransfer(transferId, decidedBy, {
      approvalId,
      now: this.now,
    });
    return {
      task: { id: updated.id, state: updated.state, currentStage: updated.current_stage },
      transferId,
      approvalRequired: false,
      approvalId,
      status: 'applied',
    };
  }

  rejectPendingTransfer(transferId: string, decidedBy: string, approvalId?: string | null): TaskTransferResultDto {
    const transfer = this.options.transferRepository.getById(transferId);
    if (!transfer) {
      throw new Error(`task transfer ${transferId} not found`);
    }
    this.options.transferRepository.rejectTransfer(transferId, decidedBy, {
      approvalId: approvalId ?? null,
      now: this.now,
    });
    return {
      task: { id: transfer.taskId, state: 'unknown', currentStage: null },
      transferId,
      approvalRequired: false,
      approvalId: approvalId ?? null,
      status: 'rejected',
    };
  }

  cancelPendingTransfer(transferId: string, decidedBy: string): TaskTransferResultDto {
    const transfer = this.options.transferRepository.getById(transferId);
    if (!transfer) {
      throw new Error(`task transfer ${transferId} not found`);
    }
    this.options.transferRepository.cancelTransfer(transferId, decidedBy);
    return {
      task: { id: transfer.taskId, state: 'unknown', currentStage: null },
      transferId,
      approvalRequired: false,
      approvalId: null,
      status: 'cancelled',
    };
  }

  listTaskTransfers(taskId: string): TaskTransferHistoryDto {
    const transfers = this.options.transferRepository.listByTask(taskId);
    return {
      transfers: transfers.map((transfer) => ({
        id: transfer.id,
        fromRuntimeRef: transfer.fromRuntimeRef,
        toRuntimeRef: transfer.toRuntimeRef,
        reason: transfer.reason,
        decidedBy: transfer.decidedBy,
        decidedAt: transfer.appliedAt ?? transfer.rejectedAt ?? transfer.cancelledAt,
        approvalId: transfer.approvalId,
        status: transfer.status,
        createdAt: transfer.createdAt,
      })),
    };
  }

  private loadTask(taskId: string): TaskRecord {
    const task = this.options.getTask(taskId);
    if (!task) {
      throw new Error(`task ${taskId} not found`);
    }
    return task;
  }

  private assertTransferable(task: TaskRecord): void {
    if (!TRANSFERABLE_STATES.has(task.state)) {
      throw new Error(`task ${task.id} state ${task.state} forbids reassign`);
    }
  }

  private resolveTarget(runtimeTargetRef: string): { runtime_target_ref: string } {
    const target = this.options.getRuntimeTarget(runtimeTargetRef);
    if (!target) {
      throw new Error(`unknown runtime target: ${runtimeTargetRef}`);
    }
    return target;
  }

  private applyTransferToTask(task: TaskRecord, toRuntimeRef: string): TaskRecord {
    const fromRef = currentRuntime(task);
    if (fromRef === toRuntimeRef) {
      throw new Error(`task ${task.id} is already bound to ${toRuntimeRef}`);
    }
    const members: TaskTeamMemberDto[] = task.team.members.map((member) => {
      const isController = member.member_kind === 'controller';
      const isCurrentRuntime = member.agentId === fromRef || member.runtime_target_ref === fromRef;
      if (!isController && !isCurrentRuntime) {
        return member;
      }
      return {
        ...member,
        agentId: toRuntimeRef,
        ...(member.runtime_target_ref !== undefined ? { runtime_target_ref: toRuntimeRef } : {}),
      };
    });
    return this.options.updateTask(task.id, task.version, {
      team: { ...task.team, members },
    });
  }

  private applyTransfer(
    taskId: string,
    dto: TaskTransferRequestDto,
    ctx: { decidedBy: string },
  ): TaskTransferResultDto {
    const task = this.loadTask(taskId);
    this.assertTransferable(task);
    const reason = dto.reason.trim();
    if (!reason) {
      throw new Error('transfer reason is required');
    }
    this.resolveTarget(dto.toRuntimeRef);
    const fromRef = currentRuntime(task);
    const updated = this.applyTransferToTask(task, dto.toRuntimeRef);
    const transfer = this.options.transferRepository.insert({
      taskId,
      fromRuntimeRef: fromRef,
      toRuntimeRef: dto.toRuntimeRef,
      targetEmploymentId: dto.targetEmploymentId ?? null,
      reason,
      decidedBy: ctx.decidedBy,
      status: 'applied',
      metadata: {
        previous_members: task.team.members,
        ...(dto.comment ? { comment: dto.comment } : {}),
      },
      now: this.now,
    });
    return {
      task: { id: updated.id, state: updated.state, currentStage: updated.current_stage },
      transferId: transfer.id,
      approvalRequired: false,
      approvalId: null,
      status: transfer.status,
    };
  }
}
