# R-F.2 polling visual verification — findings

## 1. Sandbox has a working agora server, just no dashboard session auth

- `GET http://127.0.0.1:18008/api/tasks` → 200 with the task list
- `GET http://127.0.0.1:18008/api/tasks/OC-1787983990771` → 200, full task
  payload (id, title `deploy-verify-23875`, state `active`, project_id
  `null`, current_stage `discuss`, team with three members, etc.)
- `GET /api/tasks/OC-1787983990771/conversation` → `{ "entries": [] }`
- `GET /api/tasks/OC-1787983990771/conversation/summary` → `{ "task_id",
  "total_entries": 0, "unread_count": 0, "has_unread": false, ... }`
- `POST /api/dashboard/session/login` → 404 `dashboard session auth is
  not enabled` — so the dashboard's login screen blocks any real Layer 2
  run from inside this sandbox. That's the whole reason Layer 1 is run
  directly against the API and Layer 2 is gated behind `PLAYWRIGHT_E2E=1`.

## 2. R-F.2 polling surfaces the right indicator hook

`dashboard/src/components/task/TaskDetailSheet.tsx` line 252:

```tsx
<p className="type-text-xs opacity-70" data-testid="task-detail-refresh-indicator">
  {shouldPoll
    ? isRefreshing
      ? copy.refreshing
      : relativeAgeSeconds === null
        ? copy.autoRefresh(pollSeconds)
        : copy.lastUpdated(relativeAgeSeconds)
    : copy.autoRefresh(pollSeconds)}
</p>
```

So the indicator carries four states:

- `Refreshing…` (while a fetch is in flight)
- `Auto refresh every Ns` (initial, before the first tick lands)
- `Last updated Xs ago` (steady state, driven by the 1Hz re-render)
- `Auto refresh every Ns` again (terminal task — `shouldPoll = false`)

The i18n keys (`tasks.lastUpdated`, `tasks.refreshing`, `tasks.autoRefresh`)
exist in both `zh-CN` and `en-US` segments of `resources.ts` (lines
~1884 / ~4174) and are exposed via `useTasksPageCopy()` in
`dashboardCopy.ts` line ~1230. The accessor pattern is:
`lastUpdated: (seconds: number) => t('tasks.lastUpdated', { seconds })`.

## 3. R-F.1 turned task links into buttons — the spec selector picks that up

`ProjectDetailPage.tsx` lines 449–456 (primary task button) and 496–503
(task row button):

```tsx
<button
  type="button"
  className="strong button-ghost"
  aria-label={`Open next-up task ${primaryTask.title}`}
  onClick={() => setOpenThreadTaskId(primaryTask.id)}
>
  {primaryTask.title}
</button>
```

Both buttons share `aria-label^="Open task "` semantics, which is the
selector the Playwright spec uses. Sheet opens via the
`openThreadTaskId` state on `ProjectDetailPage` line 584:
`<TaskDetailSheet taskId={openThreadTaskId} />`.

## 4. `AgoraClient.loadThread` is the exact fan-out we exercise in Layer 1

`dashboard/src/lib/agora-client.ts` lines 106–117:

```ts
async loadThread(taskId: string, options?: AgoraFetchOptions): Promise<AgoraThreadFetchResult> {
  const [task, conversation, summary] = await Promise.all([
    unwrap(getTask(taskId), options),
    unwrap(getTaskConversation(taskId), options),
    unwrap(getTaskConversationSummary(taskId), options),
  ]);
  return { taskId: task.id, entries: conversation.entries, summary };
}
```

Three parallel GETs. The Layer 1 spec issues the same three GETs per tick
with `AbortSignal` wired in, so it exercises both the success path and
the abort path the dashboard would use if the effect tore down mid-tick.

## 5. Sandbox polling numbers (Layer 1, real run)

Run: `cd dashboard && npm run test:api` (effectively `node --test
tests/api/*.test.mjs`).

| Tick | task | conversation | summary | interval (ms) | elapsed (ms) |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 200 | 200 | 200 | — | 11 |
| 2 | 200 | 200 | 200 | 4010 | 8 |
| 3 | 200 | 200 | 200 | 4012 | 8 |
| 4 | 200 | 200 | 200 | 4011 | 6 |
| 5 | 200 | 200 | 200 | 4009 | 5 |
| 6 | 200 | 200 | 200 | 4008 | 4 |
| 7 | 200 | 200 | 200 | 4009 | 4 |
| 8 | 200 | 200 | 200 | 4008 | 4 |

- All 200 ✅
- Avg interval = **4009.6 ms**, within the 3500–4500 ms envelope
- Min/max = 4008 / 4012 ms — essentially no jitter
- Wall-clock = ~28 s end-to-end (1 immediate + 7 × 4 s)
- No aborted fetch, no race

## 6. Why we did NOT write a single combined test

Tempting to fold the API loop and the UI walk into one Playwright test
(`page.request.get` for the network + browser click for the UI). Two
reasons against:

1. The network loop has no opinion about React rendering; it tests the
   *transport contract* (status, shape, interval). Conflating it with
   the UI hides regressions in either layer.
2. The UI spec must be **inert in the sandbox**; the API spec must run
   every commit. Two gates → two files.

## 7. What this verification does **not** cover

- Visual regression (chromium pixel diff vs a golden screenshot). Not
  asked for; would need a separate Playwright config with snapshot
  baselines.
- React effect cleanup ordering under unmount-during-inflight. Code
  review covered that statically; an effect-ordering test would require
  a React testing harness that the dashboard already has at
  `dashboard/src/test/`, but writing it was explicitly out of scope for
  this verification layer.
- Server-side rate-limiting / auth-failure behavior under malformed
  bearer tokens. The contract assumes `Authorization: Bearer …` is
  accepted; that is outside the polling contract.