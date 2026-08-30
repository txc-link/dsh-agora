-- 040_governance.sql
-- Generic information classification, consent grants, and action-risk audit.

CREATE TABLE IF NOT EXISTS information_policies (
  resource_ref TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  owner_ref TEXT NOT NULL,
  domain TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  sharing_mode TEXT NOT NULL,
  allowed_purposes TEXT NOT NULL,
  retention_until TEXT,
  created_by TEXT NOT NULL,
  change_note TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (resource_ref, version)
);

CREATE INDEX IF NOT EXISTS idx_information_policies_domain
  ON information_policies(domain, resource_ref, version);

CREATE TABLE IF NOT EXISTS consent_grants (
  id TEXT PRIMARY KEY,
  grantor_ref TEXT NOT NULL,
  grantee_ref TEXT NOT NULL,
  resource_pattern TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  purpose TEXT NOT NULL,
  permissions TEXT NOT NULL,
  allowed_fields TEXT NOT NULL,
  max_sensitivity TEXT NOT NULL,
  basis TEXT NOT NULL,
  expires_at TEXT,
  evidence_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_consent_grants_grantee_status
  ON consent_grants(grantee_ref, status);
CREATE INDEX IF NOT EXISTS idx_consent_grants_grantor_status
  ON consent_grants(grantor_ref, status);

CREATE TABLE IF NOT EXISTS action_risk_assessments (
  id TEXT PRIMARY KEY,
  subject_ref TEXT NOT NULL,
  intent TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  decision TEXT NOT NULL,
  reasons TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_action_risk_assessments_subject
  ON action_risk_assessments(subject_ref, created_at);

