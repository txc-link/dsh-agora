CREATE TABLE IF NOT EXISTS runtime_nodes (
  node_id TEXT PRIMARY KEY,
  protocol TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  plugin_version TEXT NOT NULL,
  host_framework TEXT NOT NULL,
  runtime_provider TEXT NOT NULL,
  agents TEXT NOT NULL DEFAULT '[]',
  bots TEXT NOT NULL DEFAULT '[]',
  capacity TEXT NOT NULL DEFAULT '{}',
  lease_seconds INTEGER NOT NULL,
  metadata TEXT,
  registered_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runtime_nodes_expires_at
  ON runtime_nodes(expires_at);

CREATE TABLE IF NOT EXISTS runtime_node_dispatches (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES runtime_nodes(node_id) ON DELETE CASCADE,
  task_id TEXT,
  participant_binding_id TEXT,
  runtime_target_ref TEXT NOT NULL,
  session_id TEXT,
  workspace_alias TEXT,
  agent_preset TEXT,
  prompt TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  claimed_by TEXT,
  claim_expires_at TEXT,
  result TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_node_dispatch_claim
  ON runtime_node_dispatches(node_id, status, created_at);
