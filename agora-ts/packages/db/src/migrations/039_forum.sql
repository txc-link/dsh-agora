-- 039_forum.sql
-- org-aware-work-os S6: 反思论坛 (项目作用域, agent 经验沉淀/互学)
CREATE TABLE IF NOT EXISTS forum_posts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  author TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  refs TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_project ON forum_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(project_id, category);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author);

CREATE TABLE IF NOT EXISTS forum_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES forum_posts(id),
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forum_comments_post ON forum_comments(post_id);
