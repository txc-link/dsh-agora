/**
 * task-claim-command.ts — org-aware-work-os S2: Agent 任务认领 CLI 入口 (§2 Entry Surface).
 *
 * Subcommands: claim | release | list | claimable. Plain JSON output.
 * No interactive prompts (the CLI is for agents, not humans; humans use Dashboard).
 */

import type { ITaskClaimRepository, ITaskRepository } from '@agora-ts/contracts';
import { TaskClaimService } from './task-claim-service.js';
import { matchTaskToAgent } from './task-claim-matcher.js';

export interface TaskClaimCommandDeps {
  claimService: TaskClaimService;
  claimRepo: ITaskClaimRepository;
  taskRepo: Pick<ITaskRepository, 'getTask' | 'listTasks'>;
}

export type TaskClaimSubcommand = 'claim' | 'release' | 'list' | 'claimable';

export interface RunTaskClaimCommandOptions {
  subcommand: TaskClaimSubcommand;
  // claim
  taskId?: string;
  agentRef?: string;
  reason?: string;
  ttlMs?: number;
  // release
  claimId?: string;
  // list
  listAgent?: string;
  // claimable — 用哪个 agent 的职责来匹配
  matchAgentRef?: string;
  matchRoleId?: string;
  matchSkills?: string;
}

export interface TaskClaimCommandResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export async function runTaskClaimCommand(
  deps: TaskClaimCommandDeps,
  options: RunTaskClaimCommandOptions,
): Promise<TaskClaimCommandResult> {
  switch (options.subcommand) {
    case 'claim':
      return runClaim(deps, options);
    case 'release':
      return runRelease(deps, options);
    case 'list':
      return runList(deps, options);
    case 'claimable':
      return runClaimable(deps, options);
    default:
      return { ok: false, error: `unknown subcommand: ${options.subcommand}` };
  }
}

function requireString(value: string | undefined, field: string): string | null {
  if (value === undefined || value === '') {
    return `${field} is required`;
  }
  return null;
}

function runClaim(deps: TaskClaimCommandDeps, options: RunTaskClaimCommandOptions): TaskClaimCommandResult {
  const missing = requireString(options.taskId, '--task') ?? requireString(options.agentRef, '--agent');
  if (missing) return { ok: false, error: missing };
  try {
    const expiresAt = options.ttlMs && options.ttlMs > 0
      ? new Date(Date.now() + options.ttlMs).toISOString()
      : null;
    const result = deps.claimService.claim({
      taskId: options.taskId as string,
      agentRef: options.agentRef as string,
      reason: options.reason ?? null,
      ...(expiresAt !== null ? { expiresAt } : {}),
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function runRelease(deps: TaskClaimCommandDeps, options: RunTaskClaimCommandOptions): TaskClaimCommandResult {
  const missing = requireString(options.claimId, '--claim') ?? requireString(options.agentRef, '--agent');
  if (missing) return { ok: false, error: missing };
  try {
    const released = deps.claimService.release(options.claimId as string, options.agentRef as string);
    return { ok: true, data: released };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function runList(deps: TaskClaimCommandDeps, options: RunTaskClaimCommandOptions): TaskClaimCommandResult {
  if (options.listAgent) {
    return { ok: true, data: { claims: deps.claimRepo.listByAgent(options.listAgent) } };
  }
  return { ok: true, data: { claims: deps.claimRepo.listClaimed() } };
}

function runClaimable(deps: TaskClaimCommandDeps, options: RunTaskClaimCommandOptions): TaskClaimCommandResult {
  const missing = requireString(options.matchRoleId, '--role');
  if (missing) return { ok: false, error: missing };
  const skills = (options.matchSkills ?? '').split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  const agentRef = options.matchAgentRef ?? 'agent:cli';
  // 可认领状态: created (预备) / active (可工作, 新任务默认直达 active)
  const tasks = [...deps.taskRepo.listTasks('created'), ...deps.taskRepo.listTasks('active')];
  const matched: unknown[] = [];
  for (const task of tasks) {
    const claim = deps.claimRepo.getByTaskId(task.id);
    if (claim && claim.status === 'claimed') continue;
    const match = matchTaskToAgent(
      { taskId: task.id, taskType: task.type, skillPolicy: task.skill_policy ?? null },
      { agentRef, roleId: options.matchRoleId as string, skillsRef: skills },
    );
    if (match.matched) {
      matched.push({
        task_id: task.id,
        title: task.title,
        task_type: task.type,
        score: match.score,
        reasons: match.reasons,
      });
    }
  }
  return { ok: true, data: { claimable: matched, count: matched.length } };
}

// ─── claim poll: 常驻 agent 单轮轮询 (expireStale → 匹配 → 认领) ────────────

export interface TaskClaimPollDeps {
  claimService: TaskClaimService;
  claimRepo: ITaskClaimRepository;
  taskRepo: Pick<ITaskRepository, 'getTask' | 'listTasks'>;
}

export interface TaskClaimPollOptions {
  agentRef: string;
  roleId: string;
  skills: string;
}

export interface TaskClaimPollResult {
  expired: number;
  scanned: number;
  claimed: { taskId: string; title: string } | null;
}

/** 单轮轮询: 批量过期 → 扫描 created+active 未认领任务 → 首个匹配即认领 (先到先得)。 */
export async function runTaskClaimPollCommand(
  deps: TaskClaimPollDeps,
  options: TaskClaimPollOptions,
): Promise<TaskClaimCommandResult> {
  const missing = requireString(options.agentRef, '--agent') ?? requireString(options.roleId, '--role');
  if (missing) return { ok: false, error: missing };
  const skills = options.skills.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  const expired = deps.claimService.expireStale().length;
  const tasks = [...deps.taskRepo.listTasks('created'), ...deps.taskRepo.listTasks('active')];
  let scanned = 0;
  for (const task of tasks) {
    const claim = deps.claimRepo.getByTaskId(task.id);
    if (claim && claim.status === 'claimed') continue;
    scanned += 1;
    const match = matchTaskToAgent(
      { taskId: task.id, taskType: task.type, skillPolicy: task.skill_policy ?? null },
      { agentRef: options.agentRef, roleId: options.roleId, skillsRef: skills },
    );
    if (!match.matched) continue;
    try {
      const result = deps.claimService.claim({ taskId: task.id, agentRef: options.agentRef, reason: 'poll auto-claim' });
      return {
        ok: true,
        data: {
          expired,
          scanned,
          claimed: { taskId: result.claim.taskId, title: task.title },
        } satisfies TaskClaimPollResult,
      };
    } catch {
      // 认领被拒 (如并发先到) → 继续看下一个任务
    }
  }
  return { ok: true, data: { expired, scanned, claimed: null } satisfies TaskClaimPollResult };
}
