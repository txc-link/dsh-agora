# Walkthrough — R-F thread web 详情面板 v0.1 (R-F.1 完成)

**Date**: 2026-08-30 (Asia/Shanghai)
**Phase**: 1 (Dashboard 接入 thread 详情面板)
**Branch**: `feat/r-f-thread-web-detail` (worktree `/home/ailink/dsh-agora/.worktrees/r-f-thread-web-detail`)
**Author**: 总工 + R-F.1 实施 subagent
**Status**: R-F.1 ✅ done (范围内 100%) / R-F.2 ⏳ next

---

## 1. TL;DR

- **不新建 http stack**：R-F.1 是 `dashboard/src/lib/api.ts` 之上的 thin facade，符合 §1.5 最短路径
- **真实数据流**：现有 `ProjectDetailPage` 已通过 `useProjectStore` 走真实 API（**不是 mock**）；R-F.1 在它基础上挂载 `<TaskDetailSheet>` 接 `getTask + getTaskConversation + getTaskConversationSummary`
- **agora server 端点清单 11 个**（task detail / status / conversation / summary / reply / read / advance / approve / etc.），**无 SSE/WebSocket** — R-F.2 选短轮询 3-5s
- **§1 boundary 严守**：`WorkbenchDetailSheet` 是纯 UI shell 保留通用容器职责，新 `TaskDetailSheet` 接 thread 数据；不引入新矩阵词到 Core
- **诚实 baseline 记录**：R-F.1 启动前主仓 baseline 已 broken (3 ts errors + 144 test failures from R-D 时代遗留 React.act typedrift)，R-F.1 **零新增回归**，baseline 修复**显式记账**为治理债，不在本轮范围内修

## 2. Files changed (未 commit, 总工收口)

| File | Type | 关键改动 |
|---|---|---|
| `dashboard/src/lib/agora-client.ts` | new | `AgoraClient` facade (4 方法) + `AgoraApiError` 品牌 + env/localStorage 双源 baseUrl/token |
| `dashboard/src/types/agora.ts` | new | `AgoraApiError` + `AgoraThreadBundle` + `AgoraClientConfig` + `AgoraFetchOptions` |
| `dashboard/src/components/task/TaskDetailSheet.tsx` | new | 共享 conversation body; `idle / loading / error / ready` 四态; 接 `useTaskStore.selectTask` |
| `dashboard/src/pages/ProjectDetailPage.tsx` | modified (+46/-11) | `openThreadTaskId` state + governance queue / primary task / related tasks / next-up 四处 task 标题 `Link → button` + 末尾 `<WorkbenchDetailSheet>` 包 `<TaskDetailSheet>`,移除无引用 `buildProjectTaskHref` |
| `dashboard/src/types/task.ts` | modified (+2) | `TaskConversationEntry` 加 optional `thread_task_binding_id` (对齐 `@agora-ts/contracts`,`binding_id` 保持 `string` 不放宽) |
| `Doc/09-PLANNING/TASKS/2026-08-30-r-f-thread-web-detail/{findings,progress,task_plan}.md` | new | subagent 已 update 完整 |

`WorkbenchDetailSheet.tsx` **未改** — 它是通用 shell，thread 数据流归 `TaskDetailSheet`，符合 §1.5 边界。

## 3. agora server 端点 (server = Fastify, 源码 `agora-ts/apps/server/src/app.ts`)

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/tasks/:taskId` (L3391) | 单 task 详情 |
| GET | `/api/tasks/:taskId/status` (L3403) | status + subtaskExecutions + flow_log + conversation summary |
| GET | `/api/tasks/:id/conversation` (L5918) | **核心**: conversation entries 列表 |
| GET | `/api/tasks/:id/conversation/summary` (L5931) | summary + unread 计数 (需 human session) |
| POST | `/api/tasks/:id/conversation/read` (L5945) | mark read cursor |
| POST | `/api/tasks/:id/conversation/reply` (L5963) | R-D inbound reply (inboxReplyService 需配) |
| POST | `/api/tasks/:taskId/{advance,approve,reject,archon-approve,archon-reject,confirm,pause,resume,cancel,unblock,subtask-done}` | task actions |
| GET | `/api/tasks/:id/{notifications,context-bindings,participant-bindings,runtime-session-bindings}` | 关联数据 |
| **无 SSE / WebSocket / event-stream** | — | events 落库 + dispatcher 异步推, real-time 必须客户端 polling |

## 4. Agora server 可达性 (实测)

- `http://127.0.0.1:18008/api/health` → `{"status":"ok"}` (root token `4kRczZLEbmf...` 鉴权 OK)
- 实测 task ID **`OC-1787983990771`** (`deploy-verify-23875`, state `active`) — 详情/conversation/summary 端点全 200 OK
- 这一 ID 在 R-F.1 验证时使用

