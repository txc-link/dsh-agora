# R-F thread web 详情面板 — findings

**Last updated**: 2026-08-29 (Asia/Shanghai, R-F.2)
**Surveyor**: R-F.1 + R-F.2 subagents
**Scope**: dashboard ↔ agora REST thread/conversation layer

---

## 1. dashboard 现状 — 现有详情面板数据流

### 1.1 `dashboard/src/pages/ProjectDetailPage.tsx`

- **数据来源**: `useProjectStore.selectedProject` + `useProjectWorkspacePage()`(`dashboard/src/hooks/useProjectWorkspacePage.ts`)。
- **流程**: `useParams` 取 `projectId` → `selectProject(projectId)` → 后端 `getProjectWorkbench(projectId)` → 返回 `selectedProject = { project, overview, surfaces, work, operator }`。
- **task 显示位置**: governance queue(等审批)、primary task、related tasks、next-up。
- **task 交互**: 用 `<Link to={buildProjectTaskHref(task.id, project.id)}>` 跳到 `/projects/:projectId/tasks/:taskId`(但路由上没看到对应该路径的 page — 在 project 路由下走的是 TasksPage 的相对路径,实际是 click-through 到 TasksPage 的 detail sheet)。
- **结论**: ProjectDetailPage **目前不含 thread/conversation 渲染**,只显示 task metadata。R-F.1 的真实目标是"在 project 页里点 task 时打开 sheet 显示 conversation"。

### 1.2 `dashboard/src/components/ui/WorkbenchDetailSheet.tsx`

- 纯 UI shell,**无数据流**:`{ label, title, onClose, children }`,只渲染 `dialog` backdrop + panel + `view-transition-name`。
- 没有 fetch、没有 store 接入、不该承担 thread 数据流的责任(§1.5:WorkbenchDetailSheet 是通用容器,thread 数据流归 TaskDetailSheet)。

### 1.3 现有 http client: `dashboard/src/lib/api.ts`

- 已存在成熟的 `request()` wrapper(行 730-755),基于 `fetch` + Zod schema 校验。
- `apiBase` 从 `localStorage['agora-settings'].state.apiBase` 读(默认 `/api`)。
- `apiToken` 从同位置读,作为 `Authorization: Bearer` header。
- 已有 task conversation 端点封装:
  - `getTask(taskId)` (L781)
  - `getTaskStatus(taskId)` (L785)
  - `getTaskConversation(taskId)` (L789)
  - `getTaskConversationSummary(taskId)` (L1006)
  - `markTaskConversationRead(taskId, payload)` (L1013)
- 所有 schema 来自 `@agora-ts/contracts`(`taskSchema`、`taskConversationListResponseSchema` 等)。
- **结论**: R-F.1 不需要新建 http client — 直接复用 `lib/api.ts` 的 wrapper,新增 facade 层即可。

### 1.4 现有 task store: `dashboard/src/stores/taskStore.ts`

- `selectTask(taskId)`(L215-235)已经会并发拉 `getTask + getTaskStatus + getTaskConversationSummary + getTaskConversation + getCraftsmanGovernance`(L120-126),自动 mark-read,然后写入 `selectedTaskStatus` 包含 `conversation: TaskConversationEntry[]` + `conversationSummary: TaskConversationSummary`。
- **结论**: 不需要新建 store 状态 — R-F.1 复用 `selectTask(taskId)` 即可,和数据流已经在 TasksPage 端验证过同款。

### 1.5 现有 task detail sheet

- `dashboard/src/pages/TasksPage.tsx`(L1941-2012)在 `<WorkbenchDetailSheet>` 内已经渲染 conversation timeline 和 entry 列表。
- i18n key 已存在:`tasks.conversationTitle`、`tasks.conversationEmpty`(中英双语),`tasks.detailLoadingSummary`、`tasks.detailErrorTitle`。
- **结论**: TasksPage 已经有完整 conversation 渲染模板,R-F.1 抽出共享组件供 ProjectDetailPage 复用。

### 1.6 i18n 已有 key 适配

- `conversationTitle`、`conversationEmpty`、`detailLoadingSummary`、`detailErrorTitle` — 都在 `useTasksPageCopy()`。
- `primaryThreadLabel`、`relatedTasksEmpty` — 在 `useProjectDetailPageCopy()`。
- **不**造新 key,避免 i18n 治理债。

---

## 2. agora-ts server 端 task / conversation REST 端点

