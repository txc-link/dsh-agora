# Findings

## 2026-09-01

- Existing `CoordinationRun` already models dispatch, budgets and synthesis; this slice must reference it rather than duplicate runtime state.
- Existing task `authority` binds human/account/controller ownership, but it does not describe delegation scope, action permissions, depth or expiry.
- Existing task subtasks are mutable execution records; `SubTaskSpec` must remain immutable so the approved decomposition can be compared with actual work.
- Existing `TaskSpecRevision` and `ExecutionBaseline` provide exact revision and plan digest anchors; `CollaborationPlan` will carry the plan digest consumed by a baseline.
