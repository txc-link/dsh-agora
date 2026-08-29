-- 038_teams.sql
-- org-aware-work-os S1: team 聚合 + 层级 (每项目一个组织; 并存 ProjectMembership)
CREATE TABLE IF NOT EXISTS org_teams (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  lead TEXT NOT NULL,
  members TEXT NOT NULL DEFAULT '[]',
  responsibilities TEXT NOT NULL DEFAULT '[]',
  parent_id TEXT,
  created_at TEXT NOT NULL,
  metadata TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_teams_project_name ON org_teams(project_id, name);
CREATE INDEX IF NOT EXISTS idx_org_teams_project ON org_teams(project_id);
CREATE INDEX IF NOT EXISTS idx_org_teams_parent ON org_teams(parent_id);
