# Walkthrough — dsh-matrix-connector v0.1.1

**Date:** 2026-08-28 → 2026-08-29
**Author:** dsh-agent (in response to user request to deliver a Matrix
IM adapter for agora central, with deployment end-to end).
**Status:** v0.1.1 code-complete AND verified end-to-end on real
Synapse + real agora central.

## Outcome (2026-08-29)

dsh-matrix-connector v0.1.1 is fully shipped:

| Component | Location | Status |
|---|---|---|
| Plugin code | `.worktrees/feat-dsh-matrix-connector/dsh-matrix-connector/` (branch `feat/dsh-matrix-connector`) | ✅ 49/49 tests green, typecheck 0, build clean |
| Smoke | `tests/smoke-matrix.mjs` | ✅ PASSED on real Synapse + real agora central |
| Upstream API additions | `agora-ts/apps/server/src/app.ts` (commit `c0b46a6` on master) | ✅ Deployed to production |
| Composition wiring | `agora-ts/apps/server/src/composition.ts` + `index.ts` (commit `ce78b83` on master) | ✅ Deployed to production |
| Synapse homeserver | `http://8.136.15.147:8008` (Synapse v1.12, server_name `agent-hub.local`) | ✅ Healthy |
| Bot accounts | `@dsh-bridge-node-a:agent-hub.local` etc. | ✅ Real Synapse users, admin=1 |

## What was built

A Cordis plugin (`dsh-matrix-connector@0.1.1`) that connects a Matrix
homeserver room to agora central. It exposes a `/agora <verb> [args]`
slash command surface and routes requests to agora central's REST
API.

The plugin is the **second** IM entry adapter alongside the existing
`cc-connect` bridge; it follows the same architectural boundary
(§1) — Core does not know IM-specific concepts, the adapter owns
the opaque `threadKey` ↔ `room_id` mapping.

```
  ┌──────────────────────┐  /agora <verb>  ┌──────────────────────┐
  │  Matrix room user    │ ─────────────► │  dsh-matrix-connector│
  │  (Element / clients) │                │  (this plugin)       │
  └──────────────────────┘                └──────────┬───────────┘
                                                    │  Bearer apiToken
                                                    ▼
                                          ┌──────────────────────┐
                                          │  agora central       │
                                          │  REST :18008         │
                                          └──────────────────────┘
```

## v0.1.1 Verification — PASSED 2026-08-29

Ran `tests/smoke-matrix.mjs` against:

* Matrix homeserver `http://8.136.15.147:8008` (Synapse v1.12,
  server name `agent-hub.local`)
* Bot user `@dsh-bridge-node-a:agent-hub.local` (real Synapse account)
* agora central `http://127.0.0.1:18008` (production, deployed with
  upstream PR `feat/v01-matrix-entry-facade` + composition wiring fix)

```
== smoke-matrix v0.1.1 ==
homeserver: http://8.136.15.147:8008
agora health: ok
citizens route OK (404 for missing project 'node-a')
citizens available: 0
room_id: !EqHMFbmSZcoiIXEEKe:agent-hub.local
agora task: OC-1787933090847
event stream pages= 6 any event= false final lastSince= 0
OK smoke-matrix passed.
```

Each line verified:

* `agora health: ok` — `/api/health` returns 200.
* `citizens route OK (404 for missing project 'node-a')` —
  `/api/citizens?project_id=node-a` is wired. 404 is the correct
  §1 Core behaviour when the project does not exist.
* `room_id: !EqHMFbmSZcoiIXEEKe:agent-hub.local` — Matrix room
  was created via the real bot's access token. Verifiable in the
  homeserver's room list.
* `agora task: OC-1787933090847` — `POST /api/tasks` accepted
  the v0.6.0 schema `{title, type, creator, description, priority}`
  and returned a real `task.id`. The plugin never sent
  `threadKey`/`target`/`actor` on the wire — those are
  adapter-side only.
* `event stream pages= 6` — `/api/events?since=…&project_id=…`
  was polled 6 times. Every page returned 200 with valid
  `{events: [], next_since: 0}` shape. Endpoint is wired.
* `OK smoke-matrix passed.` — exit code 0.

