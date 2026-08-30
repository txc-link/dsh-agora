-- 041_relationship_profiles.sql
-- Stable relationship aggregate plus immutable persona/contract versions.

CREATE TABLE IF NOT EXISTS relationship_profiles (
  profile_id TEXT PRIMARY KEY,
  owner_ref TEXT NOT NULL,
  agent_ref TEXT NOT NULL,
  relationship_kind TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL,
  current_version INTEGER NOT NULL CHECK (current_version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_relationship_profiles_owner
  ON relationship_profiles(owner_ref, status);
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_agent
  ON relationship_profiles(agent_ref, status);

CREATE TABLE IF NOT EXISTS relationship_profile_versions (
  profile_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  payload TEXT NOT NULL,
  created_by TEXT NOT NULL,
  change_note TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, version),
  FOREIGN KEY (profile_id) REFERENCES relationship_profiles(profile_id) ON DELETE CASCADE
);

