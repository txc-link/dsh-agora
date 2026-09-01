# Collaboration Governance P0

## Scope

Add provider-neutral governance records that make multi-agent delegation explicit and auditable:

- `CollaborationRequirement` — what a task must involve (roles, capabilities, mode, quorum).
- `SubTaskSpec` — immutable decomposed work items with dependencies and acceptance criteria.
- `DelegationAuthority` — scoped authority, delegator/delegate, allowed actions, depth and expiry.
- `CollaborationPlan` — a content-addressed plan joining the requirement, specs, authorities and optional coordination run.

Wire the records through contracts, SQLite, Core validation, REST and CLI. Existing coordination runs and task subtasks remain execution read/write models; these records are their governance inputs, not replacements.

## Worktree

- Path: `E:/Learn AI Agent/dsh-agora/.worktrees/collaboration-governance`
- Branch: `feat/collaboration-governance`
- Base: `77dea6d feat(governance): add governed execution baseline`

## Delivery order

1. Add schemas and focused Core contract tests.
2. Add append-only SQLite migration and repositories.
3. Add Core service with reference, digest, expiry and idempotency checks.
4. Add REST/CLI composition surfaces and route tests.
5. Run focused tests/build/gates, update SSoT and walkthrough, merge and push.

## Non-goals

- No provider-specific Matrix/Discord/OpenClaw logic.
- No automatic delegation or runtime dispatch changes in this slice.
- No human approval bypass: plan approval remains an explicit reference and any future human gate remains Dashboard-controlled.

## Acceptance

- A plan cannot reference a different task/requirement or missing specs/authorities.
- Every stored record has a stable digest and idempotency behavior.
- Delegation authority rejects expired or invalid scopes/depths.
- Records survive SQLite restart and remain queryable by task.
