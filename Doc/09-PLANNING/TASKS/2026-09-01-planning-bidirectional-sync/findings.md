# Findings

- Google Calendar event state is `confirmed | tentative | cancelled`; a calendar has no meaningful "task completed" state.
- Google documents ETags for conditional writes and returns `410 Gone` when an incremental sync token is invalid. Bound-object polling can use event GET/DELETE without introducing a collection cache in v1.
- TickTick's official Open API exposes get, update, complete and delete for tasks, but no documented reopen operation.
- Agora terminal states are immutable. Only `active -> done` and `active|blocked|paused -> cancelled` are valid relevant transitions; incompatible remote terminal state must become a sync conflict.
- A bound TickTick task and Google event can disagree (completed versus cancelled). The service must read all bound providers before changing any state.
- Existing bindings cannot acquire recurring write consent during migration. Migration 046 therefore defaults them to `manual`; projection/sync-mode REST calls enabling `bidirectional` require a logged-in Dashboard human.
- A single non-overlapping poller is sufficient for the initial bound-object volume. `PLANNING_SYNC_INTERVAL_MS` is opt-in, so code deployment alone cannot start external writes.
- The repository-wide TypeScript `typecheck` currently fails in unrelated historical test sources across monitoring-relay, adapters-matrix, adapters-mem0, core and db. Relevant changed workspaces typecheck cleanly and the workspace build succeeds.
- Broad SQLite regression on this Windows checkout continues to fail during test cleanup with `EPERM` on temp directories; a single unmodified database test reproduces it. This is the same baseline issue recorded by the preceding provider-adapter delivery.
