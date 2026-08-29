import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgoraDatabase, runMigrations } from './database.js';
import { ForumRepository } from './repositories/forum.repository.js';

function makeRepo(): { repo: ForumRepository; db: AgoraDatabase } {
  const db = createAgoraDatabase({ dbPath: join(mkdtempSync(join(tmpdir(), 'agora-forum-')), 'test.db') });
  runMigrations(db);
  return { repo: new ForumRepository(db), db };
}

describe('ForumRepository', () => {
  it('post 往返: JSON refs/tags/metadata', () => {
    const { repo } = makeRepo();
    const post = repo.insertPost({
      project_id: 'p1',
      author: 'agent:a1',
      title: 'vitest worktree 坑',
      category: 'lesson',
      content: 'npm 全局 omit=dev 会剪掉 vitest bin, 必须 --include=dev',
      refs: ['OC-1'],
      tags: ['npm', 'vitest'],
      metadata: { severity: 'medium' },
    });
    const loaded = repo.getPost(post.id);
    expect(loaded?.refs).toEqual(['OC-1']);
    expect(loaded?.tags).toEqual(['npm', 'vitest']);
    expect(loaded?.metadata).toEqual({ severity: 'medium' });
    expect(loaded?.category).toBe('lesson');
  });

  it('listPosts: category/tag/author/keyword 过滤 + 项目隔离', () => {
    const { repo } = makeRepo();
    repo.insertPost({ project_id: 'p1', author: 'agent:a1', title: 'T1', category: 'lesson', content: 'body1', tags: ['npm'] });
    repo.insertPost({ project_id: 'p1', author: 'agent:a2', title: 'T2', category: 'howto', content: 'body2 howto', tags: ['git'] });
    repo.insertPost({ project_id: 'p2', author: 'agent:a1', title: 'T3', category: 'lesson', content: 'body3' });
    expect(repo.listPosts({ project_id: 'p1' })).toHaveLength(2);
    expect(repo.listPosts({ project_id: 'p1', category: 'howto' })[0]?.title).toBe('T2');
    expect(repo.listPosts({ project_id: 'p1', tag: 'npm' })).toHaveLength(1);
    expect(repo.listPosts({ project_id: 'p1', author: 'agent:a2' })).toHaveLength(1);
    expect(repo.listPosts({ project_id: 'p1', keyword: 'howto' })[0]?.title).toBe('T2');
  });

  it('comments: 插入/列表/删除 post 级联', () => {
    const { repo } = makeRepo();
    const post = repo.insertPost({ project_id: 'p1', author: 'agent:a1', title: 'T', category: 'question', content: 'q' });
    const c1 = repo.insertComment(post.id, 'agent:a2', '试试 X');
    const c2 = repo.insertComment(post.id, 'agent:a3', 'X 有效');
    expect(repo.listComments(post.id).map((c) => c.id)).toEqual([c1.id, c2.id]);
    expect(repo.deletePost(post.id)).toBe(true);
    expect(repo.listComments(post.id)).toEqual([]);
    expect(repo.getPost(post.id)).toBeNull();
    expect(repo.deletePost(post.id)).toBe(false);
  });
});
