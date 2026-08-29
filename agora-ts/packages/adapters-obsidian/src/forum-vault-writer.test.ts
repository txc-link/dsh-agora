import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ForumVaultWriter } from './forum-vault-writer.js';

const post = {
  id: 'fp-1',
  project_id: 'proj-a',
  author: 'agent:w1',
  title: 'worktree 换行符踩坑',
  category: 'lesson',
  content: 'cp -a node_modules 时注意 symlink 重指。',
  tags: ['worktree', 'lesson'],
  created_at: '2026-08-29T10:00:00.000Z',
  metadata: {},
};

describe('ForumVaultWriter', () => {
  it('按 project/category 分组写入 markdown, frontmatter 带齐', () => {
    const vault = mkdtempSync(join(tmpdir(), 'vault-'));
    try {
      const writer = new ForumVaultWriter({ vaultRoot: vault });
      const result = writer.syncPosts([post], [
        { id: 'fc-1', post_id: 'fp-1', author: 'agent:w2', content: '同踩过', created_at: '2026-08-29T11:00:00.000Z' },
      ]);
      expect(result.written).toHaveLength(1);
      expect(result.skipped).toBe(0);
      const filePath = join(vault, 'Agora', 'proj-a', 'lesson', '2026-08-29-worktree-换行符踩坑.md');
      expect(existsSync(filePath)).toBe(true);
      const text = readFileSync(filePath, 'utf8');
      expect(text).toContain('agora_id: fp-1');
      expect(text).toContain('tags: [worktree, lesson]');
      expect(text).toContain('## 评论');
      expect(text).toContain('agent:w2');
    } finally {
      rmSync(vault, { recursive: true, force: true });
    }
  });

  it('幂等: 同一 post 二次 sync 跳过; 同名文件冲突加序号', () => {
    const vault = mkdtempSync(join(tmpdir(), 'vault-'));
    try {
      const writer = new ForumVaultWriter({ vaultRoot: vault });
      writer.syncPosts([post]);
      const second = writer.syncPosts([post, { ...post, id: 'fp-2', title: 'worktree 换行符踩坑' }]);
      expect(second.skipped).toBe(1);
      expect(second.written).toHaveLength(1);
      expect(second.written[0]).toContain('-2.md');
    } finally {
      rmSync(vault, { recursive: true, force: true });
    }
  });

  it('无 project_id 落 default 分组', () => {
    const vault = mkdtempSync(join(tmpdir(), 'vault-'));
    try {
      const writer = new ForumVaultWriter({ vaultRoot: vault });
      const { written } = writer.syncPosts([{ ...post, id: 'fp-3', project_id: null }]);
      expect(written[0]).toContain(join('Agora', 'default', 'lesson'));
    } finally {
      rmSync(vault, { recursive: true, force: true });
    }
  });
});
