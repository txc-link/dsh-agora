CREATE TABLE IF NOT EXISTS planning_bindings (
  task_id                    TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  domain                     TEXT NOT NULL CHECK (domain IN ('work', 'life')),
  external_task_provider     TEXT,
  external_task_ref          TEXT,
  external_task_project_ref  TEXT,
  calendar_provider          TEXT,
  calendar_event_ref         TEXT,
  created_at                 TEXT NOT NULL,
  updated_at                 TEXT NOT NULL,
  CHECK (
    (external_task_provider IS NOT NULL AND external_task_ref IS NOT NULL)
    OR (calendar_provider IS NOT NULL AND calendar_event_ref IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_planning_bindings_domain
  ON planning_bindings(domain, updated_at DESC);
