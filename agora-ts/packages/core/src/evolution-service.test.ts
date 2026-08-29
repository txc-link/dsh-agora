import { describe, expect, it } from 'vitest';
import { EvolutionService } from './evolution-service.js';
import { ForumService } from './forum-service.js';
import type { ForumPostRecord } from '@agora-ts/contracts';
import type { ReflectionReport } from './reflection-service.js';

function makeForum(): ForumService {
  const posts: ForumPostRecord[] = [];
  let seq = 0;
  const repo = {
    insertPost(input: Omit<ForumPostRecord, 'created_at' | 'metadata'> & { metadata?: Record<string, unknown> | null }) {
      seq += 1;
      const record: ForumPostRecord = {
        ...input,
        metadata: input.metadata ?? null,
        created_at: '2026-08-30T10:00:00.000Z',
      } as ForumPostRecord;
      posts.push(record);
      return record;
    },
    getPost(id: string) {
      return posts.find((p) => p.id === id) ?? null;
    },
    listPosts(query: Record<string, unknown>) {
      return posts.filter((p) => (query.project_id ? p.project_id === query.project_id : true));
    },
    updatePost(id: string, patch: Partial<ForumPostRecord>) {
      const idx = posts.findIndex((p) => p.id === id);
      if (idx < 0) return null;
      posts[idx] = { ...posts[idx]!, ...patch };
      return posts[idx]!;
    },
    deletePost() {
      return false;
    },
    insertComment(postId: string, author: string, content: string) {
      return { id: `c-${postId}`, post_id: postId, author, content, created_at: '2026-08-30T10:00:00.000Z' } as never;
    },
    listComments() {
      return [];
    },
  };
  return new ForumService({ forumRepo: repo as never });
}

const report: ReflectionReport = {
  agent_ref: 'agent:dev-1',
  task_type: 'coding',
  generated_at: '2026-08-30T10:00:00.000Z',
  summary: '近 5 次执行 2 次超时',
  strengths: ['测试覆盖好'],
  weaknesses: ['环境准备耗时'],
  suggestions: ['预装依赖缓存', '拆小执行粒度'],
  observations: 5,
};

describe('EvolutionService', () => {
  it('proposeFromReport: 反思报告 → proposal 帖 (status=proposed)', () => {
    const evolution = new EvolutionService({ forumService: makeForum() });
    const result = evolution.proposeFromReport({ report, projectId: 'p-1' });
    expect(result.ok).toBe(true);
    const post = result.post!;
    expect(post.category).toBe('proposal');
    expect(post.author).toBe('agent:dev-1');
    expect(post.content).toContain('预装依赖缓存');
    expect((post.metadata as Record<string, unknown>).evolution).toMatchObject({
      status: 'proposed',
      task_type: 'coding',
    });
  });

  it('apply: proposal → applied, 记录 applied_by; 重复 apply 被拒', () => {
    const evolution = new EvolutionService({ forumService: makeForum() });
    const proposed = evolution.proposeFromReport({ report, projectId: 'p-1' }).post!;
    const applied = evolution.apply({ postId: proposed.id, appliedBy: 'human:ceo' });
    expect(applied.ok).toBe(true);
    expect((applied.post!.metadata as Record<string, unknown>).evolution).toMatchObject({
      status: 'applied',
      applied_by: 'human:ceo',
    });

    const again = evolution.apply({ postId: proposed.id, appliedBy: 'human:ceo' });
    expect(again.ok).toBe(false);
    expect(again.error).toContain('applied');
  });

  it('apply: 非 proposal 帖被拒; 不存在帖子被拒', () => {
    const forum = makeForum();
    const evolution = new EvolutionService({ forumService: forum });
    forum.createPost({
      projectId: 'p-1',
      author: 'agent:dev-1',
      title: 'lesson 帖',
      category: 'lesson',
      content: 'x',
    });
    const lesson = forum.listPosts({}).find((p) => p.category === 'lesson')!;
    const wrongKind = evolution.apply({ postId: lesson.id, appliedBy: 'human:ceo' });
    expect(wrongKind.ok).toBe(false);
    expect(wrongKind.error).toContain('proposal');
    const missing = evolution.apply({ postId: 'no-such', appliedBy: 'human:ceo' });
    expect(missing.ok).toBe(false);
  });
});