## 5. Architecture decisions locked (R-F.1)

| ID | Decision | Why |
|---|---|---|
| **F1** | thin facade over `lib/api.ts`, 不新建 http stack | §1.5 最短路径; 复用 Zod 校验 + token 解析 |
| **F2** | `TaskDetailSheet` 接 thread 数据, `WorkbenchDetailSheet` 保持纯 UI shell | §1 boundary — shell 容器职责与数据职责分离 |
| **F3** | `AgoraApiError` 品牌化 (暴露 `isUnauthorized/isNotFound/isServerError`) | UI 直接按 status 分支渲染 401/404/500, 不泄漏内部 `ApiError` |
| **F4** | R-F.2 选短轮询 3-5s (非 SSE) | server 当前无 SSE 端点, §1.5 最短路径 |
| **F5** | dashboard 不修 baseline typedrift / React.act 测试债 | §1.5 scope 边界, 记治理债, 不混进 R-F commit |

## 6. Verification (诚实记录)

- `npm run lint` → **PASS** (eslint + design + i18n 全过)
- `npm run dev` → **Vite ready in 433ms, 无 console error**
- `npx tsc -b` → worktree **5 errors** vs main baseline **3 errors**. R-F.1 修复自身 2 errors (返回类型改 `ApiTaskConversationEntryDto` 直接消费 contracts DTO). **剩余 3 errors 与 main 完全相同** (均为 R-D 时代 typedrift: `taskMappers.ts(377)` / `taskMappers.test.ts(165)` / `taskStore.live-api.test.ts(391)`)
- `npm test` → **144 failed / 211 passed** — 与 main 完全相同 (失败均为 `React.act is not a function`, React 19 + vitest pre-existing)
- `npm run build` → FAIL (被 R-D typedrift 阻断, 与 main baseline 同)

**R-F.1 零新增 typedrift / 测试回归**。整体 baseline broken 状态显式记账 (Dashboard SSoT §6)。

## 7. R-F.2 — 接下来做什么

按 subagent 建议：**短轮询 3-5s**。理由：server 无 SSE 端点，§1.5 最短路径。

| Step | File | Outcome |
|---|---|---|
| 1 | `dashboard/src/components/task/TaskDetailSheet.tsx` | `useEffect` + `setInterval` + `setOpenThreadTaskId` 触发 refresh |
| 2 | (可选) `dashboard/src/lib/agora-client.ts` | 新增 `subscribeThread(taskId, onChange): unsubscribe` 抽象 |

不新增 server 端点，不动 agora-ts。

## 8. 已知治理债 (记账不修)

R-F.1 启动前主仓 baseline 已 broken：
- **3 ts errors** in `dashboard/src/{taskMappers,taskMappers.test,taskStore.live-api.test}.ts` — R-D 时代遗留 typedrift
- **144 vitest test failures** — React 19 + vitest `React.act is not a function` 互动 pre-existing

**不在 R-F 范围内修**，按 agora-ts SSoT §6 流程排未来独立 phase (e.g. "Dashboard baseline cleanup")。

## 9. Cross-references

- **SSoT**: `Doc/Agora-实施排期-Dashboard.md` (R-F.1 status 更新 + §6 治理债)
- **task_dir**: `Doc/09-PLANNING/TASKS/2026-08-30-r-f-thread-web-detail/`
- **findings**: `Doc/09-PLANNING/TASKS/2026-08-30-r-f-thread-web-detail/findings.md` (10 段)
- **agora-ts SSoT**: `Doc/Agora-实施排期-Agora-TS.md` §3 (R-D hotfix baseline 债说明)
- **AGENTS.md §1**: dashboard 不动 Core
- **AGENTS.md §2**: Dashboard = 人类入口, 走 REST

## 10. Change Log

- 2026-08-30: R-F.1 walkthrough v01 — AgoraClient facade + TaskDetailSheet + 真实 thread 数据流; baseline 债显式记账; R-F.2 选短轮询
