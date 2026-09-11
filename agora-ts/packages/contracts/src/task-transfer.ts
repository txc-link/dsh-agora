/**
 * task-transfer.ts — T_transfer assignee reassignment contracts.
 *
 * Storage-agnostic shapes shared by the Core service, DB repository and REST
 * surface. Mirrors the `task_transfers` table exactly (design doc §5).
 */

import { z } from 'zod';

export type TaskTransferStatus = 'pending' | 'applied' | 'rejected' | 'cancelled';

export const taskTransferRequestSchema = z.object({
  /** dsh:node-a:default style runtime ref that should take over the task. */
  to_runtime_ref: z.string().min(1),
  target_employment_id: z.string().optional().nullable(),
  reason: z.string().min(1),
  /** Dashboard session username; CLI/connector paths leave it null (pending). */
  decided_by: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
});
export type TaskTransferRequestSchemaDto = z.infer<typeof taskTransferRequestSchema>;

export interface TaskTransferRecord {
  id: string;
  taskId: string;
  fromRuntimeRef: string;
  toRuntimeRef: string;
  targetEmploymentId: string | null;
  reason: string;
  decidedBy: string | null;
  approvalId: string | null;
  status: TaskTransferStatus;
  appliedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface TaskTransferRequestDto {
  /** dsh:node-a:default style runtime ref that should take over the task. */
  toRuntimeRef: string;
  /** Optional; when omitted the runtime's default employment is used. */
  targetEmploymentId?: string | null;
  /** Required human-visible reason. */
  reason: string;
  /** Dashboard session username; CLI/connector paths leave it null (pending). */
  decidedBy?: string | null;
  comment?: string | null;
}

export interface TaskTransferResultDto {
  task: { id: string; state: string; currentStage: string | null };
  transferId: string;
  approvalRequired: boolean;
  approvalId: string | null;
  status: TaskTransferStatus;
}

export interface TaskTransferHistoryDto {
  transfers: Array<{
    id: string;
    fromRuntimeRef: string;
    toRuntimeRef: string;
    reason: string;
    decidedBy: string | null;
    decidedAt: string | null;
    approvalId: string | null;
    status: TaskTransferStatus;
    createdAt: string;
  }>;
}

export interface ITaskTransferRepository {
  insert(input: {
    id?: string;
    taskId: string;
    fromRuntimeRef: string;
    toRuntimeRef: string;
    targetEmploymentId?: string | null;
    reason: string;
    decidedBy?: string | null;
    approvalId?: string | null;
    status?: TaskTransferStatus;
    metadata?: Record<string, unknown> | null;
    now?: () => string;
  }): TaskTransferRecord;
  getById(id: string): TaskTransferRecord | null;
  listByTask(taskId: string): TaskTransferRecord[];
  listPending(limit?: number): TaskTransferRecord[];
  applyTransfer(
    id: string,
    decidedBy: string,
    opts?: { approvalId?: string | null; comment?: string | null; now?: () => string },
  ): TaskTransferRecord | null;
  rejectTransfer(
    id: string,
    decidedBy: string,
    opts?: { approvalId?: string | null; comment?: string | null; now?: () => string },
  ): TaskTransferRecord | null;
  cancelTransfer(id: string, decidedBy: string): TaskTransferRecord | null;
}
