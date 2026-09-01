CREATE TABLE IF NOT EXISTS action_attempts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  collaboration_plan_id TEXT,
  execution_baseline_id TEXT,
  delegation_authority_id TEXT,
  subtask_spec_id TEXT,
  actor_ref TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('read_context', 'dispatch_subtask', 'write_artifact', 'request_approval', 'delegate')),
  subject_ref TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('admit', 'deny')),
  decision_reason TEXT NOT NULL,
  attempt_digest TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_action_attempts_task
  ON action_attempts(task_id, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_action_attempts_authority
  ON action_attempts(delegation_authority_id, created_at ASC);

CREATE TABLE IF NOT EXISTS action_receipts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  attempt_id TEXT NOT NULL UNIQUE REFERENCES action_attempts(id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'failed', 'denied')),
  provider_ref TEXT,
  evidence_refs TEXT NOT NULL,
  error_code TEXT,
  summary TEXT,
  receipt_digest TEXT NOT NULL,
  created_by TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_action_receipts_task
  ON action_receipts(task_id, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_action_receipts_attempt
  ON action_receipts(attempt_id);
