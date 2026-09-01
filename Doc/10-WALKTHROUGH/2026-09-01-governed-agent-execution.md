# Governed Agent Execution Foundation

**Date**: 2026-09-01 (Asia/Shanghai)
**Branch**: `feat/governed-agent-execution`
**Base**: `d17db47 feat(planning): add bidirectional state sync`

## What changed

The first governance slice adds a provider-neutral, restart-safe chain:

`TaskSpecRevision → ExecutionBaseline → EvidenceManifest`

`TaskSpecRevision` is append-only and content-addressed. Each revision points to the immediately preceding revision for the same task and stores the task payload digest. `ExecutionBaseline` pins the exact task revision, plan, approvals, policy references, agent/skill composition references, budget, and evidence obligations. `EvidenceManifest` seals the run references and output artifact references against the approved baseline digest.

All three records have idempotency keys. Replaying the same request returns the original record; reusing a key with different content is rejected. Baselines cannot be created after expiry, and evidence cannot be sealed for a mismatched, expired, or non-approved baseline.

## API surface

```text
POST /api/tasks/:taskId/spec-revisions
GET  /api/tasks/:taskId/spec-revisions
POST /api/tasks/:taskId/execution-baselines
GET  /api/tasks/:taskId/execution-baselines
POST /api/tasks/:taskId/evidence-manifests
GET  /api/tasks/:taskId/evidence-manifests
```

The request body for each POST follows the corresponding schema exported from `@agora-ts/contracts`. The route always takes `task_id` from the URL. When authentication is configured, baseline approval accepts only a Dashboard session actor; a caller-supplied `approved_by` value cannot impersonate a human approver.

CLI read/write surface:

```text
agora execution revision append <task-id> --file revision.json
agora execution revision list <task-id>
agora execution revision show <revision-id>
agora execution baseline list <task-id>
agora execution baseline show <baseline-id>
agora execution evidence list <task-id>
agora execution evidence show <manifest-id>
```

The CLI deliberately does not create approved baselines: human approval is a Dashboard-session operation. Agents and automation can still seal evidence after a valid baseline exists through the REST service or a future runtime adapter.

## Verification

- Core service tests: 5/5 passed.
- SQLite repository test: 1/1 passed.
- REST route tests: 2/2 passed.
- CLI surface test: 1/1 passed.
- Workspace TypeScript build: passed.
- Core architecture and barrel governance gates: passed.
- Changed-file ESLint: no errors.

The repository-wide typecheck/lint suite still reports pre-existing test-only issues in older packages and the known Windows SQLite open-handle `EPERM` cleanup behavior. They are recorded in the task progress file and are not attributed to this slice.

## Next slice

The next P0 work should bind existing coordination/team primitives to explicit `CollaborationRequirement`, `CollaborationPlan`, and `DelegationAuthority` records, then add action-attempt/readback receipts. No provider-specific code belongs in Core.
