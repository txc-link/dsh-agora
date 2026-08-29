/**
 * evolution-service.ts — org-aware-work-os S6: 反思 → 进化建议（建议+确认模式）。
 *
 * 语义: ReflectionService 的报告不直接改 agent 配置文件（core 不写死配置格式）,
 * 而是落为 forum proposal 帖, 由人/agent 确认后 apply（metadata.evolution 状态机:
 * proposed → applied）。组织 OS 口径: 建议是可读工作项, 不是隐式改写。
 */
import type { ForumPostRecord } from '@agora-ts/contracts';
import type { ForumService } from './forum-service.js';
import type { ReflectionReport } from './reflection-service.js';

export type EvolutionResult<T> = { ok: true; post: T } | { ok: false; error: string };

export interface EvolutionMetadata {
  status: 'proposed' | 'applied';
  task_type: string;
  observations: number;
  applied_by?: string;
  applied_at?: string;
}

export interface EvolutionServiceOptions {
  forumService: ForumService;
}

export interface ProposeFromReportInput {
  report: ReflectionReport;
  projectId: string;
}

export interface ApplyInput {
  postId: string;
  appliedBy: string;
}

export class EvolutionService {
  private readonly forumService: ForumService;

  constructor(options: EvolutionServiceOptions) {
    this.forumService = options.forumService;
  }

  /** 反思报告 → 进化建议 proposal 帖（suggestions 进正文, metadata 记录状态） */
  proposeFromReport(input: ProposeFromReportInput): EvolutionResult<ForumPostRecord> {
    const { report, projectId } = input;
    if (!projectId) {
      return { ok: false, error: 'projectId is required' };
    }
    const lines: string[] = [
      `## 反思建议（${report.task_type}）`,
      '',
      report.summary,
      '',
      '### 建议',
      ...report.suggestions.map((s, i) => `${i + 1}. ${s}`),
      '',
      `### 依据（observations=${report.observations}）`,
      `- strengths: ${report.strengths.join('; ') || '—'}`,
      `- weaknesses: ${report.weaknesses.join('; ') || '—'}`,
      '',
      '> apply 前仅是建议; apply 后由执行者按本帖内容落地配置更新。',
    ];
    const created = this.forumService.createPost({
      projectId,
      author: report.agent_ref,
      title: `[evolution] ${report.agent_ref} ${report.task_type} 进化建议`,
      category: 'proposal',
      content: lines.join('\n'),
      tags: ['evolution', report.task_type],
      metadata: {
        evolution: {
          status: 'proposed',
          task_type: report.task_type,
          observations: report.observations,
        } satisfies EvolutionMetadata,
      },
    } as Parameters<ForumService['createPost']>[0]);
    if (!created.ok) {
      return { ok: false, error: created.error };
    }
    return { ok: true, post: created.data };
  }

  /** 确认应用: proposal → applied（幂等拒绝重复 apply） */
  apply(input: ApplyInput): EvolutionResult<ForumPostRecord> {
    const post = this.forumService.getPost(input.postId);
    if (!post) {
      return { ok: false, error: `forum post '${input.postId}' not found` };
    }
    if (post.category !== 'proposal') {
      return { ok: false, error: `post '${input.postId}' is not a proposal` };
    }
    const meta = (post.metadata ?? {}) as Record<string, unknown>;
    const evolution = { ...(meta.evolution as EvolutionMetadata | undefined) };
    if (!evolution || evolution.status !== 'proposed') {
      return { ok: false, error: `post '${input.postId}' is not in proposed status (got '${evolution?.status ?? 'none'}')` };
    }
    evolution.status = 'applied';
    evolution.applied_by = input.appliedBy;
    evolution.applied_at = new Date().toISOString();
    const updated = this.forumService.updatePostMetadata(input.postId, {
      ...meta,
      evolution,
    });
    if (!updated) {
      return { ok: false, error: `forum post '${input.postId}' update failed` };
    }
    return { ok: true, post: updated };
  }
}
