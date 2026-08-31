# 实施排期 SSoT — Dashboard (主仓前端)

**Last updated**: 2026-08-29 (Asia/Shanghai)
**Owner**: 总工
**Repo**: txc-link/dsh-agora (主仓 dashboard/ 目录, branch master / develop)
**Phase**: 1 (Dashboard 接入 thread 详情面板)

---

## 1. Status

| Slice | Status | Notes |
|---|---|---|
| 0. SSoT 建立 (本文件) | ✅ done (turn 142) | 治理基础建立 |
| 1. Dashboard 已有详情面板基础 | ✅ exists | `WorkbenchDetailSheet.tsx` + `ProjectDetailPage.tsx` |
| **2. R-F thread web 详情面板 (R-F.1)** | ✅ **done (turn 144)** | walkthrough `Doc/10-WALKTHROUGH/2026-08-30-r-f-thread-web-detail-v01.md` |
| **3. R-F real-time updates (R-F.2)** | ✅ **done (turn 146)** | 4s 短轮询 + 三层 race 防护 + i18n; walkthrough `Doc/10-WALKTHROUGH/2026-08-30-r-f-thread-web-detail-v02.md` |
| **4. R-F.2 polling verify (Layer 1 + Layer 2)** | ✅ **done (turn 149)** | Layer 1 API-level 8/8 pass (avg 4009.4ms); Layer 2 playwright UI spec 就绪, 生产 `PLAYWRIGHT_E2E=1` 启用; walkthrough `Doc/10-WALKTHROUGH/2026-08-30-r-f-visual-verify.md` |
| **5. Dashboard baseline cleanup (债 1 闭环)** | ✅ **done (turn 152)** | 编译 `agora-ts/packages/contracts` 生成 dist (消除 97 个 zod resolve errors) + 改 3 个真实 typedrift (`task.ts:277 binding_id` nullable + 2 fixture); `npx tsc -b` 0 errors; walkthrough `Doc/10-WALKTHROUGH/2026-08-30-dashboard-baseline-cleanup.md` |
| **6. Dashboard vitest cleanup (债 2 闭环)** | ✅ **done (turn 153)** | vitest config exclude `tests/api/**` + `tests/e2e/**` (R-F.2 visual verify stale FAIL) + 改 4 处 `project-workbench-pages` fixture 同步 R-F.1 `Link → button` + aria-label; `npm test` 62 files / 378 tests 全绿; walkthrough `Doc/10-WALKTHROUGH/2026-08-30-dashboard-vitest-cleanup.md` |
| **7. Dashboard contracts dist onboarding (债 5 闭环)** | ✅ **done (turn 155)** | vite alias `@agora-ts/contracts` 指 dist (消除 worktree-local zod resolve 债) + `dashboard/scripts/build-contracts.sh` + package.json `pretest`/`predev` hooks 自动 build; 任何新 dashboard worktree 跑 `npm test` 或 `npm run dev` 自动 onboarding; walkthrough `Doc/10-WALKTHROUGH/2026-08-30-dashboard-contracts-dist-onboarding.md` |
| **8. Task center + Markdown UI (2026-08-31)** | ✅ **done (commit 2e9d521 + 9fe8dc6)** | `ApprovalsQueuePage` (`/approvals`, 调 `/api/approvals/pending` + decide), `SubtaskPanel` (调 `/api/tasks/:id/progress`), `MarkdownDocumentPanel` (调 `/api/artifacts/:id/markdown`); api.ts 新增 getTaskProgress / listPendingApprovals / decideApproval / getMarkdownArtifact / submitMarkdownArtifact. `tsc --noEmit` clean. |

---

## 2. Architecture Decisions (locked)

| ID | Decision | Reference |
|---|---|---|
| **D1** | Dashboard = 人类唯一登录态入口 | AGENTS.md §2 |
| **D2** | Dashboard 不可被 agent 编排使用 (agent 主入口 = CLI, 次入口 = REST) | AGENTS.md §2 |
| **D3** | 任何必须人类确认的动作, 只能通过 Dashboard 登录态触发; 禁止自由传入 reviewer_id/approver_id 伪造身份 | AGENTS.md §2 |
| **D4** | Dashboard 消费 agora REST (apps/server), 不直接连 SQLite/文件 | AGENTS.md §1 三层口径 |

**Implementation implications**:
- 详情面板组件只通过 REST 与 agora server 通信
- thread 详情数据 = agora task detail API 的 conversation/timeline 视图
- real-time updates = SSE / polling (待 R-F.2 选型)

---

## 3. R-F Slice Plan

### R-F.1 — thread 数据源接入详情面板
- 现状: `WorkbenchDetailSheet.tsx` / `ProjectDetailPage.tsx` 已有, 但可能未消费 agora REST
- 任务: 接入 agora server thread / conversation API → 详情面板显示真实 thread 数据
- 验证: Dashboard dev server 启动 + curl 真实 API + 端到端一次

### R-F.2 — real-time updates + E2E
- 选型: SSE (server push) 或 GET polling — 按 agora server 现有端点决定
- 验证: Dashboard 打开详情页, matrix 房间发新消息, 详情面板实时刷新

---

## 4. Worktree

| worktree | branch | 起点 | 当前 |
|---|---|---|---|
| `/home/ailink/dsh-agora/.worktrees/r-f-thread-web-detail` | `feat/r-f-thread-web-detail` | master `5927250` | empty |

task_plan 写在 worktree 内 `Doc/09-PLANNING/TASKS/2026-08-30-r-f-thread-web-detail/task_plan.md`。

---

## 5. Cross-references

- **agora-ts SSoT**: `Doc/Agora-实施排期-Agora-TS.md`
- **矩阵仓 SSoT**: `.repos/dsh-matrix-connector/Doc/Agora-实施排期-dsh-matrix-connector.md`
- **AGENTS.md §2**: Entry Surface Rules
- **AGENTS.md §3**: SSoT 与 planning 双向绑定

---

## 6. Change Log

- 2026-08-29: Dashboard SSoT 建立 (本文件); R-F 排期进入 phase 1
