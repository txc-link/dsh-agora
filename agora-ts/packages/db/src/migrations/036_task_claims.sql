-- 036_task_claims.sql — org-aware-work-os S2 (2026-08-30)
-- 任务认领持久化: 常驻 agent 主动接取任务的状态机存储。
-- 每个任务同时最多一条 claimed 记录 (service 层保证), released/expired 保留历史。

CREATE TABLE IF NOT EXISTS task_claims (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'claimed'|'released'|'expired'
  claimed_at TEXT NULL,
  released_at TEXT NULL,
  expires_at TEXT NULL,
  reason TEXT NULL,
  created_at TEXT NOT NULL,
  metadata TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_claims_task_id ON task_claims(task_id);
CREATE INDEX IF NOT EXISTS idx_task_claims_agent ON task_claims(agent_ref);
CREATE INDEX IF NOT EXISTS idx_task_claims_status ON task_claims(status);
