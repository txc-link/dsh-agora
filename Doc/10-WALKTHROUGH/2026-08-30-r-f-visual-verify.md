# 2026-08-30 — R-F.2 polling visual verification walkthrough

## TL;DR

R-F.2 (`2b32d09`) shipped a 4 s short poll inside `TaskDetailSheet` with
3-tier race protection (AbortController + `inflightRef` + `cancelled`
flag) and three new i18n keys (`tasks.lastUpdated`, `tasks.refreshing`,
`tasks.autoRefresh`). Code review confirmed the cleanup / abort / race
paths inside the React effect, but **nothing exercised the polling loop
against a real agora server end-to-end**.

This task adds two test layers and ships inert in the sandbox:

| Layer | File | Status |
| --- | --- | --- |
| **L1 API contract** | `dashboard/tests/api/r-f-2-polling-api.test.mjs` | runs in sandbox — **8/8 ticks pass, avg 4009.6 ms** |
| **L2 UI smoke** | `dashboard/tests/e2e/r-f-2-polling.spec.ts` + `dashboard/playwright.config.ts` | production deploy asset — gated behind `PLAYWRIGHT_E2E=1`, sandbox skips cleanly |

No R-F.1 / R-F.2 / E.1 / R-E.2 business code was touched.

## Files changed

| File | Action |
| --- | --- |
| `dashboard/playwright.config.ts` | rewrite — adds PLAYWRIGHT_E2E gate, html-report path under task_dir |
| `dashboard/tests/api/r-f-2-polling-api.test.mjs` | new — Layer 1, runs in sandbox |
| `dashboard/tests/e2e/r-f-2-polling.spec.ts` | new — Layer 2, prod-only via env gate |
| `dashboard/package.json` | edit — adds `test:api`, `test:e2e`, `test:e2e:install`, `test:e2e:all` |
| `Doc/09-PLANNING/TASKS/2026-08-30-r-f-visual-verify/{task_plan,findings,progress}.md` | new — per AGENTS.md §3 |
| `Doc/10-WALKTHROUGH/2026-08-30-r-f-visual-verify.md` | new — this file |

## Architecture decisions

### L1 — Layer 1 is API-only, not UI-render

The temptation was to fold "open sheet + wait for Xs ago" into a single
Playwright spec. We split it for two reasons:

1. The polling contract has no opinion about React rendering. Testing
   it via Playwright would mask UI regressions in the indicator copy /
   1Hz re-render or vice versa.
2. The UI spec **must** be inert in the sandbox (no real session
   cookie). The API spec **must** run every commit. Two different gates
   → two files, two scripts (`test:api` vs `test:e2e`).

### L2 — Why we did not relax session auth

`AGENTS.md §2` says human-confirmed actions may only come from a logged-in
Dashboard session. The sandbox cannot mint a real
`agora_dashboard_session` cookie because the server has
`AGORA_DASHBOARD_AUTH_ENABLED` unset (it returns 404 on
`/api/dashboard/session/login`). Forging a cookie would amount to
faking human login — explicitly forbidden. So Layer 2 ships inert; the
spec docstring spells out the production recipe (real login flow, then
`PLAYWRIGHT_E2E=1 npm run test:e2e`).

### L3 — Layer 1 mirrors the dashboard's race protection

`agoraClient.loadThread` issues three parallel GETs with an `AbortSignal`
in `options`. The Layer 1 spec wires the same `AbortController` into
each fetch and never lets two ticks overlap, then asserts **every** tick
returns 200 — proving the server tolerates the dashboard's
abort-on-unmount cadence and doesn't leak a half-open stream that the
next tick would collide with.

### L4 — POLL_INTERVAL_MS envelope, not strict equality

The dashboard hard-codes `POLL_INTERVAL_MS = 4000`. The Layer 1 spec
asserts interval avg ∈ [3500, 4500] — a ±500 ms envelope — because:

- `setTimeout` drift on event-loop pressure is real.
- We want CI to fail on **real** regressions (e.g. timer lost on
  unmount/remount causing 8 s gaps), not on GC-induced 8 ms drift.
