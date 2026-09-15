# Windows SQLite fixture lifecycle

## Objective

Remove Windows-only test cleanup failures caused by open `better-sqlite3` handles, without changing production database lifetime or weakening assertions.

## Work context

- Worktree: `F:\MyObsidianFiles\跨机器协同\paos-implementation\worktrees\dsh-agora-windows-sqlite`
- Branch: `fix/windows-sqlite-fixture-lifecycle`
- Base: `45a4d0a` (the isolated-fixture and scenario-timeout patch)
- Public contribution: the private `docs/` SSoT is unavailable, so this task uses the allowed `Doc/` contributor surface.

## Plan

1. Reproduce and inventory failing test files on Windows.
2. Identify the smallest shared fixture-lifecycle seam.
3. Add a regression for observing and releasing every opened database handle.
4. Implement test-only tracking/cleanup; do not change production ownership semantics.
5. Run focused Windows tests, full Windows tests where practical, then the strict Linux gate.
6. Record dependency audit separately; do not mix dependency upgrades into the SQLite fix.

## Exit criteria

- Target Windows cleanup failures no longer emit `EBUSY`/`EPERM` for SQLite files.
- Existing assertions remain unchanged except lifecycle wiring.
- The strict checks stay green; any unrelated Windows portability failures are
  inventoried separately instead of being hidden by this change.
- Findings and verification results are recorded in this task directory.
