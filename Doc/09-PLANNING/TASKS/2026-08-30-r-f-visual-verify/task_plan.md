# R-F.2 polling visual verification — task plan

| Field | Value |
| --- | --- |
| Created | 2026-08-30 |
| Owner | R-F.2 visual subagent (delegated by chief engineer) |
| Worktree | `/home/ailink/dsh-agora/.worktrees/r-f-visual-verify` |
| Branch | `feat/r-f-visual-verify` |
| Branched from | `develop` @ `13695bb` (R-F.1 + R-F.2 merged) |
| Scope | Layer 1 (API) + Layer 2 (UI smoke assets) for R-F.2 polling |
| Final commit | **NOT committed** — chief engineer batches the close-out |
| Companion docs | `findings.md`, `progress.md`, `Doc/10-WALKTHROUGH/2026-08-30-r-f-visual-verify.md` |

## Why this task exists

R-F.1 (`98d653a` — wait, `96d278a`) shipped the `AgoraClient` facade + the
`TaskDetailSheet` consuming real `/api/tasks/:id/conversation`. R-F.2
(`2b32d09`) added the 4-second short poll, the 3-tier race protection
(AbortController + `inflightRef` + `cancelled` flag) and 3 i18n keys
(`tasks.lastUpdated`, `tasks.refreshing`, `tasks.autoRefresh`). Code review
validated the cleanup / abort / race paths inside the React effect.

**Gap**: nothing exercises the polling loop end-to-end against a real
agora server. We need two layers of evidence:

| Layer | What it proves | Where it runs |
| --- | --- | --- |
| **L1 API** | every tick of `agoraClient.loadThread` returns 200, shape is stable, interval ≈ 4 s, no race leak | `dashboard/tests/api/r-f-2-polling-api.test.mjs` — `node --test`, runs in sandbox against the live agora server |
| **L2 UI** | the indicator says "Last updated Xs ago" with X ≥ 3, advances after one interval, sheet re-renders | `dashboard/tests/e2e/r-f-2-polling.spec.ts` — Playwright, gated by `PLAYWRIGHT_E2E=1` because the sandbox cannot mint a real session cookie |

The split is by design: Layer 1 gives us hard numbers from a real network
loop; Layer 2 is a production smoke that needs a real dashboard login and
so ships inert in the sandbox.

## Out of scope

- Re-touching R-F.1 or R-F.2 code (the brief is explicit: "你的改动是补
  R-F.2 的验证层, 不是改业务代码").
- Fixing baseline debt (`tsc -b` 3 errors, `npm test` 144 failed — pre-R-F.2).
- Adding SSE/WebSocket. R-F.2 chose polling on purpose; R-F.3 (if it
  happens) is the place for SSE.
- Disabling the dashboard session auth wall for the sandbox. That would
  amount to faking human login — explicitly forbidden by
  `AGENTS.md §2 Entry Surface Rules`.

## Step plan

1. ✅ Inspect existing R-F.2 assets (`TaskDetailSheet.tsx`,
   `agora-client.ts`, `resources.ts`, `dashboardCopy.ts`,
   `ProjectDetailPage.tsx`).
2. ✅ Probe live agora server endpoints (`/api/tasks`,
   `/api/tasks/OC-1787983990771`, `/conversation`,
   `/conversation/summary`) — all 200.
3. ✅ Write `dashboard/playwright.config.ts` (Layer 2 asset, gated).
4. ✅ Write `dashboard/tests/api/r-f-2-polling-api.test.mjs` (Layer 1
   contract — runs in sandbox).
5. ✅ Write `dashboard/tests/e2e/r-f-2-polling.spec.ts` (Layer 2 — sandbox
   skip).
6. ✅ Add `dashboard/package.json` scripts (`test:api`, `test:e2e`,
   `test:e2e:install`, `test:e2e:all`).
7. ✅ Run `npm run test:api` — 8/8 ticks pass, avg 4009.6 ms.
8. ⏳ Chief engineer commits + closes out the branch.

## Verification criteria

- Layer 1 (mandatory in sandbox):
  - `node --test tests/api/*.test.mjs` exits 0
  - `8/8 ticks OK` line printed
  - interval avg ∈ [3500, 4500] ms (allow ±500 ms around the 4000 ms
    POLL_INTERVAL_MS).
- Layer 2 (production only):
  - `PLAYWRIGHT_E2E=1 npm run test:e2e` exits 0 against a server with
    `AGORA_DASHBOARD_AUTH_ENABLED=true`.
- Out of sandbox: `test.skip()` must produce `1 skipped` rather than a
  hard failure.

## Risks

| Risk | Mitigation |
| --- | --- |
| Layer 1 server stalls and interval drifts > 6 s | Assert `maxInterval ≤ 6000`; fail fast with the tick number |
| Bearer token leak into spec files | Token is read from env, never inlined beyond a sandbox default. Production runs must export `AGORA_ROOT_TOKEN` and not commit any real token |
| Playwright accidentally starts in sandbox | Config reads `PLAYWRIGHT_E2E === '1'` to decide whether to spawn vite; spec also gates via `test.skip()` |
| playwright-report folder polluting repo | Config writes it to `Doc/09-PLANNING/TASKS/2026-08-30-r-f-visual-verify/playwright-report/`, outside `dashboard/` |
| Spec depends on a real project ID the sandbox doesn't have | Spec falls back to `/dashboard/projects` if `project_id` is null on the picked task; in production the dashboard exposes the active task in the "Related tasks" panel even with no project binding |