CREATE TABLE IF NOT EXISTS task_spec_revisions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  base_task_version INTEGER NOT NULL,
  parent_revision INTEGER,
  payload TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  created_by TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  UNIQUE(task_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_task_spec_revisions_task
  ON task_spec_revisions(task_id, revision DESC);

CREATE TABLE IF NOT EXISTS execution_baselines (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_revision_id TEXT NOT NULL REFERENCES task_spec_revisions(id) ON DELETE RESTRICT,
  task_revision_digest TEXT NOT NULL,
  plan_digest TEXT NOT NULL,
  input_refs TEXT NOT NULL,
  approval_refs TEXT NOT NULL,
  policy_refs TEXT NOT NULL,
  coordination_run_ref TEXT,
  agent_composition_refs TEXT NOT NULL,
  skill_adoption_refs TEXT NOT NULL,
  budget TEXT NOT NULL,
  evidence_obligations TEXT NOT NULL,
  expires_at TEXT,
  approved_by TEXT NOT NULL,
  baseline_digest TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved', 'revoked', 'superseded')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_baselines_task
  ON execution_baselines(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_baselines_revision
  ON execution_baselines(task_revision_id, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence_manifests (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_revision_id TEXT NOT NULL REFERENCES task_spec_revisions(id) ON DELETE RESTRICT,
  execution_baseline_id TEXT NOT NULL REFERENCES execution_baselines(id) ON DELETE RESTRICT,
  execution_baseline_digest TEXT NOT NULL,
  input_refs TEXT NOT NULL,
  approval_refs TEXT NOT NULL,
  policy_refs TEXT NOT NULL,
  run_refs TEXT NOT NULL,
  output_artifact_refs TEXT NOT NULL,
  notes TEXT,
  created_by TEXT NOT NULL,
  manifest_digest TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status = 'sealed'),
  idempotency_key TEXT NOT NULL UNIQUE,
  sealed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evidence_manifests_task
  ON evidence_manifests(task_id, sealed_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_manifests_baseline
  ON evidence_manifests(execution_baseline_id, sealed_at DESC);
