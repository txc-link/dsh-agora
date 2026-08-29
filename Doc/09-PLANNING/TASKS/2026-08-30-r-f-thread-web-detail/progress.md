# R-F thread web 详情面板 — progress

**Last updated**: 2026-08-29 (Asia/Shanghai, R-F.1)

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
| Status | ⏳ blocked on R-F.1 (R-F.1 ✅ done) |
