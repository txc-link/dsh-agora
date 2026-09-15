# Agora test isolation and scenario timeout

**Status:** complete; full central Linux verification passed.

## Goal

Make the default Agora TypeScript test gate independent of pre-existing files in the shared system temporary root, and give the full text scenario matrix the same explicit execution budget as the JSON matrix.

## Scope

- Isolate the three task-worktree tests below a unique per-test temporary parent.
- Inject a unique registry directory into the two tmux craftsman adapter tests.
- Add an explicit 30-second timeout to the full text scenario matrix and the three real Git-worktree integration tests.
- Run focused tests, architecture gates, lint, build, typecheck, and the default test command.

## Files expected to change

- `agora-ts/packages/core/src/task-service.test.ts`
- `agora-ts/apps/cli/src/index.test.ts`
- `agora-ts/packages/adapters-runtime/src/tmux-craftsman-adapter.test.ts`
- `agora-ts/packages/testing/src/cli.test.ts`

## Non-goals

- No Core state-machine or adapter behavior changes.
- No runtime registry migration.
- No deployment, restart, or live configuration changes.
- No global increase of Vitest's default timeout.

## Verification

1. Reproduce the focused test files before modification where the local platform permits it.
2. Run the six focused cases after modification on Windows and a Linux execution surface.
3. Run `npm run gate:core-architecture`, `npm run gate:barrel-governance`, lint, build, and typecheck.
4. Run the default `npm test` and compare with the recorded server baseline.
