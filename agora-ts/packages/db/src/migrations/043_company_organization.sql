CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_ref TEXT NOT NULL,
  information_domain TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS organization_units (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('executive_office', 'department', 'team')),
  parent_unit_id TEXT REFERENCES organization_units(id) ON DELETE RESTRICT,
  responsibilities TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT,
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_organization_units_org ON organization_units(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_organization_units_parent ON organization_units(parent_unit_id);

CREATE TABLE IF NOT EXISTS organization_positions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  unit_id TEXT NOT NULL REFERENCES organization_units(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('executive_assistant', 'lead', 'specialist', 'worker', 'auditor')),
  reports_to_position_id TEXT REFERENCES organization_positions(id) ON DELETE RESTRICT,
  responsibilities TEXT NOT NULL DEFAULT '[]',
  skills TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_organization_positions_org ON organization_positions(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_organization_positions_unit ON organization_positions(unit_id, created_at);
CREATE INDEX IF NOT EXISTS idx_organization_positions_manager ON organization_positions(reports_to_position_id);

CREATE TABLE IF NOT EXISTS organization_employments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  position_id TEXT NOT NULL REFERENCES organization_positions(id) ON DELETE RESTRICT,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('human', 'agent')),
  subject_ref TEXT NOT NULL,
  employment_kind TEXT NOT NULL CHECK (employment_kind IN ('resident', 'on_demand', 'advisor')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'ended')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  ended_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_employment_current_position
  ON organization_employments(position_id)
  WHERE status IN ('active', 'suspended');
CREATE INDEX IF NOT EXISTS idx_organization_employments_org ON organization_employments(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_organization_employments_subject ON organization_employments(subject_kind, subject_ref, created_at);
