CREATE TABLE IF NOT EXISTS runtime_node_deliveries (
  id TEXT PRIMARY KEY,
  dispatch_id TEXT NOT NULL UNIQUE REFERENCES runtime_node_dispatches(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES runtime_nodes(node_id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  claimed_by TEXT,
  claim_token TEXT,
  claim_expires_at TEXT,
  next_attempt_at TEXT NOT NULL,
  receipt TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_node_delivery_claim
  ON runtime_node_deliveries(node_id, status, next_attempt_at, created_at);