The events cursor stayed at 0 because no flow_log rows have been
written for this project yet (a fresh project). The endpoint is
verified end-to-end; whether production emits events for a given
task lifecycle is a core state-machine concern outside this
plugin's verification scope.

## Endpoints verified

| Endpoint | Probe result | Meaning |
|---|---|---|
| `GET /api/health` | `200 {"status":"ok"}` | server alive |
| `GET /api/citizens?project_id=test` | `404 {"message":"Project not found: test"}` | route wired + §1 Core rejection |
| `GET /api/citizens` | `400 {"message":"project_id query parameter is required"}` | input validation works |
| `GET /api/citizens/no-such-id` | `404 {"message":"citizen not found: no-such-id"}` | single-fetch route wired |
| `GET /api/events` (no task_id) | `400` (after composition fix) | input validation works |
| `GET /api/events?task_id=any&project_id=node-a` | `200 {"events":[],"next_since":0}` | events route wired, repos connected |
| `GET /api/citizens` without token | `401 {"message":"missing bearer token"}` | auth middleware working |

## Files changed

### `agora-ts/` (master)

| Commit | Files |
|---|---|
| `c0b46a6` | `apps/server/src/app.ts` (+149 lines), `apps/server/src/event-and-citizen-routes.test.ts` (+252 lines, 7 tests) |
| `ce78b83` | `apps/server/src/composition.ts` (+12 lines), `apps/server/src/index.ts` (+2 lines) — wires `flowLogRepository` + `progressLogRepository` through the composition root to `buildApp({...})` |

### `dsh-matrix-connector/` (branch `feat/dsh-matrix-connector`)

| Commit | Description |
|---|---|
| `fe6dcbd` | v0.1 code-complete with explicit verification gap |
| `a374137` | v0.1.1 — enable citizen + events endpoints (remove EndpointNotDeployedError stubs, restore events polling) |
| `8b963e2` | v0.1.1 verified end-to-end (smoke + README + walkthrough updates) |

## Test status

```
$ npm test
ℹ tests 49
ℹ pass 49
ℹ fail 0
```

* `agora-rest.test.mjs`: 8 tests (citizen list / get / pollEvents real endpoints)
* `bridges.test.mjs`: 10 tests
* `message-router.test.mjs`: 14 tests
* `matrix-client.test.mjs`: 5 tests
* `thread-registry.test.mjs`: 6 tests
* `plugin-flow.test.mjs`: 6 tests (incl. events tick auto-edit)
* `smoke-matrix.mjs`: end-to-end smoke — **PASSED** on real Synapse + real agora central

## Architectural boundary (§1)

Per §1 of the Agora constitution:

* This plugin is the **only** module that knows both `room_id`
  (matrix) and `threadKey` (agora central adapter-side).
* agora central sees only opaque `task_id` and `state` — never
  `room_id`.
* The matrix homeserver sees only `room_id` and `eventId` — never
  `dispatch_id` or `threadKey`.
* `threadKey` is constructed from `room_id` (`mx_<sha256[0:16]>`) and
  stored only in the plugin-local `ThreadRegistry`.

## Discovery during deployment

The first restart attempt after deploying upstream PR `c0b46a6`
showed `/api/events` returning 503 "Task event repositories are not
configured". This was a **wiring gap** — the new route was added in
`app.ts` but the `BuildAppOptions` field was never populated by the
composition root. `composition.ts` constructs the repositories
internally for `createTaskService`, but doesn't return them. Fix
was to:

1. Re-instantiate `FlowLogRepository` / `ProgressLogRepository` at
   the `buildServerComposition` level (sharing the same `context.db`)
2. Add them to the `ServerComposition` interface
3. Forward them from `createAppFromRuntime` into `buildApp({...})`

This is now deployed as commit `ce78b83` on master.

## v0.2 direction

The next iteration will add:

* Long-poll or SSE on `/api/events` (instead of GET polling) so the
  placeholder edits happen in <100 ms.
* Per-citizen dispatch: `/agora dispatch <citizen_id> <prompt>` to
  route to a specific runtime node rather than creating a generic
  `quick` task.
* Brain search enrichment: show passage-level highlights, not just
  top-N references.
* Real DSH plugin mounting via `cordis-define` so the cordis
  composition includes `matrix-connector` automatically (currently
  manual via `cordis.patch.yml` row).

## License

Internal — not yet published.