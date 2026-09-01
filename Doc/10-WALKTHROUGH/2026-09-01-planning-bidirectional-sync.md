# Google / TickTick bidirectional state sync walkthrough

## Outcome

Agora now synchronizes terminal state for a consented planning binding while remaining the organization and workflow system of record. The implementation is code-complete and tested locally; it was not deployed and no real Google or TickTick account was contacted.

## State rules

| Observed state | Result |
|---|---|
| TickTick `completed`, Agora active | Agora → `done` |
| TickTick task missing/deleted, Agora active/blocked/paused | Agora → `cancelled` |
| Google event `cancelled` or missing, Agora active/blocked/paused | Agora → `cancelled` |
| Agora `done`, TickTick open | TickTick complete |
| Agora `cancelled`, TickTick open | TickTick delete |
| Agora `cancelled`, Google scheduled | Google event cancel with its current ETag |
| contradictory terminal states | persist `conflict`; perform no mutation |

Google events are not marked complete when an Agora task finishes: attending an event and completing a task are different facts. Mutable titles, descriptions, dates and attendees remain manual/one-way to avoid a multi-master merge policy.

## Consent and persistence

Migration `046_planning_sync.sql` adds `sync_mode`, last status, timestamp and safe error text to `planning_bindings`. Existing rows become `manual`. `bidirectional` must be selected by an authenticated Dashboard human, either while projecting a new object or through:

```text
PUT /api/planning/tasks/:taskId/sync-mode
{ "mode": "bidirectional" }
```

Switching back to `{ "mode": "manual" }` immediately removes the binding from automatic writes. Tokens stay in process configuration and are never stored in the binding.

## Running synchronization

Manual REST entry points:

```text
POST /api/planning/tasks/:taskId/sync
POST /api/planning/sync
```

CLI entry points:

```bash
agora planning sync <task-id> --json
agora planning sync-all --json
```

Optional server polling is disabled by default. Enable one non-overlapping poller with:

```dotenv
PLANNING_SYNC_INTERVAL_MS=60000
```

Each run reads every bound provider before mutation. A provider failure records `failed` for retry; a terminal disagreement records `conflict` for human resolution.

## Provider operations

- Google Calendar: GET the bound event, retain its ETag, and use conditional DELETE for Agora cancellation. Missing/cancelled events are idempotently observed as cancelled.
- TickTick: GET the bound project task, call the official complete endpoint for Agora completion, and DELETE it for Agora cancellation. A 404 is idempotently observed as deleted.

## Verification

- TypeScript workspace build passed.
- Focused adapters/Core/DB/server regression passed: 6 files, 21 tests.
- Relevant workspace typechecks, both architecture gates and changed-source lint passed; the repository's pre-existing full-suite issues are recorded in the task progress file.

## Deferred

- Google collection sync tokens, webhook channel lifecycle and TickTick event delivery;
- mutable-field merge and conflict resolution UI;
- reopening completed/cancelled work;
- live OAuth/token setup, deployment and account smoke tests.

Planning: `Doc/09-PLANNING/TASKS/2026-09-01-planning-bidirectional-sync/`  
Architecture: `Doc/03-ARCHITECTURE/2026-09-01-planning-bidirectional-sync/README.md`
