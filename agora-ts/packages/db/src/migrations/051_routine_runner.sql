ALTER TABLE routine_runs ADD COLUMN runtime_dispatch_id TEXT;
ALTER TABLE routine_runs ADD COLUMN result TEXT;
ALTER TABLE routine_runs ADD COLUMN artifact_id TEXT;
ALTER TABLE routine_runs ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'skipped'));
ALTER TABLE routine_runs ADD COLUMN delivery_error TEXT;

CREATE INDEX IF NOT EXISTS idx_routine_runs_dispatch ON routine_runs(runtime_dispatch_id);
CREATE INDEX IF NOT EXISTS idx_routine_runs_delivery ON routine_runs(delivery_status, scheduled_for);
