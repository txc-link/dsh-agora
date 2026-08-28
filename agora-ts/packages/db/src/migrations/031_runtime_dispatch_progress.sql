ALTER TABLE runtime_node_dispatches ADD COLUMN latest_progress TEXT;
ALTER TABLE runtime_node_dispatches ADD COLUMN progress_updated_at TEXT;
ALTER TABLE runtime_node_dispatches ADD COLUMN result_envelope TEXT;

CREATE TABLE IF NOT EXISTS runtime_node_dispatch_progress (
  id TEXT PRIMARY KEY,
  dispatch_id TEXT NOT NULL REFERENCES runtime_node_dispatches(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES runtime_nodes(node_id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  sequence INTEGER NOT NULL,
  phase TEXT NOT NULL,
  message TEXT,
  percent REAL,
  details TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(dispatch_id, attempt, sequence)
);

CREATE INDEX IF NOT EXISTS idx_runtime_node_dispatch_progress_history
  ON runtime_node_dispatch_progress(dispatch_id, attempt, sequence);
