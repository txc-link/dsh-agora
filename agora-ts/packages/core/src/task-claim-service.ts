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
    const now = new Date().toISOString();
    if (existing && existing.status === 'claimed' && existing.expiresAt && existing.expiresAt <= now) {
      this.opts.claimRepo.updateStatus(existing.id, 'expired', now);
    }
    const current = this.opts.claimRepo.getByTaskId(input.taskId);
    if (current && current.status === 'claimed') {
      throw new Error(`task claim rejected: task '${input.taskId}' already claimed by '${current.agentRef}'`);
    }
    const claim = this.opts.claimRepo.insert({
      taskId: input.taskId,
      agentRef: input.agentRef,
      reason: input.reason ?? null,
      expiresAt: input.expiresAt ?? null,
    });
    const updated = this.opts.claimRepo.updateStatus(claim.id, 'claimed', now) ?? claim;
    return { claim: updated, status: updated.status, claimedAt: updated.claimedAt };
  }

  /** Explicit takeover command: only expired claims may be replaced. */
  takeover(input: ClaimTaskInput): ClaimResult {
    const existing = this.opts.claimRepo.getByTaskId(input.taskId);
    if (existing?.status === 'claimed' && (!existing.expiresAt || existing.expiresAt > new Date().toISOString())) {
      throw new Error(`task takeover rejected: live claim belongs to '${existing.agentRef}'`);
    }
    return this.claim({ ...input, reason: input.reason ?? 'stale claim takeover' });
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

  /** 批量扫描: 所有 claimed 且 expiresAt 已过的认领 → expired. 轮询周期/定时任务调用。 */
  expireStale(nowIso = new Date().toISOString()): TaskClaimRecord[] {
    const expired: TaskClaimRecord[] = [];
    for (const claim of this.opts.claimRepo.listClaimed()) {
      if (claim.expiresAt && claim.expiresAt <= nowIso) {
        const updated = this.opts.claimRepo.updateStatus(claim.id, 'expired', nowIso);
        if (updated) expired.push(updated);
      }
    }
    return expired;
  }
}
