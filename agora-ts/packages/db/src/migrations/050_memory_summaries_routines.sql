CREATE TABLE IF NOT EXISTS task_memory_summaries (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  scope_ref TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  memory_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (task_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_task_memory_summaries_task
  ON task_memory_summaries(task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS routines (
  routine_id TEXT PRIMARY KEY,
  owner_ref TEXT NOT NULL,
  agent_ref TEXT NOT NULL,
  role_ref TEXT NOT NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  schedule TEXT NOT NULL,
  first_run_at TEXT NOT NULL,
  next_run_at TEXT NOT NULL,
  last_run_at TEXT,
  target_domain TEXT NOT NULL,
  delivery_binding_ref TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')),
  metadata TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_routines_due
  ON routines(status, next_run_at);

CREATE TABLE IF NOT EXISTS routine_runs (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES routines(routine_id) ON DELETE CASCADE,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'claimed', 'succeeded', 'failed', 'cancelled')),
  consumer_ref TEXT,
  lease_token TEXT,
  lease_expires_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (routine_id, scheduled_for)
);

CREATE INDEX IF NOT EXISTS idx_routine_runs_due
  ON routine_runs(status, scheduled_for, lease_expires_at);
