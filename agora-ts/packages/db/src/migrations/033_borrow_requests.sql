-- 033_borrow_requests.sql — Phase 3.5 (U3=C / U4=A)
-- borrow 请求持久化: ACL 跟 scope 一起持久化, Core 决策一次查完。

CREATE TABLE IF NOT EXISTS borrow_requests (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  target TEXT NOT NULL,
  scope TEXT NOT NULL,
  permissions TEXT NOT NULL,        -- JSON array of 'read'|'write'|'delete'|'execute'
  posture TEXT NOT NULL,            -- 'Strict'|'Auto'|'Dangerous'
  ttl_ms INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  outcome TEXT NULL,
  decided_at TEXT NULL,
  created_at TEXT NOT NULL,
  metadata TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_borrow_requests_actor ON borrow_requests(actor);
CREATE INDEX IF NOT EXISTS idx_borrow_requests_status ON borrow_requests(status);
