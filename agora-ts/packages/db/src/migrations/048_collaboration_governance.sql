CREATE TABLE IF NOT EXISTS collaboration_requirements (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_revision_id TEXT NOT NULL REFERENCES task_spec_revisions(id) ON DELETE RESTRICT,
  task_revision_digest TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('single', 'fanout', 'review', 'debate', 'council')),
  min_agents INTEGER NOT NULL CHECK (min_agents > 0 AND min_agents <= 32),
  max_agents INTEGER NOT NULL CHECK (max_agents > 0 AND max_agents <= 32),
  required_roles TEXT NOT NULL,
  required_capabilities TEXT NOT NULL,
  quorum INTEGER NOT NULL CHECK (quorum > 0 AND quorum <= 32),
  reviewer_required INTEGER NOT NULL CHECK (reviewer_required IN (0, 1)),
  information_domains TEXT NOT NULL,
  created_by TEXT NOT NULL,
  requirement_digest TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'superseded')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  CHECK (min_agents <= max_agents),
  CHECK (quorum <= max_agents)
);

CREATE INDEX IF NOT EXISTS idx_collaboration_requirements_task
  ON collaboration_requirements(task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subtask_specs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requirement_id TEXT NOT NULL REFERENCES collaboration_requirements(id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL CHECK (ordinal > 0),
  parent_spec_id TEXT REFERENCES subtask_specs(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  acceptance_criteria TEXT NOT NULL,
  dependency_spec_ids TEXT NOT NULL,
  required_capabilities TEXT NOT NULL,
  preferred_role TEXT,
  assignee_ref TEXT,
  information_domain TEXT NOT NULL,
  created_by TEXT NOT NULL,
  spec_digest TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'retired')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subtask_specs_task
  ON subtask_specs(task_id, ordinal ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_subtask_specs_requirement
  ON subtask_specs(requirement_id, ordinal ASC);

CREATE TABLE IF NOT EXISTS delegation_authorities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requirement_id TEXT NOT NULL REFERENCES collaboration_requirements(id) ON DELETE RESTRICT,
  scope TEXT NOT NULL CHECK (scope IN ('task', 'subtask')),
  subtask_spec_id TEXT REFERENCES subtask_specs(id) ON DELETE RESTRICT,
  delegator_ref TEXT NOT NULL,
  delegate_ref TEXT NOT NULL,
  allowed_actions TEXT NOT NULL,
  max_delegation_depth INTEGER NOT NULL CHECK (max_delegation_depth >= 0 AND max_delegation_depth <= 16),
  expires_at TEXT,
  created_by TEXT NOT NULL,
  authority_digest TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  CHECK ((scope = 'subtask' AND subtask_spec_id IS NOT NULL) OR (scope = 'task' AND subtask_spec_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_delegation_authorities_task
  ON delegation_authorities(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delegation_authorities_requirement
  ON delegation_authorities(requirement_id, created_at DESC);

CREATE TABLE IF NOT EXISTS collaboration_plans (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requirement_id TEXT NOT NULL REFERENCES collaboration_requirements(id) ON DELETE RESTRICT,
  task_revision_id TEXT NOT NULL REFERENCES task_spec_revisions(id) ON DELETE RESTRICT,
  task_revision_digest TEXT NOT NULL,
  subtask_spec_ids TEXT NOT NULL,
  delegation_authority_ids TEXT NOT NULL,
  coordination_run_ref TEXT,
  plan_digest TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'approved', 'active', 'completed', 'rejected')),
  created_by TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collaboration_plans_task
  ON collaboration_plans(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collaboration_plans_requirement
  ON collaboration_plans(requirement_id, created_at DESC);
