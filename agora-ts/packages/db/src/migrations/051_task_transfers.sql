-- 045_task_transfers.sql — T_transfer assignee reassignment ledger.
--
-- Shortest path per follow-up-T-transfer-design.md §5: one table, indexed by
-- task. Rows start as `pending` (written by CLI / connector slash), then are
-- applied or rejected through the existing approval queue
-- (approval_requests.gate_type = 'task_transfer') or a direct dashboard
-- session call.

CREATE TABLE IF NOT EXISTS task_transfers (
  id                    TEXT PRIMARY KEY,
  task_id               TEXT NOT NULL,
  from_runtime_ref      TEXT NOT NULL,
  to_runtime_ref        TEXT NOT NULL,
  target_employment_id  TEXT,
  reason                TEXT NOT NULL,
  decided_by            TEXT,
  approval_id           TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',  -- pending | applied | rejected | cancelled
  applied_at            TEXT,
  rejected_at           TEXT,
  cancelled_at          TEXT,
  metadata              TEXT,                              -- JSON: previous team.members snapshot + comment
  created_at            TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_transfers_task
  ON task_transfers(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_transfers_status
  ON task_transfers(status, created_at DESC);
