# Findings

## 2026-09-01

- Existing `Task.version` is a mutable optimistic-lock counter, not an immutable task history.
- `coordination_run` already owns bounded runtime dispatches, budgets, evidence IDs, and deterministic synthesis.
- Runtime dispatch already has idempotency keys, leases, claim tokens, attempts, progress, and result envelopes.
- Artifact bytes are SHA-256 content-addressed, but there is no manifest that binds task, approval, execution, and output evidence together.
- Governance already provides information policy, consent grants, and action-risk assessments; the baseline should store references, not duplicate policy logic.
- This slice must remain provider-neutral and fit the existing Core/adapter boundary.
