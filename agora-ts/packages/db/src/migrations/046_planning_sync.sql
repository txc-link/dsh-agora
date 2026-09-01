ALTER TABLE planning_bindings ADD COLUMN sync_mode TEXT NOT NULL DEFAULT 'manual'
  CHECK (sync_mode IN ('manual', 'bidirectional'));
ALTER TABLE planning_bindings ADD COLUMN last_sync_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (last_sync_status IN ('pending', 'synced', 'conflict', 'failed'));
ALTER TABLE planning_bindings ADD COLUMN last_sync_at TEXT;
ALTER TABLE planning_bindings ADD COLUMN last_sync_error TEXT;

CREATE INDEX IF NOT EXISTS idx_planning_bindings_sync
  ON planning_bindings(sync_mode, last_sync_status, updated_at);