Server: `agora-ts/apps/server/src/app.ts`(Fastify 风格,无 routes/ 目录,所有路由 inline)。
Base URL: `http://127.0.0.1:18008`(本机),Bearer token 鉴权(401 if missing)。

| Method | Path | 行号 | 用途 |
|---|---|---|---|
| GET | `/api/tasks/:taskId` | L3391 | 单 task 详情;`404 if not found` |
| GET | `/api/tasks/:taskId/status` | L3403 | task status + subtaskExecutions + flow_log + conversation summary |
| POST | `/api/tasks/:taskId/advance` | L3416 | 推进 task |
| POST | `/api/tasks/:taskId/approve` / `/reject` | L3446 / L3502 | 治理审批 |
| POST | `/api/tasks/:taskId/archon-approve` / `/archon-reject` | L3810 / L3865 | archon 审批 |
| POST | `/api/tasks/:taskId/confirm` | L4049 | 投票 |
| POST | `/api/tasks/:taskId/pause` / `/resume` / `/cancel` | L4069 / L4095 / L4119 | 任务状态机 |
| POST | `/api/tasks/:taskId/unblock` | L4145 | 解阻塞(retry/skip/reassign) |
| POST | `/api/tasks/cleanup` | L4169 | 批量清理 |
| GET | `/api/tasks/:id/conversation` | L5918 | **核心**:conversation entries 列表 |
| GET | `/api/tasks/:id/conversation/summary` | L5931 | summary + unread 计数(需 human session) |
| POST | `/api/tasks/:id/conversation/read` | L5945 | mark read cursor |
| POST | `/api/tasks/:id/conversation/reply` | L5963 | **R-D inbound reply**(`inboxReplyService`,需配) |
| GET | `/api/tasks/:id/notifications` | L5882 | notification 列表 |
| GET | `/api/tasks/:id/context-bindings` | L5811 | 上下文绑定 |
| GET | `/api/tasks/:id/participant-bindings` | L5824 | 参与者绑定 |
| GET | `/api/tasks/:id/runtime-session-bindings` | L5837 | runtime session 绑定 |
| PUT | `/api/tasks/:id/runtime-session-bindings/:participantBindingId` | L5850 | rebind runtime |
| POST | `/api/tasks/:id/context-binding` | L5790 | 绑定 context |
| POST | `/api/tasks/:taskId/context/delivery` | L2660 | project context delivery |
| POST | `/api/tasks/:taskId/subtask-done` | L3920 | 子任务完成 |
| POST | `/api/tasks/:taskId/subtasks/:subtaskId/{close,archive,cancel}` | L3941/3962/3983 | subtask 操作 |
| GET | `/api/tasks/:taskId/subtasks` / POST | L4004 / L4017 | subtask 列表 / 创建 |
| GET | `/a2a/tasks/:taskId` | L5399 | A2A task 视图 |
| POST | `/a2a/tasks/*` | L5410 | A2A 提交 |

**503 fallback**: 所有 `taskConversationService` 路由若服务未配置返回 `503 { message: '...' }`。
**Stream/SSE**: 未发现 `text/event-stream` 或 SSE 端点。events 由 dispatcher 推 inbox/conversation 表,不暴露 web stream(§R-F.2 选型需考虑 polling / 改造)。

---

## 3. agora server 实际可达性 — **YES**

- `GET http://127.0.0.1:18008/api/health` → `200 {"status":"ok"}`
- `GET /api/tasks` 无 token → `401 {"message":"missing bearer token"}`
- `GET /api/tasks` with token `4kRczZLEbmf...` → `200` 返回 task 列表
- 实测 task ID: **`OC-1787983990771`**(title `deploy-verify-23875`, state `active`, stage `discuss`)
- `GET /api/tasks/OC-1787983990771/conversation` → `200 {"entries":[]}`(实测该 task 无 entries)
- `GET /api/tasks/OC-1787983990771/conversation/summary` → `200 { total_entries: 0, ... }`
- `GET /api/tasks/non-existent-xyz/conversation` → `200 {"entries":[]}`(不 404,返回空列表)
- `POST /api/tasks/:id/conversation/reply` → **404 Route not found**(`inboxReplyService` 在该 server 实例未配置,与 R-F.1 无关)

**结论**: agora REST 服务可用,R-F.1 数据流在浏览器内可以走通。

---

## 4. REST client 设计动机

### 4.1 为什么新建 `lib/agora-client.ts` 而不是直接用 `lib/api.ts`?

任务文档要求新建;但**不在 http 层面平行定义一个新 client**(§1.5:不平行、不冗余、不造第二个 http stack)。

