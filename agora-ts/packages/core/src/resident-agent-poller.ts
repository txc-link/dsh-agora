/**
 * resident-agent-poller.ts — org-aware-work-os S2 常驻 agent 任务台轮询.
 *
 * ResidentAgentPoller 持有常驻 agent 列表, 定时扫描可认领任务:
 * 对每个任务 × 每个 agent 用 matchTaskToAgent 匹配 → 未认领且匹配 → claim.
 * deps 由 composition root 注入 (listClaimableTasks 接 TaskService,
 * claim 接 TaskClaimService), 纯 Core 编排, 无平台名 (§1)。
 */

import { matchTaskToAgent, type ClaimMatcherTask } from './task-claim-matcher.js';

export interface PollerAgent {
  agentRef: string;
  roleId: string;
  skillsRef: readonly string[];
  pollIntervalMs: number;
}

export interface PollerDeps {
  /** 列出可认领任务 (state=created, 未认领). */
  listClaimableTasks: () => ClaimMatcherTask[];
  /** 任务是否已被认领. */
  isTaskClaimed: (taskId: string) => boolean;
  /** 认领任务 (接 TaskClaimService.claim). */
  claim: (taskId: string, agentRef: string) => { ok: true } | { ok: false; reason: string };
}

export interface PollResult {
  scanned: number;
  claims: { taskId: string; agentRef: string }[];
  skippedClaimed: number;
  skippedUnmatched: number;
}

export class ResidentAgentPoller {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly agents: PollerAgent[],
    private readonly deps: PollerDeps,
  ) {}

  pollOnce(): PollResult {
    const tasks = this.deps.listClaimableTasks();
    const claims: { taskId: string; agentRef: string }[] = [];
    let skippedClaimed = 0;
    let skippedUnmatched = 0;

    for (const task of tasks) {
      if (this.deps.isTaskClaimed(task.taskId)) {
        skippedClaimed += 1;
        continue;
      }
      let claimed = false;
      for (const agent of this.agents) {
        const match = matchTaskToAgent(task, {
          agentRef: agent.agentRef,
          roleId: agent.roleId,
          skillsRef: agent.skillsRef,
        });
        if (match.matched) {
          const result = this.deps.claim(task.taskId, agent.agentRef);
          if (result.ok) {
            claims.push({ taskId: task.taskId, agentRef: agent.agentRef });
            claimed = true;
            break; // 每任务一个 agent (先到先得)
          }
        }
      }
      if (!claimed && !this.deps.isTaskClaimed(task.taskId)) skippedUnmatched += 1;
    }

    return { scanned: tasks.length, claims, skippedClaimed, skippedUnmatched };
  }

  start(): void {
    if (this.timer) return;
    // 每 agent 间隔不同 → 取最小间隔作为统一心跳 (简化, 可后续按 agent 独立调度)
    const interval = Math.min(...this.agents.map((a) => a.pollIntervalMs));
    this.timer = setInterval(() => this.pollOnce(), interval);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
