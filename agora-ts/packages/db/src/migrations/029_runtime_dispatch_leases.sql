ALTER TABLE runtime_node_dispatches ADD COLUMN claim_token TEXT;
ALTER TABLE runtime_node_dispatches ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runtime_node_dispatches ADD COLUMN claimed_at TEXT;
ALTER TABLE runtime_node_dispatches ADD COLUMN claim_renewed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_runtime_node_dispatch_lease
  ON runtime_node_dispatches(node_id, status, claim_expires_at);
