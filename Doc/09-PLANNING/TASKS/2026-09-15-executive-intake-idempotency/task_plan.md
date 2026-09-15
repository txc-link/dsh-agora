# Executive intake idempotency

## Objective

Make Executive Assistant intake safely retryable across REST, CLI, Core, and SQLite so one logical PAOS proposal creates at most one Executive Request, Task, RuntimeDispatch, and Commitment.

## Work context

- Worktree: `F:\MyObsidianFiles\跨机器协同\paos-implementation\worktrees\dsh-agora-executive-intake-idempotency`
- Branch: `feat/executive-intake-idempotency`
- Base: `346efcb`
- Public contribution surface: `Doc/`.

## Plan

1. Add failing Core, repository, and REST regressions for identical replay and conflicting key reuse.
2. Add a durable, organization-scoped idempotency identity and normalized intake digest.
3. Return the original request/commitment for an identical replay without invoking the task port again.
4. Expose the optional key through REST and CLI.
5. Run focused tests, typecheck/build/lint, then the full Linux verification gate.
6. Update the implementation SSoT and walkthrough.

## Exit criteria

- Identical retries return the original request and commitment.
- A retry never calls `createAssignedTask` a second time.
- Reusing a key for different normalized input returns a clear conflict error.
- The constraint survives database restart and is scoped per organization.
- Existing callers that omit the key retain current behavior.
