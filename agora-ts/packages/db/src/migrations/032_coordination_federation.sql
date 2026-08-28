CREATE TABLE IF NOT EXISTS coordination_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  candidates TEXT NOT NULL,
  verifier_target_ref TEXT,
  budget TEXT NOT NULL,
  usage TEXT NOT NULL,
  memory_scopes TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata TEXT,
  synthesis TEXT,
  stop_reason TEXT,
  deadline_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_coordination_runs_status
  ON coordination_runs(status, updated_at);

CREATE TABLE IF NOT EXISTS coordination_members (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES coordination_runs(id) ON DELETE CASCADE,
  dispatch_id TEXT NOT NULL UNIQUE REFERENCES runtime_node_dispatches(id) ON DELETE RESTRICT,
  runtime_target_ref TEXT NOT NULL,
  role TEXT NOT NULL,
  round INTEGER NOT NULL,
  status TEXT NOT NULL,
  selection_score REAL NOT NULL,
  selection_reason TEXT NOT NULL,
  result_envelope TEXT,
  usage TEXT,
  observation_recorded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_coordination_members_run
  ON coordination_members(run_id, round, created_at);

CREATE TABLE IF NOT EXISTS runtime_agent_observations (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE REFERENCES coordination_members(id) ON DELETE CASCADE,
  runtime_target_ref TEXT NOT NULL,
  task_type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  timed_out INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  claim_count INTEGER NOT NULL DEFAULT 0,
  verifier_accepted INTEGER,
  agreement_ratio REAL,
  information_gain REAL,
  environment_drift INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER,
  cost_usd REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runtime_agent_observations_scorecard
  ON runtime_agent_observations(runtime_target_ref, task_type, created_at);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  media_type TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_uri TEXT NOT NULL,
  owner_kind TEXT NOT NULL,
  owner_ref TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_owner ON artifacts(owner_kind, owner_ref, created_at);
CREATE INDEX IF NOT EXISTS idx_artifacts_hash ON artifacts(sha256);

CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  content TEXT NOT NULL,
  owner_ref TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  agent_ref TEXT,
  visibility TEXT NOT NULL,
  source TEXT NOT NULL,
  artifact_ids TEXT NOT NULL,
  evidence_ids TEXT NOT NULL,
  metadata TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_entries_scope
  ON memory_entries(scope, project_id, task_id, agent_ref, created_at);

CREATE TABLE IF NOT EXISTS runtime_node_credentials (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  last_used_at TEXT,
  rotated_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_node_credentials_node
  ON runtime_node_credentials(node_id, status, created_at);

CREATE TABLE IF NOT EXISTS merge_proposals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  base_revision TEXT NOT NULL,
  head_revision TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  diff_summary TEXT NOT NULL,
  validation_artifact_ids TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  metadata TEXT,
  status TEXT NOT NULL,
  approved_by TEXT,
  decision_reason TEXT,
  merge_commit TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  decided_at TEXT,
  merged_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_merge_proposals_project
  ON merge_proposals(project_id, status, created_at);
