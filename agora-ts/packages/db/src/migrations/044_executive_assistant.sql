CREATE TABLE IF NOT EXISTS executive_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  requested_by TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high')),
  requested_capabilities TEXT NOT NULL DEFAULT '[]',
  task_type TEXT NOT NULL,
  project_id TEXT,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'triage', 'delegated', 'blocked', 'completed', 'cancelled')),
  assigned_position_id TEXT REFERENCES organization_positions(id) ON DELETE RESTRICT,
  assigned_employment_id TEXT REFERENCES organization_employments(id) ON DELETE RESTRICT,
  task_id TEXT REFERENCES tasks(id) ON DELETE RESTRICT,
  blocked_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_executive_requests_inbox ON executive_requests(organization_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_executive_requests_task ON executive_requests(task_id);

CREATE TABLE IF NOT EXISTS commitments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL UNIQUE REFERENCES executive_requests(id) ON DELETE RESTRICT,
  owner_position_id TEXT NOT NULL REFERENCES organization_positions(id) ON DELETE RESTRICT,
  owner_employment_id TEXT NOT NULL REFERENCES organization_employments(id) ON DELETE RESTRICT,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  summary TEXT NOT NULL,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fulfilled', 'cancelled')),
  evidence_refs TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  fulfilled_at TEXT,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_commitments_ledger ON commitments(organization_id, status, due_at, created_at);
CREATE INDEX IF NOT EXISTS idx_commitments_task ON commitments(task_id);