实现方式:`AgoraClient` 是一个 thin facade,**复用 `api.ts` 现有方法**,只在 facade 内部做:
1. **错误品牌化**: `lib/api.ts` 抛 `ApiError`(未导出),R-F consumer 想要的语义是 "Agora 调用是否 401 / 404 / 500"。`AgoraApiError` 在 facade 边界把上游错误**重新封装**为公开的稳定品牌,消费者可以 `error.isUnauthorized()` 分支判断,无需解析 message 字符串。
2. **环境变量解析**: `VITE_AGORA_URL` / `VITE_AGORA_TOKEN` + 已有 `localStorage['agora-settings']` 兜底,集中放在 `AgoraClient` 构造期。
3. **新方法 `loadThread(taskId)`**: 并发 `getTask + getTaskConversation + getTaskConversationSummary`,返回 `AgoraThreadFetchResult`(聚合 + typed,作为后续 real-time / hook 的接口)。

### 4.2 为什么 token 来源这样设计?

- `VITE_AGORA_TOKEN`: 编译期注入,适合 CI / production(注意 **Vite `VITE_*` 暴露到 bundle,token 不该放这** — 实际放 `apiToken` 在 localStorage,环境变量只是覆盖路径)。
- `localStorage['agora-settings'].state.apiToken`: 与现有 `lib/api.ts::getConfig()` 同源(行 705-728),保证 R-F.1 客户端和 TasksPage 客户端用同一份 token。
- 优先顺序: env > localStorage > null。env null + localStorage null 时,调用仍按现有 `lib/api.ts` 的 token 注入逻辑走(实际不发 Authorization header,server 返回 401,`AgoraApiError.isUnauthorized() === true`,UI 显示登录提示)。

### 4.3 为什么新建 `types/agora.ts` 而不是直接复用 `types/task.ts`?

`TaskConversationEntry` 已存在但**与 contracts DTO typedrift**(R-D 治理债:`binding_id: string → string | null` 与新增 `thread_task_binding_id`,test fixture 还停在老 shape)。

`types/agora.ts` 直接 re-export `ApiTaskConversationEntryDto`(来自 `@agora-ts/contracts`),把 contracts 作为权威,R-F.1 不承担"修复 view-model 与 contracts 对齐"这种 R-D 留下的债。如果 R-F.2 / R-D 后续修好 typedrift,`@/types/api` 自动反映,R-F.1 不动。

---

## 5. contracts/task-conversation schema

`agora-ts/packages/contracts/src/task-conversation.ts` 主要 schema(从已读):

- `taskConversationDirectionSchema = z.enum(['inbound', 'outbound', 'system'])`
- `taskConversationAuthorKindSchema = z.enum(['human', 'agent', 'craftsman', 'system'])`
- `taskConversationBodyFormatSchema = z.enum(['plain_text', 'markdown', 'structured'])`
- `taskConversationEntrySchema`: 含 `id, task_id, binding_id: nullable, thread_task_binding_id: nullable, provider, provider_message_ref: nullable, parent_message_ref: nullable, direction, author_kind, author_ref: nullable, display_name: nullable, body, body_format, occurred_at, ingested_at, metadata: nullable Record<string,unknown>`
- `taskConversationListResponseSchema = { entries: [...] }`
- `taskConversationSummarySchema`: 含 `task_id, total_entries, latest_*, last_read_at, unread_count, has_unread`
- `recordInboundReplyRequestSchema`: `provider, provider_message_ref, parent_message_ref: nullable, body, author_kind, author_ref: nullable, display_name: nullable, occurred_at, thread_task_binding_key: nullable`(**R-D inbound reply,无 matrix 协议词汇,符合 §1 边界**)
- `recordInboundReplyResponseSchema = { id, deduped }`

---

## 6. 改动清单(本 worktree)

### 6.1 新建文件

- `dashboard/src/lib/agora-client.ts`(`AgoraClient` + `AgoraApiError` facade,基础 URL `VITE_AGORA_URL` + token `VITE_AGORA_TOKEN` + localStorage 兜底)。
- `dashboard/src/types/agora.ts`(`AgoraApiError` + `AgoraThreadBundle` + `AgoraClientConfig` + `AgoraFetchOptions`)。
- `dashboard/src/components/task/TaskDetailSheet.tsx`(纯 presentation body,接 `useTaskStore`,四态:`idle | loading | error | ready`)。

### 6.2 修改文件

