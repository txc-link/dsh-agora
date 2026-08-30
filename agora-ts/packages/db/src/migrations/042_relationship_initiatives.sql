-- Durable provider-neutral proactive relationship delivery outbox.

CREATE TABLE IF NOT EXISTS relationship_initiatives (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  profile_version INTEGER NOT NULL,
  owner_ref TEXT NOT NULL,
  agent_ref TEXT NOT NULL,
  trigger TEXT NOT NULL,
  modality TEXT NOT NULL,
  text TEXT NOT NULL,
  resource_ref TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  delivery_binding_ref TEXT NOT NULL,
  purpose TEXT NOT NULL,
  requested_fields TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  schedule_local_date TEXT NOT NULL,
  status TEXT NOT NULL,
  consumer_ref TEXT,
  lease_token TEXT,
  lease_expires_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES relationship_profiles(profile_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_relationship_initiatives_due
  ON relationship_initiatives(target_domain, status, scheduled_for, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_relationship_initiatives_daily
  ON relationship_initiatives(profile_id, schedule_local_date, status);

