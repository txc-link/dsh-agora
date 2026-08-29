/**
 * delegate-router.ts — org-aware-work-os S3: 按组织架构委派路由 (§1 纯 Core).
 *
 * 语义 (蓝图 02 §2.2): agent 认领任务后按组织架构分给下级执行;
 * DelegateRouter 负责 路由目标解析 (子树/上报链) + 深度限制 + 环路检测 + 群发通知端口。
 * notify = IMMessagingPort.sendNotification 形状, 可选注入 (IM 通道 Phase 6 绑定)。
 */

import type { ITeamRepository } from '@agora-ts/contracts';
import type { OrgHierarchyResolver } from './org-hierarchy-resolver.js';

export type DelegateResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface DelegateNotifyPayload {
  event_type: 'task_delegated' | 'task_escalated';
  data: Record<string, unknown>;
}

export interface DelegateRouterOptions {
  teamRepo: Pick<ITeamRepository, 'getById' | 'listByProject' | 'listByMember'>;
  /** 组织层级解析 (S1) */
  resolver: OrgHierarchyResolver;
  /** 通知端口 (可选; IM 侧 Phase 6 绑定) */
  notify?: (targetRef: string, payload: DelegateNotifyPayload) => void;
  /** 委派深度限制 (team 链长, 默认 4) */
  maxDepth?: number;
}

export interface DelegateSubtreeInput {
  teamId: string;
  taskId: string;
  /** 委派发起者 (从通知对象中排除) */
  fromRef?: string | null;
}

export interface DelegateSubtreeResult {
  teamId: string;
  depth: number;
  recipients: string[];
  notified: number;
}

export interface EscalateUpInput {
  agentRef: string;
  taskId?: string | null;
}

export interface EscalateUpResult {
  routedTo: string | null;
  chain: string[];
}

export class DelegateRouter {
  private readonly teamRepo: Pick<ITeamRepository, 'getById' | 'listByProject' | 'listByMember'>;
  private readonly resolver: OrgHierarchyResolver;
  private readonly notify: ((targetRef: string, payload: DelegateNotifyPayload) => void) | undefined;
  private readonly maxDepth: number;

  constructor(options: DelegateRouterOptions) {
    this.teamRepo = options.teamRepo;
    this.resolver = options.resolver;
    this.notify = options.notify;
    this.maxDepth = options.maxDepth ?? 4;
  }

  /** 显式环检测: team parent 链出现重复 → 环 */
  private detectCycle(teamId: string): string | null {
    const seen = new Set<string>();
    let cursor: string | null = teamId;
    while (cursor !== null) {
      if (seen.has(cursor)) return cursor;
      seen.add(cursor);
      const team = this.teamRepo.getById(cursor);
      if (!team) return null;
      cursor = team.parent_id;
    }
    return null;
  }

  delegateSubtree(input: DelegateSubtreeInput): DelegateResult<DelegateSubtreeResult> {
    const team = this.teamRepo.getById(input.teamId);
    if (!team) return { ok: false, error: `team '${input.teamId}' not found` };
    if (!input.taskId) return { ok: false, error: 'taskId is required' };

    // 环路检测 (S1 resolver 的 chainToRoot 截断环; 这里显式拒绝而不是静默截断)
    const cycleAt = this.detectCycle(input.teamId);
    if (cycleAt) return { ok: false, error: `delegation chain has a cycle at team '${cycleAt}'` };

    // 深度限制: team 距根链长
    const chain = this.resolver.chainToRoot(input.teamId);
    const depth = chain.length;
    if (depth > this.maxDepth) {
      return { ok: false, error: `delegation depth ${depth} exceeds limit ${this.maxDepth}` };
    }

    // 子树全员 (排除发起者)
    const recipients = this.resolver.subtreeAgents(input.teamId)
      .filter((ref) => ref !== input.fromRef);
    let notified = 0;
    if (this.notify) {
      for (const targetRef of recipients) {
        this.notify(targetRef, {
          event_type: 'task_delegated',
          data: { team_id: input.teamId, task_id: input.taskId, from_ref: input.fromRef ?? null, depth },
        });
        notified += 1;
      }
    }
    return { ok: true, data: { teamId: input.teamId, depth, recipients, notified } };
  }

  escalateUp(input: EscalateUpInput): DelegateResult<EscalateUpResult> {
    if (!input.agentRef) return { ok: false, error: 'agentRef is required' };
    const leads = this.resolver.leadsAbove(input.agentRef);
    if (leads.length === 0) {
      return { ok: false, error: `agent '${input.agentRef}' has no lead above (no team membership or already at root)` };
    }
    const routedTo: string = leads[0] ?? '';
    if (this.notify) {
      this.notify(routedTo, {
        event_type: 'task_escalated',
        data: { agent_ref: input.agentRef, task_id: input.taskId ?? null, chain: leads },
      });
    }
    return { ok: true, data: { routedTo, chain: leads } };
  }
}