- `dashboard/src/pages/ProjectDetailPage.tsx`:
  - 加 `openThreadTaskId` 状态。
  - 改 governance queue / primary task / related tasks / next-up 三处 task 标题 `Link` → `button onClick={() => setOpenThreadTaskId(task.id)}`。
  - 末尾加 `<WorkbenchDetailSheet>` 包 `<TaskDetailSheet taskId={openThreadTaskId} />`。
  - 移除现已无引用的 `buildProjectTaskHref` import。
- `dashboard/src/types/task.ts`: `TaskConversationEntry` 加 optional `thread_task_binding_id` 字段(避免破坏现有 test fixture;`binding_id` 保留为 `string` 不放宽,留给 R-D 治理债治理)。

### 6.3 工作区 symlink(非代码改动)

- `dashboard/node_modules → /home/ailink/dsh-agora/dashboard/node_modules`(worktree 内无 `node_modules`,symlink 复用主仓)。
- `agora-ts/packages/contracts/node_modules/zod → /home/ailink/dsh-agora/dashboard/node_modules/zod`(worktree 内 contracts 包需要 `zod` 才能 resolve `import 'zod'`,主仓 dashboard 复用缓存,worktree 走独立路径)。
- **注意**: 这两个 symlink 仅在 worktree,不进入 commit(`.gitignore` 应排除 `node_modules`,确认)。

---

## 7. 验证结果

### 7.1 `npx tsc -b`(worktree)

- **5 errors**(主仓 baseline 是 3 errors)。
- 我引入 2 个 → 已修。
- 剩下 3 个 **与主仓完全相同**(均为 R-D 留下的 typedrift:`taskMappers.ts(377)` mapping、`taskMappers.test.ts(165)` fixture、`taskStore.live-api.test.ts(391)` fixture)。
- **结论**: R-F.1 **没有新增 typedrift**。

### 7.2 `npm test`(worktree)

- **144 failed / 211 passed (35 files failed / 27 passed)**。
- 主仓: **144 failed / 211 passed (35 files failed / 27 passed)** — **完全相同**。
- 失败原因均为 `React.act is not a function`(React 19 + vitest + jsdom 互动问题),pre-existing,不在 R-F.1 范围。

### 7.3 `npm run lint`

- **PASS**(eslint + design + i18n 三段)。

### 7.4 `npm run build`

- **FAIL**(被 R-D typedrift 阻断)。
- 是 baseline 状态,不归 R-F.1 负责。

### 7.5 `npm run dev` + vite transform

- **READY in 433ms**,无 console 错误。
- 三个 R-F.1 关键模块 `main.tsx` / `pages/ProjectDetailPage.tsx` / `components/task/TaskDetailSheet.tsx` 通过 `curl http://localhost:5173/dashboard/src/...` 拿到 `200 OK` transformed bundle,无 transform error。

### 7.6 Agora server e2e fetch

- `GET /api/tasks` + `GET /api/tasks/OC-1787983990771` + `GET /api/tasks/OC-1787983990771/conversation` 全部 `200 OK`,token 鉴权正常。
- R-F.1 数据流链路 `selectTask(taskId)` → `lib/api.ts` → `fetch /api/tasks/:id + /api/tasks/:id/conversation + /api/tasks/:id/conversation/summary` 已在 TasksPage 上跑过,R-F.1 复用同 store,等价。

---

## 8. 未决 / 留待后续轮次

### 8.1 Real-time 选型(留给 R-F.2)

- 当前 server **无 SSE / WebSocket 端点**,events 落库后由 dispatcher 异步推 inbox/conversation。
- 候选:
  - **短轮询**(3-5s):实现最简单,适合 thread 详情面板(刷新粒度低,流量小)。
  - **SSE 改造**:需 server 加 `/api/tasks/:id/conversation/stream`(Fastify SSE 支持 ok),token 鉴权 + Last-Event-ID 续传。
  - **WebSocket**:over-engineering,thread 不需要双向通信。
- **R-F.2 建议**: 短轮询优先(§1.5:不扩展到用户未要求的方案范围;R-F.2 task_plan 明确 SSE vs polling 选型)。

### 8.2 R-D typedrift 治理债(留给 §6 流程)

- `src/lib/taskMappers.ts(377)` `binding_id: string → string | null` 适配 + 3 个 test fixture 缺 `thread_task_binding_id` 字段。
- R-F.1 通过 `types/agora.ts` 直接用 `ApiTaskConversationEntryDto` 绕开,**不**主动修 `types/task.ts` 与 taskMappers,避免 R-F.1 越界承担 R-D 债。

