/**
 * forum-vault-writer.ts — Phase 6 / S4 收尾: 论坛帖子 → obsidian vault 资料沉淀分组.
 *
 * 用户语义 (turn 160): "资料沉淀分组可以用 obsidian"。Obsidian vault 就是一个
 * 本地文件夹 — 直接写 markdown, Obsidian 自动刷新, 不依赖 REST plugin。
 *
 * 分组映射: <vaultRoot>/<baseFolder>/<project||default>/<category>/<date>-<slug>.md
 * frontmatter 携带 tags/task_id/author, 正文含帖子内容与评论线程。
 * 文件名冲突用序号后缀; 覆盖判断按 id 外置索引 (.agora-forum-index.json)。
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ForumVaultPost {
  id: string;
  project_id?: string | null | undefined;
  author: string;
  title: string;
  category: string;
  content: string;
  refs?: string[] | undefined;
  tags?: string[] | undefined;
  created_at: string;
  metadata?: Record<string, unknown> | null | undefined;
}

export interface ForumVaultComment {
  id: string;
  post_id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface ForumVaultWriterOptions {
  /** obsidian vault 根目录 (本地文件夹) */
  vaultRoot: string;
  /** 分组根文件夹名 (默认 Agora) */
  baseFolder?: string;
  /** 无 project_id 帖子落入的分组 (默认 default) */
  defaultProject?: string;
}

export interface ForumVaultWriteResult {
  written: string[];
  skipped: number;
}

function slugify(text: string): string {
  const cleaned = text.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return cleaned.slice(0, 60) || 'post';
}

function frontmatter(post: ForumVaultPost): string {
  const tags = post.tags ?? [];
  const lines = [
    '---',
    `agora_id: ${post.id}`,
    `category: ${post.category}`,
    `author: ${post.author}`,
    `created: ${post.created_at}`,
    ...(post.project_id ? [`project: ${post.project_id}`] : []),
    ...(tags.length > 0 ? [`tags: [${tags.join(', ')}]`] : []),
    '---',
  ];
  return lines.join('\n');
}

function postMarkdown(post: ForumVaultPost, comments: ForumVaultComment[]): string {
  const parts = [frontmatter(post), '', `# ${post.title}`, '', post.content, ''];
  if (comments.length > 0) {
    parts.push('## 评论', '');
    for (const c of comments) {
      parts.push(`- **${c.author}** (${c.created_at}): ${c.content}`);
    }
    parts.push('');
  }
  return parts.join('\n');
}

export class ForumVaultWriter {
  private readonly vaultRoot: string;
  private readonly baseFolder: string;
  private readonly defaultProject: string;

  constructor(options: ForumVaultWriterOptions) {
    this.vaultRoot = options.vaultRoot;
    this.baseFolder = options.baseFolder ?? 'Agora';
    this.defaultProject = options.defaultProject ?? 'default';
  }

  /**
   * 按 project + category 分组写入帖子; 已写入过 (索引含 post id) 的跳过。
   * comments 按 post_id 分组传入。
   */
  syncPosts(posts: ForumVaultPost[], comments: ForumVaultComment[] = []): ForumVaultWriteResult {
    const index = this.loadIndex();
    const written: string[] = [];
    const commentsByPost = new Map<string, ForumVaultComment[]>();
    for (const c of comments) {
      const list = commentsByPost.get(c.post_id) ?? [];
      list.push(c);
      commentsByPost.set(c.post_id, list);
    }

    for (const post of posts) {
      if (index[post.id]) {
        continue;
      }
      const project = post.project_id || this.defaultProject;
      const dir = join(this.vaultRoot, this.baseFolder, project, post.category);
      mkdirSync(dir, { recursive: true });
      const date = post.created_at.slice(0, 10);
      let fileName = `${date}-${slugify(post.title)}.md`;
      let filePath = join(dir, fileName);
      let n = 2;
      while (existsSync(filePath)) {
        fileName = `${date}-${slugify(post.title)}-${n}.md`;
        filePath = join(dir, fileName);
        n += 1;
      }
      writeFileSync(filePath, postMarkdown(post, commentsByPost.get(post.id) ?? []), 'utf8');
      index[post.id] = filePath;
      written.push(filePath);
    }

    if (written.length > 0) {
      writeFileSync(this.indexPath(), JSON.stringify(index, null, 2), 'utf8');
    }
    return { written, skipped: posts.length - written.length };
  }

  private indexPath(): string {
    return join(this.vaultRoot, this.baseFolder, '.agora-forum-index.json');
  }

  private loadIndex(): Record<string, string> {
    const path = this.indexPath();
    if (!existsSync(path)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    } catch {
      return {};
    }
  }
}
