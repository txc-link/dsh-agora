-- 035_thread_task_conversation_binding.sql — R-D (T-3) inbound reply support.
--
-- Rebuilds task_conversation_entries to:
--   1. make binding_id nullable (R-D inbound replies are not tied to the
--      legacy task_context_bindings model)
--   2. add thread_task_binding_id FK → thread_task_bindings(thread_key)
--      (turn 122 binding; opaque threadKey, agora central never interprets)
--
-- FK is ON at connection level; wrap in foreign_keys=OFF to allow the
-- rebuild, since the table has no inbound FK references from other tables
-- (verified: only task_conversation_read_cursors references tasks/human_accounts).

PRAGMA foreign_keys=OFF;

ALTER TABLE task_conversation_entries RENAME TO task_conversation_entries_old;

CREATE TABLE task_conversation_entries (
  id                   TEXT PRIMARY KEY,
  task_id              TEXT NOT NULL REFERENCES tasks(id),
  binding_id           TEXT REFERENCES task_context_bindings(id),
  thread_task_binding_id TEXT REFERENCES thread_task_bindings(thread_key) ON DELETE SET NULL,
  provider             TEXT NOT NULL,
  provider_message_ref TEXT,
  parent_message_ref   TEXT,
  direction            TEXT NOT NULL,
  author_kind          TEXT NOT NULL,
  author_ref           TEXT,
  display_name         TEXT,
  body                 TEXT NOT NULL,
  body_format          TEXT NOT NULL DEFAULT 'plain_text',
  occurred_at          TEXT NOT NULL,
  ingested_at          TEXT NOT NULL,
  dedupe_key           TEXT,
  metadata             TEXT
);

INSERT INTO task_conversation_entries (
  id, task_id, binding_id, thread_task_binding_id, provider,
  provider_message_ref, parent_message_ref, direction, author_kind,
  author_ref, display_name, body, body_format, occurred_at, ingested_at,
  dedupe_key, metadata
)
SELECT
  id, task_id, binding_id, NULL, provider,
  provider_message_ref, parent_message_ref, direction, author_kind,
  author_ref, display_name, body, body_format, occurred_at, ingested_at,
  dedupe_key, metadata
FROM task_conversation_entries_old;

DROP TABLE task_conversation_entries_old;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_conversation_entries_dedupe
  ON task_conversation_entries(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_conversation_entries_task
  ON task_conversation_entries(task_id, occurred_at, ingested_at);

CREATE INDEX IF NOT EXISTS idx_task_conversation_entries_binding
  ON task_conversation_entries(binding_id, occurred_at, ingested_at);

CREATE INDEX IF NOT EXISTS idx_task_conversation_entries_thread_binding
  ON task_conversation_entries(thread_task_binding_id, occurred_at, ingested_at);

PRAGMA foreign_keys=ON;
