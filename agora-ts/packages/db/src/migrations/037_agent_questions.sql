-- 037_agent_questions.sql
-- org-aware-work-os S5: agent → human 主动提问 (assistant 优先, ceo 升级)
CREATE TABLE IF NOT EXISTS agent_questions (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  agent_ref TEXT NOT NULL,
  kind TEXT NOT NULL,
  question TEXT NOT NULL,
  context TEXT,
  target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  answer TEXT,
  answered_by TEXT,
  answered_at TEXT,
  escalated_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_questions_status ON agent_questions(status);
CREATE INDEX IF NOT EXISTS idx_agent_questions_agent ON agent_questions(agent_ref);
CREATE INDEX IF NOT EXISTS idx_agent_questions_task ON agent_questions(task_id);