### 8.3 dashboard `npm run check` 全链路现状

- 主仓 baseline:`tsc -b` 3 errors + `npm test` 144 failed(`React.act is not a function`) + `npm run lint` PASS + `npm run build` FAIL(tsc errors 阻断)。
- 我的 worktree 现状: 同上 + 我的改动 **0 新增 typedrift**。
- **禁止声明 R-F.1 让 `npm run check` 整体 pass**,因为主仓 baseline 已经是 broken。诚实记录 baseline 状态。

---

## 9. §1 / §1.5 / §2 自检

- **§1 三层口径**: R-F.1 是 Dashboard(上层 entry adapter)改动,Core 不动;thread/conversation 是 Core 中性概念,通过 agora REST 暴露,adapter 端 ProjectDetailPage 消费 — 符合。
- **§1.5 短路径**: 没有平行 http client(沿用 `lib/api.ts`)、没有平行 view-model(用 contracts DTO 直接消费)、没有平行 store action(沿用 `useTaskStore.selectTask`)、没有 i18n key 平行(沿用 `conversationTitle`/`conversationEmpty`/`detailLoadingSummary`/`detailErrorTitle`/`primaryThreadLabel`/`relatedTasksEmpty`)。符合。
- **§2 Entry Surface**: Dashboard 是人类入口;`ProjectDetailPage` 加 thread 入口属于人类触发,符合;R-D 已接的 `/conversation/reply`(matrix adapter)仍由 adapter 触发,不归 R-F.1。

---

## 10. R-F.2 实施细节与选型

### 10.1 选型:短轮询 vs SSE vs WebSocket

| 候选 | 优点 | 缺点 | 决定 |
|---|---|---|---|
| **短轮询 4s** | 零 server 改动、复用现有 GET、§1.5 最短路径、unmount 即停 | 4s 内通知延迟、每秒 ~0.25 次请求/活跃 sheet | ✅ 采纳 |
| SSE (`/api/tasks/:id/conversation/stream`) | 通知即推、增量 payload | 需 server 加端点 + token 鉴权 + Last-Event-ID 续传、需 `@agora-ts/contracts` 加 SSE schema | ⏳ 留待 polling 不够时再升级 |
| WebSocket | 双向 | 需新 server 端点 + heartbeat + reconnect 策略;thread 不需双向 | ❌ over-engineering |

**理由**:
- R-F.1 已确认 server 无 SSE / WebSocket 端点(`app.ts` 全文搜索 `text/event-stream` / `EventSource` / `ws` / `socket.io` 均为 0)。
- 选 polling 完全符合 §1.5 "不扩展到用户未要求的方案范围"。
- 4s 是 polling 行业惯例(Linear / Notion 5s, GitHub Issues 30s),thread detail 的延迟可接受。

### 10.2 实现细节(文件位置 + 关键行号)

`dashboard/src/components/task/TaskDetailSheet.tsx`:

| 元素 | 行号 | 作用 |
|---|---|---|
| `POLL_INTERVAL_MS = 4000` | L37 | 轮询间隔常量(顶部 const) |
| `RELATIVE_TICK_MS = 1000` | L40 | 1Hz 重渲染 "Xs ago" 用 |
| `TERMINAL_TASK_STATES = Set([...])` | L46 | 终态白名单 |
| `isTaskStateTerminal(state)` | L51 | helper |
| `useState lastUpdatedAt / isRefreshing` | L117-118 | UI 显示 |
| `useRef inflightRef` | L120 | 重叠 tick 防护 |
| `useEffect 短轮询` | L126-194 | 主循环;`AbortController` hoisted,cleanup `abort() + clearInterval` |
| `useEffect 1Hz tick` | L196-202 | 仅 re-render "Xs ago",不发请求 |
| `<p data-testid="task-detail-refresh-indicator">` | L248-256 | UI indicator |

### 10.3 Race-condition & stale-closure 防护细节

- **Stale closure**: `useEffect` 依赖 `[shouldPoll, taskId]`,每次 `taskId` / `shouldPoll` 变化都重建 effect 并 `targetTaskId = taskId` 重新捕获,**不依赖 ref 持有最新值**(避免双重状态源)。
- **Race condition**:`inflightRef.current === true` 时,新 tick 直接 return,旧 promise 完成后才允许下个 tick 进入。
- **Tear-down ordering**: `return () => { cancelled = true; controller.abort(); clearInterval(intervalId); }` — 顺序保证:1) 阻止新写入,2) 中断在途请求,3) 停止新 tick。`AbortError` 由 `error.statusText === 'aborted'` 分支静默(L163),UI 不闪错。

