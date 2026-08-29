# Walkthrough — R-F thread web 详情面板 v0.2 (R-F.2 完成)

**Date**: 2026-08-30 (Asia/Shanghai)
**Phase**: 1 (Dashboard 接入 thread 详情面板)
**Branch**: `feat/r-f-thread-web-detail` (worktree `/home/ailink/dsh-agora/.worktrees/r-f-thread-web-detail`)
**Author**: 总工 + R-F.1/R-F.2 实施 subagents
**Status**: R-F ✅ done (R-F.1 + R-F.2 全部完成; 短轮询 4s, lint/tsc/test 全部 baseline 对齐)

---

## 1. TL;DR

R-F 完成 = Dashboard 端 thread 详情面板 + real-time 短轮询：
- **R-F.1** (turn 144): `AgoraClient` facade + `TaskDetailSheet` 共享 conversation body + idle/loading/error/ready 四态 + ProjectDetailPage 四处入口
- **R-F.2** (turn 146): TaskDetailSheet 加 4s 短轮询 + 三层 race 防护 + i18n + 1Hz UI tick indicator
- **§1 boundary 严守**: 全部 dashboard 侧, **agora-ts 完全不动**; 复用电 `lib/api.ts`, 不新建 http stack; 不新增 server 端点

**已知限制 (诚实记账)**: R-F.2 在 sandbox 内尽力验证 (lint/tsc/test/dev/vite transform), polling 行为由 code review 验证 + **真实浏览器 E2E 视觉手测留给生产部署环境** (sandbox 不具备浏览器自动测试能力).

## 2. Files changed (R-F.1 + R-F.2 全量)

### R-F.1 (turn 144)
| File | Type | Purpose |
|---|---|---|
| `dashboard/src/lib/agora-client.ts` | new | `AgoraClient` facade (4 方法) + `AgoraApiError` 品牌 + env/localStorage 双源 |
| `dashboard/src/types/agora.ts` | new | `AgoraThreadBundle` / `AgoraApiError` / config types |
| `dashboard/src/components/task/TaskDetailSheet.tsx` | new | 共享 conversation body; `idle / loading / error / ready` 四态 |
| `dashboard/src/pages/ProjectDetailPage.tsx` | modified (+46/-11) | `openThreadTaskId` state + 四处 task 标题 `Link → button` + `<WorkbenchDetailSheet>` 包 `<TaskDetailSheet>` |
| `dashboard/src/types/task.ts` | modified (+2) | `TaskConversationEntry` 加 `thread_task_binding_id?` |

### R-F.2 (turn 146)
| File | Type | Purpose |
|---|---|---|
| `dashboard/src/components/task/TaskDetailSheet.tsx` | modified (+141/-X) | 加 `POLL_INTERVAL_MS=4000` + `TERMINAL_TASK_STATES` + 两个 useEffect (4s polling + 1Hz UI tick) + `lastUpdatedAt` / `isRefreshing` / `inflightRef` + sheet header refresh indicator |
| `dashboard/src/lib/dashboardCopy.ts` | modified (+3) | `useTasksPageCopy()` 加 `lastUpdated(s)` / `refreshing` / `autoRefresh(s)` 三个返回字段 |
| `dashboard/src/locales/resources.ts` | modified (+6) | `tasks.*` 命名空间下 zh-CN / en-US 各加 3 个 key |
| `Doc/09-PLANNING/TASKS/.../findings.md` | modified (+86) | 加 §10 R-F.2 段 (选型 + 实现 + 防护 + i18n + 限制 + 自检) |
| `Doc/09-PLANNING/TASKS/.../progress.md` | modified (+54) | 头部时间戳 + R-F.2 完整段 |
| `Doc/09-PLANNING/TASKS/.../task_plan.md` | modified (+12) | §1 R-F.2 → done + §2.4 R-F.2 实测块 + Change Log |

`WorkbenchDetailSheet.tsx` 两次都**未改** — 纯 UI shell, thread 数据流归 `TaskDetailSheet`, 符合 §1.5 边界.

## 3. Architecture decisions locked (R-F 全量)

| ID | Decision | Why |
|---|---|---|
| **F1** | thin facade over `lib/api.ts`, 不新建 http stack | §1.5 最短路径; 复用 Zod 校验 + token 解析 |
| **F2** | `TaskDetailSheet` 接 thread 数据, `WorkbenchDetailSheet` 保持纯 UI shell | §1 boundary — shell 容器职责与数据职责分离 |
| **F3** | `AgoraApiError` 品牌化 (暴露 `isUnauthorized/isNotFound/isServerError`) | UI 直接按 status 分支渲染 401/404/500, 不泄漏内部 `ApiError` |
| **F4** | R-F.2 选**短轮询 4s** (非 SSE) | server 当前无 SSE 端点, §1.5 最短路径 |
| **F5** | dashboard 不修 baseline typedrift / React.act 测试债 | §1.5 scope 边界, 记治理债, 不混进 R-F commit |
| **F6** | 不新增 `subscribeThread` 抽象 | §1.5 最短路径 — inline `useEffect + setInterval + AbortController + inflightRef` 已够 |
| **F7** | stale closure 用 effect 依赖 `[shouldPoll, taskId]` 自然解决, 不引入 ref 双重状态源 | 避免双重状态源; 每次 effect 重建自动捕获新 taskId |
| **F8** | 三层 race 防护 (`inflightRef` 重叠防 + `AbortController` 中断 + `cancelled` flag 写入防) | 任一防护失效其他两层兜底 |

