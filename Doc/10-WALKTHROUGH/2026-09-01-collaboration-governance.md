# Collaboration Governance P0 walkthrough

## What shipped

The collaboration contract now has four durable records:

1. `CollaborationRequirement` freezes the task's collaboration mode, agent bounds, required roles/capabilities, quorum and information domains.
2. `SubTaskSpec` describes immutable work packets and their dependency/parent references.
3. `DelegationAuthority` grants a named delegate a bounded action set, depth and expiry for a task or subtask.
4. `CollaborationPlan` joins the exact task revision, subtask specs and authorities into a proposed plan.

`CoordinationRun`, existing mutable task subtasks and provider adapters remain runtime execution mechanisms. This slice does not dispatch work or bypass Dashboard human approval.

## REST example

Create records in order under one task:

```http
POST /api/tasks/task-1/collaboration-requirements
POST /api/tasks/task-1/subtask-specs
POST /api/tasks/task-1/delegation-authorities
POST /api/tasks/task-1/collaboration-plans
```

Every response includes a stable SHA-256 digest and the server-generated id. Replaying the same `idempotency_key` and payload returns the original record; reusing the key with different content returns `409`.

## CLI example

```bash
agora collaboration requirement append task-1 --file requirement.json
agora collaboration spec append task-1 --file research-spec.json
agora collaboration authority grant task-1 --file authority.json
agora collaboration plan propose task-1 --file plan.json
agora collaboration plan list task-1
```

JSON files must include the immutable task revision id/digest and the references they use. The service rejects cross-task references, stale revisions, duplicate plan references and expired authorities.

## Verification

- Core service: 3 tests.
- SQLite repositories and migration: 1 test.
- REST chain and stale-revision conflict: 2 tests.
- CLI read/list surface: 1 test.
- Workspace TypeScript build and changed-file lint: passed.

The repository-wide database suite still has the known Windows temporary SQLite directory `EPERM` cleanup failure; the new repository test uses an in-memory database and passes.
