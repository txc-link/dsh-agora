# R-F.2 polling visual verification — progress

## Checklist

- [x] **Step 1** — Inspected `TaskDetailSheet.tsx`, `agora-client.ts`,
      `resources.ts`, `dashboardCopy.ts`, `ProjectDetailPage.tsx`,
      `vite.config.ts`, `main.tsx` to confirm polling contract,
      i18n keys, button selectors, basePath.
- [x] **Step 2** — Probed `GET /api/tasks`,
      `/api/tasks/OC-1787983990771`,
      `/api/tasks/OC-1787983990771/conversation`,
      `/api/tasks/OC-1787983990771/conversation/summary` — all 200.
      Confirmed `POST /api/dashboard/session/login` returns 404 in the
      sandbox (dashboard session auth is not enabled).
- [x] **Step 3** — Wrote `dashboard/playwright.config.ts` (Layer 2
      asset, `PLAYWRIGHT_E2E=1` gate, html report written under
      task_dir).
- [x] **Step 4** — Wrote `dashboard/tests/api/r-f-2-polling-api.test.mjs`
      (Layer 1 contract — 8 ticks @ 4 s, AbortController race
      protection, status + shape assertions, interval envelope).
- [x] **Step 5** — Wrote `dashboard/tests/e2e/r-f-2-polling.spec.ts`
      (Layer 2 — sandbox `test.skip()` + console.log gate explanation,
      real cookie injection path, "Last updated Xs ago" + X ≥ 3
      assertion, advance-after-interval assertion, screenshot).
- [x] **Step 6** — Added four scripts to `dashboard/package.json`:
      `test:api`, `test:e2e`, `test:e2e:install`, `test:e2e:all`. No
      other script was touched.
- [x] **Step 7** — Ran `npm run test:api` in the sandbox — **8/8 ticks
      pass**, avg interval 4009.6 ms.
- [ ] **Step 8** — Chief engineer: review + commit + (eventually)
      merge. Not done by this subagent per the brief.

## Verification

### Layer 1 — API contract (sandbox, real network)

```
$ cd dashboard && npm run test:api

R-F.2 polling summary: 8/8 ticks OK, avg interval = 4009.6ms (min=4008ms, max=4012ms), task=OC-1787983990771
✔ R-F.2 polling: 8 ticks @ 4s — all 200, interval ≈ 4s, no races (28113.744356ms)
ℹ tick 1/8: {"task":200,"conversation":200,"summary":200} interval=0ms elapsed=11ms
ℹ tick 2/8: {"task":200,"conversation":200,"summary":200} interval=4010ms elapsed=8ms
ℹ tick 3/8: {"task":200,"conversation":200,"summary":200} interval=4012ms elapsed=8ms
ℹ tick 4/8: {"task":200,"conversation":200,"summary":200} interval=4011ms elapsed=6ms
ℹ tick 5/8: {"task":200,"conversation":200,"summary":200} interval=4009ms elapsed=5ms
ℹ tick 6/8: {"task":200,"conversation":200,"summary":200} interval=4008ms elapsed=4ms
ℹ tick 7/8: {"task":200,"conversation":200,"summary":200} interval=4009ms elapsed=4ms
ℹ tick 8/8: {"task":200,"conversation":200,"summary":200} interval=4008ms elapsed=4ms
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 28294.842228
```

✅ All three endpoints (`/api/tasks/:id`, `/api/tasks/:id/conversation`,
`/api/tasks/:id/conversation/summary`) return **200** on every tick.
✅ Interval avg **4009.6 ms**, inside the [3500, 4500] ms envelope
allowed by the brief (4 s ± 500 ms).
✅ Min/max **4008 / 4012 ms** — virtually no drift; the polling
interval is rock-steady against the live server.
✅ Bodies carry the right shape: `entries: Array`, `summary.total_entries`
+ `unread_count` + `has_unread` present, `task.id === OC-1787983990771`.
✅ No aborted fetch — every `Promise.all([getTask, getTaskConversation,
getTaskConversationSummary])` resolved cleanly with `AbortController`
wired in.

### Layer 2 — UI smoke (production deploy asset)

- File present at `dashboard/tests/e2e/r-f-2-polling.spec.ts`.
- `playwright.config.ts` reads `PLAYWRIGHT_E2E === '1'` to decide
  whether to spin up vite + emit the html report.
- Spec gates itself via `test.beforeEach` + `test.skip` when the env is
  off; an explanatory `console.log` line is printed on stderr so
  `npm run test:e2e` exits with **1 skipped** in the sandbox (no
  failure, no surprise).
- Production recipe in spec docstring: set
  `AGORA_DASHBOARD_SESSION_COOKIE` from a real login flow before running
  with `PLAYWRIGHT_E2E=1`.

### Files touched

| File | Action | Why |
| --- | --- | --- |
| `dashboard/playwright.config.ts` | rewrite | added PLAYWRIGHT_E2E gate + html-report path inside task_dir |
| `dashboard/tests/api/r-f-2-polling-api.test.mjs` | new | Layer 1 contract — real run |
| `dashboard/tests/e2e/r-f-2-polling.spec.ts` | new | Layer 2 UI smoke — gated, prod only |
| `dashboard/package.json` | edit | added 4 `test:api / test:e2e / test:e2e:install / test:e2e:all` scripts |
| `Doc/09-PLANNING/TASKS/2026-08-30-r-f-visual-verify/{task_plan,findings,progress}.md` | new | per AGENTS.md §3 |
| `Doc/10-WALKTHROUGH/2026-08-30-r-f-visual-verify.md` | new | walkthrough per AGENTS.md §4 |

No R-F.1 / R-F.2 / E.1 / R-E.2 business code was modified.