/**
 * task-claim-service.ts — org-aware-work-os S2 主动任务接取 (Core 编排).
 *
 * claim = 校验任务存在 + 未认领 → 写入 claim (claimed);
 * release = claimed → released (认领者本人);
 * expire = claimed + 超时 → expired.
 * 纯 Core 编排: taskExists 由 composition root 注入, 无平台名 (§1).
 */

import type { ITaskClaimRepository, TaskClaimRecord, TaskClaimStatus } from '@agora-ts/contracts';

export interface ClaimTaskInput {
  taskId: string;
  agentRef: string;
  reason?: string | null;
  expiresAt?: string | null;
}

export interface TaskClaimServiceOptions {
  claimRepo: ITaskClaimRepository;
  /** 校验任务存在 (composition root 注入, 通常接 TaskService). */
  taskExists: (taskId: string) => boolean;
}

export interface ClaimResult {
  claim: TaskClaimRecord;
  status: TaskClaimStatus;
  claimedAt: string | null;
}

export class TaskClaimService {
  constructor(private readonly opts: TaskClaimServiceOptions) {}

  claim(input: ClaimTaskInput): ClaimResult {
    if (!this.opts.taskExists(input.taskId)) {
      throw new Error(`task claim rejected: task '${input.taskId}' not found`);
    }
    const existing = this.opts.claimRepo.getByTaskId(input.taskId);
    if (existing && existing.status === 'claimed') {
      throw new Error(`task claim rejected: task '${input.taskId}' already claimed by '${existing.agentRef}'`);
    }
    const now = new Date().toISOString();
    const claim = this.opts.claimRepo.insert({
      taskId: input.taskId,
      agentRef: input.agentRef,
      reason: input.reason ?? null,
      expiresAt: input.expiresAt ?? null,
    });
    const updated = this.opts.claimRepo.updateStatus(claim.id, 'claimed', now) ?? claim;
    return { claim: updated, status: updated.status, claimedAt: updated.claimedAt };
  }

  release(claimId: string, agentRef: string): TaskClaimRecord {
    const claim = this.opts.claimRepo.getById(claimId);
    if (!claim) throw new Error(`task claim release: claim '${claimId}' not found`);
    if (claim.agentRef !== agentRef) {
      throw new Error(`task claim release: claim '${claimId}' owned by '${claim.agentRef}', not '${agentRef}'`);
    }
    if (claim.status !== 'claimed') {
      throw new Error(`task claim release: claim '${claimId}' is '${claim.status}', not claimable`);
    }
    const now = new Date().toISOString();
    return this.opts.claimRepo.updateStatus(claimId, 'released', now) ?? claim;
  }

  expire(claimId: string, nowIso = new Date().toISOString()): TaskClaimRecord {
    const claim = this.opts.claimRepo.getById(claimId);
    if (!claim) throw new Error(`task claim expire: claim '${claimId}' not found`);
    if (claim.status !== 'claimed') return claim;
    if (claim.expiresAt && claim.expiresAt <= nowIso) {
      return this.opts.claimRepo.updateStatus(claimId, 'expired', nowIso) ?? claim;
    }
    return claim;
  }
}
