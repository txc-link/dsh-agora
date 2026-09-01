# Collaboration Governance P0

This slice adds a provider-neutral governance layer between an immutable task specification and runtime coordination:

`CollaborationRequirement → SubTaskSpec + DelegationAuthority → CollaborationPlan → ExecutionBaseline`

`CoordinationRun`, mutable task subtasks and runtime dispatches remain the execution layer. The new records state what was authorized and planned; they do not decide how a Matrix, Discord, OpenClaw or Hermes adapter dispatches work.

All records are content-addressed and idempotent. A plan can only join records belonging to the same task and requirement. Delegation authority is scoped to a task or subtask, carries an explicit action allow-list, maximum delegation depth and expiry, and is not a replacement for Dashboard human approval.

Implemented in this slice:

- migration `048_collaboration_governance.sql` and four SQLite repositories;
- Core create/list/show service methods with cross-task/reference checks, stable SHA-256 digests and idempotent replay;
- REST resources under `/api/tasks/:taskId/{collaboration-requirements,subtask-specs,delegation-authorities,collaboration-plans}`;
- CLI resource tree `agora collaboration requirement|spec|authority|plan`.

## Deferred

- Runtime enforcement at every dispatch/read/write edge.
- ActionAttempt/ActionReceipt and provider readback.
- Agent composition/skill admission and experience promotion.
