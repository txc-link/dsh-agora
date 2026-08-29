/**
 * forum.repository.ts — org-aware-work-os S6: 论坛存储 (SQLite).
 *
 * posts: 项目作用域, category/tags/refs JSON 存储; comments: post 外键。
 * search: keyword 对 title/content LIKE; tag/category/author 精确过滤。
 */

import { randomUUID } from 'node:crypto';
import type { AgoraDatabase } from '../database.js';
import type {
  ForumCategory,
  ForumCommentRecord,
  ForumPostInsertInput,
  ForumPostQuery,
  ForumPostRecord,
  IForumRepository,
} from '@agora-ts/contracts';

function parseStringArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export class ForumRepository implements IForumRepository {
  private readonly db: AgoraDatabase;

  constructor(db: AgoraDatabase) {
    this.db = db;
  }

  insertPost(input: ForumPostInsertInput): ForumPostRecord {
    const id = input.id ?? randomUUID();
    const createdAt = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO forum_posts (id, project_id, author, title, category, content, refs, tags, created_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.project_id,
      input.author,
      input.title,
      input.category,
      input.content,
      JSON.stringify(input.refs ?? []),
      JSON.stringify(input.tags ?? []),
      createdAt,
      input.metadata ? JSON.stringify(input.metadata) : null,
    );
    return {
      id,
      project_id: input.project_id,
      author: input.author,
      title: input.title,
      category: input.category,
      content: input.content,
      refs: input.refs ?? [],
      tags: input.tags ?? [],
      created_at: createdAt,
      metadata: input.metadata ?? null,
    };
  }

  getPost(id: string): ForumPostRecord | null {
    const row = this.db.prepare('SELECT * FROM forum_posts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToPost(row) : null;
  }

  listPosts(query: ForumPostQuery): ForumPostRecord[] {
    const conditions: string[] = ['project_id = ?'];
    const params: string[] = [query.project_id];
    if (query.category) {
      conditions.push('category = ?');
      params.push(query.category);
    }
    if (query.author) {
      conditions.push('author = ?');
      params.push(query.author);
    }
    if (query.keyword) {
      conditions.push('(title LIKE ? OR content LIKE ?)');
      params.push(`%${query.keyword}%`, `%${query.keyword}%`);
    }
    const rows = this.db.prepare(
      `SELECT * FROM forum_posts WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
    ).all(...params, query.limit ?? 100) as Record<string, unknown>[];
    const posts = rows.map((row) => this.rowToPost(row));
    if (query.tag) {
      return posts.filter((post) => post.tags.includes(query.tag as string));
    }
    return posts;
  }

  deletePost(id: string): boolean {
    const post = this.getPost(id);
    if (!post) return false;
    this.db.prepare('DELETE FROM forum_comments WHERE post_id = ?').run(id);
    this.db.prepare('DELETE FROM forum_posts WHERE id = ?').run(id);
    return true;
  }

  insertComment(postId: string, author: string, content: string): ForumCommentRecord {
    const post = this.getPost(postId);
    if (!post) throw new Error(`forum post '${postId}' not found`);
    const record: ForumCommentRecord = {
      id: randomUUID(),
      post_id: postId,
      author,
      content,
      created_at: new Date().toISOString(),
    };
    this.db.prepare(
      `INSERT INTO forum_comments (id, post_id, author, content, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(record.id, record.post_id, record.author, record.content, record.created_at);
    return record;
  }

  listComments(postId: string): ForumCommentRecord[] {
    const rows = this.db.prepare('SELECT * FROM forum_comments WHERE post_id = ? ORDER BY created_at ASC').all(postId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      post_id: String(row.post_id),
      author: String(row.author),
      content: String(row.content),
      created_at: String(row.created_at),
    }));
  }

  private rowToPost(row: Record<string, unknown>): ForumPostRecord {
    let metadata: Record<string, unknown> | null = null;
    if (typeof row.metadata === 'string' && row.metadata.length > 0) {
      try {
        metadata = JSON.parse(row.metadata) as Record<string, unknown>;
      } catch {
        metadata = null;
      }
    }
    return {
      id: String(row.id),
      project_id: String(row.project_id),
      author: String(row.author),
      title: String(row.title),
      category: String(row.category) as ForumCategory,
      content: String(row.content),
      refs: parseStringArray(String(row.refs ?? '[]')),
      tags: parseStringArray(String(row.tags ?? '[]')),
      created_at: String(row.created_at),
      metadata,
    };
  }
}
