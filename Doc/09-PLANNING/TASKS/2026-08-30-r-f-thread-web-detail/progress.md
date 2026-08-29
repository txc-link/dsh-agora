# R-F thread web 详情面板 — progress

**Last updated**: 2026-08-29 (Asia/Shanghai, R-F.2)

## R-F.1

| Field | Value |
|---|---|
| Status | ✅ done (within baseline-bounded scope) |
| Started | 2026-08-30 |
| Closed | 2026-08-29 |
| Worktree | `/home/ailink/dsh-agora/.worktrees/r-f-thread-web-detail` |
| Branch | `feat/r-f-thread-web-detail` |
| Scope discipline | §1.5 shortest path; no parallel http client / view-model / store / i18n key |

### Steps
- [x] 读 `ProjectDetailPage.tsx` / `WorkbenchDetailSheet.tsx` 现有数据流
- [x] 查 agora server thread / conversation REST 端点(`app.ts` L5918-5995 等)
- [x] Dashboard 端 REST client wrapper 设计(`lib/agora-client.ts` facade over `lib/api.ts`)
- [x] 详情面板接入真实数据 + 加载/错误态(`TaskDetailSheet` + `ProjectDetailPage` sheet 接入)
- [x] Dashboard dev 启动 + `npm run check` 跑通 + agora server e2e curl 验证

### Verification

- **`npx tsc -b`**: 5 errors(worktree) vs 3 errors(main baseline)。
  - 我引入 2 errors → 全部修好(`AgoraApiError` 与 view-model 边界统一用 `ApiTaskConversationEntryDto` 直接消费)。
  - 剩余 3 errors **与 main 完全相同**(均为 R-D 留下的 typedrift:`taskMappers.ts(377)`、`taskMappers.test.ts(165)`、`taskStore.live-api.test.ts(391)`)。
  - **结论**: R-F.1 **0 新增 typedrift**。
- **`npm test`**: 144 failed / 211 passed / 62 files(worktree) vs **完全相同数字** in main。失败原因均为 `React.act is not a function`(React 19 + vitest globals 互动问题,pre-existing)。
- **`npm run lint`**: PASS(eslint + design + i18n 三段全过)。
- **`npm run build`**: FAIL(tsc errors 阻断 — 与 main baseline 同源,不是 R-F.1 债)。
- **`npm run dev`**: Vite ready in 433ms,无 console 错误。`curl http://localhost:5173/dashboard/src/{main,pages/ProjectDetailPage,components/task/TaskDetailSheet}.tsx` 均 200 OK,vite transform 无错误。
- **agora server 实际可达**:YES,token `4kRczZLEbmf...`,实测 task `OC-1787983990771`(`deploy-verify-23875`)详情 + conversation 全部 200 OK。R-F.1 数据流链路同 TasksPage 现网路径(`useTaskStore.selectTask → lib/api.ts → fetch /api/tasks/:id + /api/tasks/:id/conversation + /api/tasks/:id/conversation/summary`),TasksPage 已经在用,等价。

### Files added

- `dashboard/src/lib/agora-client.ts` — `AgoraClient` + `AgoraApiError` + `loadThread / getTaskConversation / markConversationRead`
- `dashboard/src/types/agora.ts` — `AgoraApiError`, `AgoraThreadBundle`, `AgoraClientConfig`, `AgoraFetchOptions`
- `dashboard/src/components/task/TaskDetailSheet.tsx` — 共享 conversation body,`idle / loading / error / ready` 四态

### Files modified

- `dashboard/src/pages/ProjectDetailPage.tsx` — 加 `openThreadTaskId` state,governance queue / primary task / related tasks / next-up 四处 task 标题 `Link → button`,末尾加 `<WorkbenchDetailSheet>` 包 `<TaskDetailSheet>`,移除无引用的 `buildProjectTaskHref` import。
- `dashboard/src/types/task.ts` — `TaskConversationEntry` 加 optional `thread_task_binding_id: string | null`(对齐 `@agora-ts/contracts` task-conversation schema;`binding_id` 保留 `string` 不放宽以避免破坏既有 test fixture;view-model 与 DTO 对齐留给 R-D 治理债)。

### Workspace symlinks (non-code, not for commit)

- `dashboard/node_modules → /home/ailink/dsh-agora/dashboard/node_modules`(worktree 复用 main 已装的 deps)
- `agora-ts/packages/contracts/node_modules/zod → /home/ailink/dsh-agora/dashboard/node_modules/zod`(worktree 内 contracts 包 `import 'zod'` 解析需要)

### Open follow-ups (deferred, not blocking R-F.1)

1. **R-F.2**: real-time 选型(SSE vs polling)。
2. **R-D typedrift 治理债**: `taskMappers.ts(377)` `binding_id` 放宽 + 3 个 test fixtures 补 `thread_task_binding_id`,由 §6 流程主导。
3. **dashboard `npm test` baseline 修复**: `React.act is not a function` pre-existing,归测试基础设施债。

## R-F.2

| Field | Value |
|---|---|
| Status | ✅ done (within baseline-bounded scope) |
| Started | 2026-08-29 |
| Closed | 2026-08-29 |
| Worktree | `/home/ailink/dsh-agora/.worktrees/r-f-thread-web-detail` |
| Branch | `feat/r-f-thread-web-detail` |
| Scope discipline | §1.5 shortest path; 4s short-poll inline in `TaskDetailSheet`, no subscribe abstraction, no new server endpoint, no third-party lib |