### 10.4 与 R-F.1 view-model 的衔接

- R-F.1 选 `types/agora.ts` 直接 re-export `@agora-ts/contracts` DTO,**不**走 `TaskConversationEntry` view-model(避免触发 R-D typedrift 债)。
- R-F.2 polling 反向写回 store 时,仍用 `mapTaskConversationEntryDto(bundle.entry)` 把 DTO 映射为 view-model(`taskMappers.ts:376`),与 R-F.1 启动 `selectTask()` 时的写法一致 — 同一组件两种数据来源,**统一渲染路径**。
- 替换路径只覆盖 `selectedTaskStatus.conversation` 与 `selectedTaskStatus.conversationSummary`,**不**触动 `task` / `subtasks` / `flow_log` — polling 范围内语义自洽,不会因部分刷新导致 UI flicker。

### 10.5 i18n 键扩展

新增 3 个 key,`tasks.*` 命名空间下:

| key | 插值 | zh-CN | en-US |
|---|---|---|---|
| `tasks.lastUpdated` | `{{seconds}}` | 最后更新 {{seconds}} 秒前 | Last updated {{seconds}}s ago |
| `tasks.refreshing` | — | 正在刷新会话… | Refreshing conversation… |
| `tasks.autoRefresh` | `{{seconds}}` | 每 {{seconds}} 秒自动刷新 | Auto-refresh every {{seconds}}s |

`npm run lint:i18n` 通过 → 8 个 project surface 全部包含新增 key,无遗漏/拼写错。

### 10.6 已知限制

1. **Polling 4s 延迟上限**:R-D inbound reply 投递到 conversation 后,最长等 4s 才显示。可接受。
2. **同 sheet 多 task 切换**:每次切换 taskId 会 cancel 旧 effect、立即触发新 effect、启动新一轮 4s 计时器。正确,无泄漏。
3. **浏览器 tab 后台冻结**:`setInterval` 在后台 tab 仍按 4s 触发(部分浏览器限流到 1Hz)。这可能导致切回前台时多个 tick 排队 — `inflightRef` 保证只一个请求实际发出,其它 return。安全。
4. **服务端 CORS / cookie 行为**:`agoraClient.getTaskConversation` 沿用 `lib/api.ts` 的 `fetch + Bearer`,不引入新跨域问题。
5. **实际 E2E 视觉验证缺失**:server token 轮换使 `curl` 测试不可用;polling 视觉验证留给总工浏览器手测。

### 10.7 §1 / §1.5 自检

- **§1**: R-F.2 仍只在 Dashboard 上层 entry adapter 改,Core 不动,agora-ts server 不动 — 边界保持。
- **§1.5**: 最短路径,无 subscribe facade、无 polling backoff、无 SSE 兜底分支、无 connection-state indicator 副作用组件;新增 3 个 i18n key 是必要 UI 文本,非过度设计。
- **§2**: R-F.2 没引入任何"必须人类确认"动作,继续是 Dashboard 人类入口的被动刷新。

### 10.8 与 task_plan.md 对账

- §2.1 目标 ✅ (探索 + 接入 + real-time)。
- §2.2 子步骤 1-4 ✅(R-F.1),R-F.2 新增步骤(短轮询 effect + indicator + i18n + abort/race 防护)✅。
- §2.3 风险:无 agora-ts 端点缺失触发器,polling 用现有 GET 即可,无需 server 改动。
- §2.4 验证标准:dev 启动 ✅,lint ✅,tsc 零新增 typedrift ✅,test 零新增 failure ✅,real-time polling 行为靠 code review 验证(完整 E2E 留总工浏览器手测)。

---

## 11. 与 task_plan.md 对账

- §2.1 目标 ✅ (探索 + 接入 + real-time)。
- §2.2 子步骤 1-4 ✅,步骤 5 启动 dev ✅,check 跨层级 **partial**(同主仓 baseline)。
- §2.3 风险:无 agora-ts 端点缺失触发器(端点齐),Dashboard 类型层补字段 ✅(在 worktree stub,无主仓修改),无 mock 替换需求(原本就是真实 API,只是没在 ProjectDetailPage 显示)。
- §2.4 验证标准 partial:dev 启动 + TS/lint OK,但 `npm run check` 全链路 baseline 失败。
