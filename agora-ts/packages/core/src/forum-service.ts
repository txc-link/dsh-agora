/**
 * forum-service.ts — org-aware-work-os S6: 论坛编排 (§1 纯 Core).
 *
 * 语义: agent 经验沉淀/互学平台; 帖子 = lesson|howto|insight|question|proposal;
 * relevantPosts = 学习注入 (新任务开始时检索相关经验进上下文)。
 */

import type {
  ForumCategory,
  ForumCommentRecord,
  ForumPostInsertInput,
  ForumPostQuery,
  ForumPostRecord,
  IForumRepository,
} from '@agora-ts/contracts';

export type ForumResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const FORUM_CATEGORIES: readonly ForumCategory[] = ['lesson', 'howto', 'insight', 'question', 'proposal'];

export interface ForumServiceOptions {
  forumRepo: IForumRepository;
}

export interface CreatePostInput {
  projectId: string;
  author: string;
  title: string;
  category: ForumCategory;
  content: string;
  refs?: string[];
  tags?: string[];
}

export interface RelevantPostsInput {
  projectId: string;
  /** 任务类型 → 匹配帖子 tags */
  taskType?: string | null;
  /** 显式标签 */
  tags?: string[];
  limit?: number;
}

export class ForumService {
  private readonly forumRepo: IForumRepository;

  constructor(options: ForumServiceOptions) {
    this.forumRepo = options.forumRepo;
  }

  createPost(input: CreatePostInput): ForumResult<ForumPostRecord> {
    if (!input.projectId || !input.author || !input.title || !input.content) {
      return { ok: false, error: 'projectId, author, title and content are required' };
    }
    if (!FORUM_CATEGORIES.includes(input.category)) {
      return { ok: false, error: `category must be one of: ${FORUM_CATEGORIES.join(', ')}` };
    }
    const post = this.forumRepo.insertPost({
      project_id: input.projectId,
      author: input.author,
      title: input.title,
      category: input.category,
      content: input.content,
      refs: input.refs ?? [],
      tags: input.tags ?? [],
    });
    return { ok: true, data: post };
  }

  getPost(postId: string): ForumPostRecord | null {
    return this.forumRepo.getPost(postId);
  }

  listPosts(query: ForumPostQuery): ForumPostRecord[] {
    return this.forumRepo.listPosts(query);
  }

  comment(postId: string, author: string, content: string): ForumResult<ForumCommentRecord> {
    if (!this.forumRepo.getPost(postId)) {
      return { ok: false, error: `forum post '${postId}' not found` };
    }
    if (!author || !content) {
      return { ok: false, error: 'author and content are required' };
    }
    return { ok: true, data: this.forumRepo.insertComment(postId, author, content) };
  }

  listComments(postId: string): ForumCommentRecord[] {
    return this.forumRepo.listComments(postId);
  }

  /** 学习注入: 按标签/任务类型检索相关帖子 (含经验正文), 供任务上下文使用 */
  relevantPosts(input: RelevantPostsInput): ForumPostRecord[] {
    const tags = [...(input.tags ?? []), ...(input.taskType ? [input.taskType] : [])];
    const collected: ForumPostRecord[] = [];
    const seen = new Set<string>();
    for (const tag of tags) {
      for (const post of this.forumRepo.listPosts({ project_id: input.projectId, tag, limit: input.limit ?? 5 })) {
        if (!seen.has(post.id)) {
          seen.add(post.id);
          collected.push(post);
        }
      }
    }
    if (collected.length === 0 && (input.taskType || tags.length === 0)) {
      // 兜底检索: 同项目最近 lesson/howto (跨类型经验仍有学习价值)
      return this.forumRepo.listPosts({ project_id: input.projectId, limit: input.limit ?? 5 })
        .filter((post) => post.category === 'lesson' || post.category === 'howto');
    }
    return collected;
  }
}