### Steps

- [x] **设计选型** — 短轮询(§1.5 最短路径, R-F.1 findings §8.1 推荐)。
- [x] **`TaskDetailSheet` 加 4s 轮询 effect** — 仅当 task 处于非终态(`completed/failed/cancelled`)才轮询;`useEffect` 依赖 `[shouldPoll, taskId]`;effect 内 hoist 一个 `AbortController`,cleanup `controller.abort() + clearInterval`,`cancelled` flag 阻止 post-cleanup 写入 store。
- [x] **Race-condition 防护** — `inflightRef: useRef<boolean>`,重叠 tick 直接 `return`,避免并发请求堆叠。
- [x] **Stale-closure 防护** — 每次 effect 重启时 `targetTaskId` 在闭包内重新捕获;`taskId` 变化触发 effect 重建。
- [x] **UI indicator** — sheet header 加 `<p data-testid="task-detail-refresh-indicator">`,`Refreshing...` / `Last updated Xs ago` / `Auto-refresh every Ns` 三态切换;另起 1Hz `setInterval` 单独驱动 "Xs ago" 重渲染,**不**触发任何网络请求。
- [x] **i18n 新增 3 个 key**(中英双语):`tasks.lastUpdated` / `tasks.refreshing` / `tasks.autoRefresh`,均带 `{{seconds}}` 插值。
- [x] **不引入 `subscribeThread` 抽象** — §1.5 最短路径:`useEffect` + `setInterval` + `AbortController` 足够,抽 facade 是过度设计。
- [x] **不修改 agora-ts** — server / contracts / apps/cli 不动。

### Verification

- **`npx tsc -b`**: 3 errors — **完全等于 main baseline**。3 个错误均为 R-D typedrift 债(`taskMappers.ts(377)` mapping,`taskMappers.test.ts(165)` fixture,`taskStore.live-api.test.ts(391)` fixture)。**R-F.2 0 新增 typedrift**。
- **`npm run lint`**: PASS(eslint + design + i18n 三段全过;`lint:i18n` 通过 → 8 个 project surface 全部包含新增 3 个 key)。
- **`npm test`**: 144 failed / 211 passed / 35 files failed — **完全等于 main baseline**;失败均 `React.act is not a function` pre-existing。**R-F.2 0 新增测试失败**。
- **`npm run dev`**: `VITE v7.3.1 ready in 444 ms`,无 console error。
- **Vite transform 探针**: 4 个 R-F.2 改动模块(`TaskDetailSheet.tsx` / `agora-client.ts` / `dashboardCopy.ts` / `resources.ts`)经 `curl http://localhost:5173/dashboard/src/...` 全部 `HTTP 200`,无 transform error。
- **agora server 健康**: `curl http://127.0.0.1:18008/api/health` → `200 {"status":"ok"}`。
- **真实 conversation 端点 E2E**: 因 server token 轮换,`test-token` 与历史 `4kRczZLEbmf...` 均 `403 invalid api token`,无法在不刷 token 的情况下做 R-F.1 同款 curl 端到端。**Polling 效果靠 code review 验证**:
  - cleanup 路径:`return () => { cancelled = true; controller.abort(); clearInterval(intervalId); }`(L188-191)
  - abort 静默:`error.statusText === 'aborted' || error.status === 0` 直接 `return`,UI 不闪错(L163)
  - 重叠 tick:`inflightRef.current === true` 时直接 `return`,避免并发(L134)
  - 终态停止:task 进入 `completed/failed/cancelled` → `taskIsLive === false` → `shouldPoll === false` → effect 早期 return 并 cleanup

### Files added
(无)

### Files modified

- `dashboard/src/components/task/TaskDetailSheet.tsx` — 新增 `POLL_INTERVAL_MS = 4000` / `RELATIVE_TICK_MS = 1000` 常量、`TERMINAL_TASK_STATES` 集合;新增两个 `useEffect`(短轮询 + 1Hz tick);新增 `lastUpdatedAt` / `isRefreshing` 两个 state + `inflightRef`;sheet header 加 refresh indicator `<p>`。
- `dashboard/src/lib/dashboardCopy.ts` — `useTasksPageCopy()` 加 `lastUpdated(seconds)` / `refreshing` / `autoRefresh(seconds)` 三个返回字段。
- `dashboard/src/locales/resources.ts` — `tasks.*` 命名空间下 zh-CN 加 `lastUpdated` / `refreshing` / `autoRefresh`,en-US 同步加。

### Workspace symlinks (non-code, not for commit)

- 同 R-F.1,无变化。

### Open follow-ups (deferred, not blocking R-F.2)

1. **Polling → SSE 升级路径** — 若未来需要"通知即推"(避免 4s 延迟上限),server 加 `text/event-stream` 端点(`/api/tasks/:id/conversation/stream`)+ Last-Event-ID 续传 + token 鉴权;前端把 `useEffect + setInterval` 换成 `EventSource`。当前 polling 是 §1.5 最短路径的合法选择。
2. **R-D typedrift 治理债**:同 R-F.1 记账。
3. **dashboard `npm test` baseline 修复**:同 R-F.1 记账。
4. **实际 E2E 视觉验证**: 因 server token 不可获取,polling 的"用户视觉感知"留待总工在自己浏览器里点一次确认(只需打开任意 active 任务的 sheet,看到 `Last updated Xs ago` 4s 内更新即可)。