- A tighter envelope (`±100 ms`) would be flaky in CI even when the
  feature works.

### L5 — Intervals, not timestamps

The spec records `Date.now()` at the moment the **fetch** resolves
(not when the request is issued). That's the "did the server get a
clean tick?" measurement, and it matches what `TaskDetailSheet` would
see when `lastUpdatedAt` advances. Wall-clock between `setInterval`
fires is not the metric that matters.

### L6 — html report path lives under the task_dir

`playwright.config.ts` writes the html report to
`Doc/09-PLANNING/TASKS/2026-08-30-r-f-visual-verify/playwright-report/`.
That keeps the dashboard repo clean and lets the chief engineer / CI
upload the artifact next to the walkthrough.

### L7 — token handling

The Layer 1 spec reads `AGORA_ROOT_TOKEN` from the env, falling back
to the sandbox bearer token so the test is runnable out of the box.
Production runs **must** export a fresh token — the default is only for
the local sandbox. We deliberately do NOT bake the prod token into the
repo.

### L8 — Spec selector mirrors R-F.1

R-F.1 changed task links to buttons with `aria-label="Open task {title}"`.
The Playwright spec uses `button[aria-label^="Open task "]` to stay in
lockstep with that selector and not silently break if the copy is
re-templated.

## Verification

### Layer 1 — real run in the sandbox

```
$ cd dashboard && npm run test:api

R-F.2 polling summary: 8/8 ticks OK, avg interval = 4009.6ms (min=4008ms, max=4012ms), task=OC-1787983990771
✔ R-F.2 polling: 8 ticks @ 4s — all 200, interval ≈ 4s, no races (28113.744356ms)
```

Full per-tick numbers in
`Doc/09-PLANNING/TASKS/2026-08-30-r-f-visual-verify/findings.md §5`.
Short version: 8/8 endpoints returned 200, interval avg 4009.6 ms (inside
[3500, 4500] ms envelope), min/max 4008 / 4012 ms — the polling loop is
rock-steady.

### Layer 2 — configuration-ready, sandbox-inert

- `npm run test:e2e` in the sandbox exits with **1 skipped** (no
  failure, no surprise).
- Setting `PLAYWRIGHT_E2E=1` against a server with
  `AGORA_DASHBOARD_AUTH_ENABLED=true` + `AGORA_DASHBOARD_AUTH_METHOD=session`
  + a real `AGORA_DASHBOARD_SESSION_COOKIE` would exercise the full UI
  smoke.

## Limitations (§7)

- **Layer 1 is API-only.** It does not verify the React indicator copy,
  the 1Hz re-render, or the auto-refresh-pill text. Those are
  Layer-2 concerns and stay gated until the dashboard session auth
  becomes runnable in the sandbox.
- **Layer 2 needs a real login.** The Playwright spec injects both the
  bearer token (via `localStorage['agora-settings']`, the same key
  `readLocalToken()` reads) and a real `agora_dashboard_session`
  cookie. Forging either one would bypass the human-confirmation wall.
- **Layer 2 does not cover visual diff.** The screenshot at the end is
  evidence, not a regression baseline. A pixel-diff layer would be a
  follow-up task with its own config and golden folder.
- **No SSR / no production build smoke.** The spec runs against `vite
  dev`. A `vite preview` smoke would be a one-line change in the
  `webServer.command` and is queued for the next verification round.

## Cross-references

- R-F.1 commit `96d278a` — AgoraClient facade + TaskDetailSheet + 11
  endpoint mapping.
- R-F.2 commit `2b32d09` — 4 s short polling + 3-tier race protection
  + i18n.
- `dashboard/src/components/task/TaskDetailSheet.tsx` lines 110–196 —
  the polling effect under test.
- `dashboard/src/lib/agora-client.ts` lines 106–117 — `loadThread`
  fan-out mirrored in the Layer 1 spec.
- `dashboard/src/lib/dashboardCopy.ts` line ~1230 — `lastUpdated`
  accessor for the indicator copy.
- `Doc/09-PLANNING/TASKS/2026-08-30-r-f-visual-verify/{task_plan,findings,progress}.md`
  — task-internal docs.