/**
 * reflection-service.ts — org-aware-work-os S6: 反思报告 (§1 纯 Core).
 *
 * 语义: agent 读自身历史 scorecard → 确定性规则生成反思报告
 * (强项/弱项/建议); core 不做 LLM 润色 (属 adapter); 进化 = 建议 + 显式应用, 不静默改配置。
 */

export type ReflectionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** scorecard 形状 (coordination scorecard 投影, 结构化最小字段) */
export interface ScorecardSnapshot {
  runtime_target_ref: string;
  task_type: string;
  score: number;
  success_rate: number | null;
  failure_rate: number | null;
  retry_rate: number | null;
  timeout_rate: number | null;
  verifier_acceptance_rate: number | null;
}

export interface ReflectionReport {
  agent_ref: string;
  task_type: string;
  generated_at: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  observations: number;
}

export interface ReflectionServiceOptions {
  /** scorecard 读取端口 (composition root 绑定 coordination repository) */
  listScorecards: (agentRef: string | undefined, taskType: string | undefined) => ScorecardSnapshot[];
  now?: () => string;
}

export interface ReflectInput {
  agentRef: string;
  taskType?: string | null;
}

const STRONG_SCORE = 70;
const WEAK_SCORE = 50;
const POOR_RATE = 0.7;
const HIGH_RETRY = 0.3;

export class ReflectionService {
  private readonly listScorecards: ReflectionServiceOptions['listScorecards'];
  private readonly now: () => string;

  constructor(options: ReflectionServiceOptions) {
    this.listScorecards = options.listScorecards;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  reflect(input: ReflectInput): ReflectionResult<ReflectionReport> {
    if (!input.agentRef) return { ok: false, error: 'agentRef is required' };
    const snapshots = this.listScorecards(input.agentRef, input.taskType ?? undefined);
    if (snapshots.length === 0) {
      return { ok: false, error: `no scorecard observations for agent '${input.agentRef}'` };
    }

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];

    for (const card of snapshots) {
      const label = `task '${card.task_type}' on '${card.runtime_target_ref}' (score ${card.score.toFixed(1)})`;
      if (card.score >= STRONG_SCORE) {
        strengths.push(`${label}: 表现稳定`);
      } else if (card.score < WEAK_SCORE) {
        weaknesses.push(`${label}: 得分偏低`);
      }
      if (card.success_rate !== null && card.success_rate < POOR_RATE) {
        weaknesses.push(`${label}: 成功率 ${(card.success_rate * 100).toFixed(0)}% 低于阈值`);
        suggestions.push(`${card.task_type}: 检查常见失败模式, 沉淀 lesson 帖`);
      }
      if (card.retry_rate !== null && card.retry_rate > HIGH_RETRY) {
        suggestions.push(`${card.task_type}: 重试率 ${(card.retry_rate * 100).toFixed(0)}% 偏高, 先验证环境再执行`);
      }
      if (card.timeout_rate !== null && card.timeout_rate > HIGH_RETRY) {
        suggestions.push(`${card.task_type}: 超时率偏高, 收敛任务粒度或补充上下文`);
      }
      if (card.verifier_acceptance_rate !== null && card.verifier_acceptance_rate < POOR_RATE) {
        suggestions.push(`${card.task_type}: verifier 验收率低, 交付前自检 evidence 清单`);
      }
    }

    if (strengths.length === 0 && weaknesses.length === 0) {
      strengths.push(`task '${snapshots[0]?.task_type ?? '-'}': 中位表现, 无显著异常`);
    }
    if (suggestions.length === 0) {
      suggestions.push('保持当前策略; 空闲时把近期经验发到 forum (lesson/howto)');
    }

    const summary = `反思 ${snapshots.length} 条 scorecard 观察: 强项 ${strengths.length}, 弱项 ${weaknesses.length}, 建议 ${suggestions.length} 条`;
    return {
      ok: true,
      data: {
        agent_ref: input.agentRef,
        task_type: input.taskType ?? '*',
        generated_at: this.now(),
        summary,
        strengths,
        weaknesses,
        suggestions: [...new Set(suggestions)],
        observations: snapshots.length,
      },
    };
  }
}