## 4. Verification (R-F.1 + R-F.2 全量)

### R-F.1
- `npm run lint` → **PASS**
- `npm run dev` → Vite ready in 433ms, 无 console error
- `npx tsc -b` → 5 errors (自己引入 2 个已修 + 3 个 R-D baseline 债)
- `npm test` → 144 failed / 211 passed (= baseline)
- agora server 实测可达 + 真实 task `OC-1787983990771` (active) 端点全 OK

### R-F.2
- `npm run lint` → **PASS** (i18n: 8 surfaces 全覆盖新 key)
- `npx tsc -b` → **3 errors** = main baseline (R-F.2 **零新增 typedrift**)
- `npm test` → **144 failed / 211 passed / 35 files failed** = main baseline (全部 `React.act is not a function` pre-existing, **R-F.2 零新增**)
- `npm run dev` → VITE v7.3.1 ready in 444ms, 无 console error
- Vite transform 4 个 R-F.2 模块 → 全 HTTP 200 (`TaskDetailSheet.tsx` 34597B, `agora-client.ts` 12255B, `dashboardCopy.ts` 342442B, `resources.ts` 571463B)
- agora `/api/health` → 200 OK
- **真实浏览器 E2E 视觉手测**: **留生产部署环境** (sandbox 不具备浏览器自动测试能力; server token 轮换使 curl E2E 不可达; polling 行为由 code review 验证 cleanup / abort / race 三条路径均有显式实现)

## 5. agora server 端点 (实测, R-F.1 + R-F.2 共用)

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/tasks/:taskId` | 单 task 详情 |
| GET | `/api/tasks/:taskId/status` | status + subtaskExecutions + flow_log + conversation summary |
| GET | `/api/tasks/:id/conversation` | **核心**: conversation entries 列表 (R-F.2 polling target) |
| GET | `/api/tasks/:id/conversation/summary` | summary + unread 计数 (R-F.2 polling target) |
| POST | `/api/tasks/:id/conversation/read` | mark read cursor |
| POST | `/api/tasks/:id/conversation/reply` | R-D inbound reply |
| ... | (9 task actions + 4 bindings) | |
| **无 SSE / WebSocket / event-stream** | — | R-F.2 polling 替代 |

## 6. i18n keys (R-F.2 新增)

| key | 插值 | zh-CN | en-US |
|---|---|---|---|
| `tasks.lastUpdated` | `{{seconds}}` | 最后更新 {{seconds}} 秒前 | Last updated {{seconds}}s ago |
| `tasks.refreshing` | — | 正在刷新会话… | Refreshing conversation… |
| `tasks.autoRefresh` | `{{seconds}}` | 每 {{seconds}} 秒自动刷新 | Auto-refresh every {{seconds}}s |

R-F.1 引入的 `conversationTitle` / `conversationEmpty` / `detailLoadingSummary` / `detailErrorTitle` 全部仍被引用, 未删未动.

## 7. 已知限制 (诚实记账)

1. **Polling 4s 延迟上限** — R-D inbound reply → conversation 显示最长等 4s. Linear/Notion 5s, GitHub 30s, 合规. 如未来要求"通知即推", 需 server 加 `text/event-stream` + Last-Event-ID + token 鉴权, 前端把 `setInterval` 换成 `EventSource`.
2. **浏览器后台 tab** — 部分浏览器把后台 `setInterval` 限流到 1Hz; 切回前台时多个 tick 排队由 `inflightRef` 保证只一个请求实际发出, 其它 return. 无泄漏.
3. **Polling 仅刷新 conversation + conversationSummary**, 不触动 task / subtasks / flow_log, UI 不会因 polling 触发整体 flicker.
4. **真实浏览器 E2E 视觉手测缺失** — sandbox 不具备能力, **留生产部署环境手测**.
5. **不修 baseline** — 3 ts errors + 144 test failures 全部记账为 R-D typedrift 债 + React 19/vitest 互动债, R-F 未触碰.

## 8. Cross-references

- **SSoT**: `Doc/Agora-实施排期-Dashboard.md` (R-F.1 + R-F.2 都 → done)
- **task_dir**: `Doc/09-PLANNING/TASKS/2026-08-30-r-f-thread-web-detail/`
- **v01 walkthrough**: `Doc/10-WALKTHROUGH/2026-08-30-r-f-thread-web-detail-v01.md` (R-F.1 单独记录)
- **agora-ts SSoT**: `Doc/Agora-实施排期-Agora-TS.md` §3.5 (R-D baseline 债, §4 本阶段 agora-ts 不动, **完全不动** ✓)
- **AGENTS.md §1**: dashboard 不动 Core
- **AGENTS.md §2**: Dashboard = 人类入口, 走 REST

## 9. Change Log

- 2026-08-30: R-F.2 walkthrough v02 — TaskDetailSheet 4s 短轮询 + 三层 race 防护 + i18n; R-F phase 1 完整闭环; 浏览器手测留生产
- 2026-08-30: R-F.1 walkthrough v01 — AgoraClient facade + TaskDetailSheet + 真实 thread 数据流 (archived, 历史记录)
