# Governed Agent Execution Foundation

## Scope

Implement the first P0 slice inspired by the UniGeoEarth review:

- immutable `TaskSpecRevision` records;
- approved `ExecutionBaseline` records;
- first-class `EvidenceManifest` records;
- Core-only contracts and SQLite repositories;
- no provider-specific logic, deployment, or Matrix changes in this slice.

## Worktree

- path: `E:/Learn AI Agent/dsh-agora/.worktrees/governed-agent-execution`
- branch: `feat/governed-agent-execution`
- base: `d17db47` (`feat(planning): add bidirectional state sync`)

## Delivery order

1. Add contract schemas and domain records.
2. Add migration and repository interfaces/implementations.
3. Add Core services with validation and immutable append semantics.
4. Add focused tests, then run strict TypeScript gates.
5. Update SSoT, findings, progress, architecture note, and walkthrough.

## Explicit non-goals

- no CollaborationPlan/DelegationAuthority enforcement yet;
- no external action readback adapter yet;
- no automatic learning or Agent configuration mutation;
- no server deployment or remote push.

## Acceptance

- a task revision is append-only and content-addressed;
- an execution baseline references exact task/plan/approval/input digests;
- an evidence manifest references the baseline and exact output artifacts;
- duplicate idempotency keys are rejected or return the original record;
- records remain available after process restart;
- existing tests and architecture gates remain green.
