ALTER TABLE executive_requests ADD COLUMN idempotency_key TEXT;
ALTER TABLE executive_requests ADD COLUMN intake_digest TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_executive_requests_idempotency
  ON executive_requests(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
