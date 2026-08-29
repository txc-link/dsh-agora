import { describe, expect, it } from 'vitest';
import { ForumService } from './forum-service.js';
import { ReflectionService, type ScorecardSnapshot } from './reflection-service.js';
import type {
  ForumCommentRecord,
  ForumPostInsertInput,
  ForumPostQuery,
  ForumPostRecord,
  IForumRepository,
} from '@agora-ts/contracts';

function makeForumRepo(): IForumRepository {
  const posts = new Map<string, ForumPostRecord>();
  const comments = new Map<string, ForumCommentRecord>();
  let postN = 0;
  let commentN = 0;
  return {
    insertPost(input: ForumPostInsertInput): ForumPostRecord {
      const id = `post-${++postN}`;
      const rec: ForumPostRecord = {
        id,
        project_id: input.project_id,
        author: input.author,
        title: input.title,
        category: input.category,
        content: input.content,
        refs: input.refs ?? [],
        tags: input.tags ?? [],
        created_at: new Date(Date.now() + postN).toISOString(),
        metadata: null,
      };
      posts.set(id, rec);
      return rec;
    },
    getPost: (id) => posts.get(id) ?? null,
    listPosts: (query: ForumPostQuery) =>
      [...posts.values()]
        .filter((p) => p.project_id === query.project_id)
        .filter((p) => !query.category || p.category === query.category)
        .filter((p) => !query.author || p.author === query.author)
        .filter((p) => !query.tag || p.tags.includes(query.tag))
        .filter((p) => !query.keyword || p.title.includes(query.keyword) || p.content.includes(query.keyword))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, query.limit ?? 100),
    deletePost: (id) => posts.delete(id),
    insertComment: (postId, author, content) => {
      const rec: ForumCommentRecord = { id: `c-${++commentN}`, post_id: postId, author, content, created_at: new Date().toISOString() };
      comments.set(rec.id, rec);
      return rec;
    },
    listComments: (postId) => [...comments.values()].filter((c) => c.post_id === postId),
  };
}

describe('ForumService', () => {
  it('createPost: 合法 + category 校验', () => {
    const service = new ForumService({ forumRepo: makeForumRepo() });
    const ok = service.createPost({ projectId: 'p1', author: 'agent:a1', title: 'T', category: 'lesson', content: 'body' });
    expect(ok.ok).toBe(true);
    const bad = service.createPost({ projectId: 'p1', author: 'agent:a1', title: 'T', category: 'rant' as never, content: 'body' });
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain('category');
  });

  it('comment: 帖子必须存在', () => {
    const service = new ForumService({ forumRepo: makeForumRepo() });
    expect(service.comment('nope', 'agent:a', 'x').ok).toBe(false);
    const post = (service.createPost({ projectId: 'p1', author: 'agent:a1', title: 'T', category: 'question', content: 'q' }).data) as ForumPostRecord;
    const added = service.comment(post.id, 'agent:a2', 'answer');
    expect(added.ok).toBe(true);
    expect(service.listComments(post.id)).toHaveLength(1);
  });

  it('relevantPosts: tag 匹配 + taskType 匹配 + 无命中兜底 lesson/howto', () => {
    const service = new ForumService({ forumRepo: makeForumRepo() });
    service.createPost({ projectId: 'p1', author: 'agent:a1', title: 'npm 坑', category: 'lesson', content: 'omit=dev', tags: ['npm', 'deploy'] });
    service.createPost({ projectId: 'p1', author: 'agent:a2', title: 'git flow', category: 'howto', content: 'worktree', tags: ['git'] });
    service.createPost({ projectId: 'p1', author: 'agent:a3', title: '杂谈', category: 'insight', content: 'misc', tags: ['misc'] });

    const byTag = service.relevantPosts({ projectId: 'p1', tags: ['npm'] });
    expect(byTag).toHaveLength(1);
    const byTaskType = service.relevantPosts({ projectId: 'p1', taskType: 'deploy' });
    expect(byTaskType).toHaveLength(1);
    const fallback = service.relevantPosts({ projectId: 'p1', tags: ['no-match'] });
    expect(fallback.every((p) => p.category === 'lesson' || p.category === 'howto')).toBe(true);
    // p2 无帖子 → 空
    expect(service.relevantPosts({ projectId: 'p2', tags: ['npm'] })).toHaveLength(0);
  });
});

describe('ReflectionService', () => {
  const strong: ScorecardSnapshot = {
    runtime_target_ref: 'rt:a', task_type: 'impl', score: 85,
    success_rate: 0.9, failure_rate: 0.1, retry_rate: 0.1, timeout_rate: 0.05, verifier_acceptance_rate: 0.95,
  };
  const weak: ScorecardSnapshot = {
    runtime_target_ref: 'rt:b', task_type: 'review', score: 40,
    success_rate: 0.5, failure_rate: 0.5, retry_rate: 0.5, timeout_rate: 0.4, verifier_acceptance_rate: 0.3,
  };

  it('强/弱分档 + 确定性建议', () => {
    const service = new ReflectionService({ listScorecards: () => [strong, weak], now: () => '2026-08-30T00:00:00.000Z' });
    const result = service.reflect({ agentRef: 'agent:a1' });
    expect(result.ok).toBe(true);
    const report = result.data as { summary: string; strengths: string[]; weaknesses: string[]; suggestions: string[]; observations: number };
    expect(report.strengths.join(' ')).toContain('impl');
    expect(report.weaknesses.join(' ')).toContain('review');
    expect(report.suggestions.join(' ')).toContain('重试率');
    expect(report.suggestions.join(' ')).toContain('超时率');
    expect(report.suggestions.join(' ')).toContain('verifier');
    expect(report.observations).toBe(2);
  });

  it('无观察被拒; 全正常时给保底建议', () => {
    const empty = new ReflectionService({ listScorecards: () => [] });
    expect(empty.reflect({ agentRef: 'agent:x' }).ok).toBe(false);
    const normal = new ReflectionService({ listScorecards: () => [strong] });
    const result = normal.reflect({ agentRef: 'agent:a1' });
    expect(result.ok).toBe(true);
    expect((result.data as { suggestions: string[] }).suggestions.length).toBeGreaterThan(0);
  });
});
