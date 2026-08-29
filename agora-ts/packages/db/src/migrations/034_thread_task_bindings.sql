-- 034_thread_task_bindings.sql — Phase 4 (R-C / T-1.5) thread ↔ Task binding.
-- agora Core 持有 threadKey ↔ taskId 映射, matrix adapter 读此映射做 thread state 投影.
-- threadKey 对 agora central 是 opaque (matrix room_id 由 adapter 解释).
--
-- Uniqueness: threadKey PRIMARY (one threadKey → at most one task);
--             taskId UNIQUE (one task → at most one threadKey).
--             Rebind of either side replaces atomically (repo handles).
-- FK to tasks(id) is intentionally NOT declared: task existence is enforced
-- by ThreadTaskBindingService via ITaskRepository at bind time, not via
-- SQL constraint (cross-table FK would couple this migration to the tasks
-- table shape and break the in-memory test repo).

CREATE TABLE IF NOT EXISTS thread_task_bindings (
  thread_key TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_thread_task_bindings_task ON thread_task_bindings(task_id);