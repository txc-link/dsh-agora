# R-F thread web 详情面板 — task_plan

**Task**: R-F thread web 详情面板（Dashboard 端接入 agora thread 数据源）
**Date**: 2026-08-30
**Owner**: 总工
**Repo**: txc-link/dsh-agora (主仓 dashboard/)
**Worktree**: `/home/ailink/dsh-agora/.worktrees/r-f-thread-web-detail`
**Branch**: `feat/r-f-thread-web-detail` (from master `5927250`)
**SSoT**: `Doc/Agora-实施排期-Dashboard.md` (phase 1)
**agora-ts SSoT 联动**: `Doc/Agora-实施排期-Agora-TS.md` §4 (本阶段 agora-ts 不动)

---

## 1. 总工排期 (4 轮 + 2 治理债)

| 轮 | 范围 | worktree | 状态 |
|---|---|---|---|
| R-F.1 | dashboard thread 数据接入详情面板 | 本 worktree | ⏳ in_progress |
| R-F.2 | real-time updates + E2E | 本 worktree | ⏳ blocked on R-F.1 |
| R-E.1 | SDK Space API 验证 + adapter | matrix 仓 `.worktrees/r-e-space-nesting` | ⏳ in_progress (并行) |
| R-E.2 | Space 实装 + 冒烟 | 同 R-E.1 | ⏳ blocked on R-E.1 |
| 治理债1 | agora-ts SSoT 新建 + 60b01a6 回写 | 主仓 master/develop | ✅ done (turn 142) |
| 治理债2 | matrix SSoT phase 3 + dashboard SSoT 新建 | matrix main/develop + 主仓 develop | ✅ done (turn 142) |

---

## 2. R-F.1 详细计划

### 2.1 目标
- 探索 dashboard 现有详情面板数据流 (`WorkbenchDetailSheet.tsx` / `ProjectDetailPage.tsx`)
- 确认 agora server 当前提供的 thread / conversation REST 端点
- 设计 Dashboard 端 thread 数据 fetch 层 (REST client wrapper)
- 实现详情面板消费真实 agora thread 数据 (替换可能的 mock)
- 一轮端到端验证: Dashboard dev server 起来 + 真实 API 调用一次

### 2.2 子步骤
1. 读 `dashboard/src/pages/ProjectDetailPage.tsx` 与 `dashboard/src/components/ui/WorkbenchDetailSheet.tsx`
2. 查 agora server (apps/server) 已有的 thread / conversation API 端点
3. 在 dashboard/src/lib/ 加 agora API client (REST wrapper, 现有 httpClient 复用?)
4. 改详情面板接入真实数据 + 加载/错误状态
5. Dashboard dev 启动 + `npm run check` + 端到端 curl 验证

### 2.3 风险
- agora server 当前端点可能不返回足够 thread 上下文 → 触发 agora-ts SSoT §6 流程补端点
- Dashboard 现有详情面板可能绑死内部 mock → 需要拆 mock 替真实 API
- Dashboard 类型层可能需要 @agora-ts/contracts 增字段

### 2.4 验证标准

> **R-F.1 实测结果(2026-08-29)**:
> - Dashboard dev 启动:`vite ready in 433ms`,无 console error;关键模块 `main.tsx` / `pages/ProjectDetailPage.tsx` / `components/task/TaskDetailSheet.tsx` 经 `curl localhost:5173/dashboard/src/...` 均 200 OK,vite transform 无错。
> - `npx tsc -b`: R-F.1 **0 新增 typedrift**。worktree 5 errors = main baseline 3 errors + 我修过的 2 errors(已修)。剩余 3 errors 与 main 完全相同,均为 R-D typedrift(`taskMappers.ts(377)`、`taskMappers.test.ts(165)`、`taskStore.live-api.test.ts(391)`)。
> - `npm run lint`: **PASS**(eslint + design + i18n 三段全过)。
> - `npm run build`: FAIL — 同 main baseline(tsc errors 阻断,R-F.1 不承担此债)。
> - `npm test`: 144 failed / 211 passed — 与 main baseline 完全相同(失败为 `React.act is not a function`,React 19 + vitest 互动 pre-existing)。
> - agora server e2e: `GET /api/tasks` + `GET /api/tasks/OC-1787983990771` + `GET /api/tasks/OC-1787983990771/conversation` 全部 200 OK,token 鉴权正常。R-F.1 数据流链路与 TasksPage 现网路径同 store,等价。
> - 加载/空/错误三态:`TaskDetailSheet` 实现 `idle | loading | error | ready` 四态,error 状态下 brand 化 `AgoraApiError.isUnauthorized/isNotFound/isServerError`。
> - **整体 `npm run check` 不能声明 pass**(baseline 已是 broken),R-F.1 范围内零新增回归。
> - **绝对诚实**: 主仓 `npm run check` 在 R-F.1 启动前就 broken(3 ts errors + 144 test failures),R-F.1 没有引入这些,也没有修复它们的授权。
- Dashboard dev 启动无 TS / lint 错误
- 详情面板打开显示真实 agora thread 数据 (来自本地 agora server, 端口 18008)
- 加载/空/错误三态正常

---

## 3. 文件 / 交付物

### R-F.1 预期文件
- `dashboard/src/lib/agora-client.ts` (新, 或扩现有)
- `dashboard/src/pages/ProjectDetailPage.tsx` (改, 消费 agora thread API)
- `dashboard/src/components/ui/WorkbenchDetailSheet.tsx` (改)
- `dashboard/src/types/agora.ts` (增 thread / conversation 类型)
- `Doc/09-PLANNING/TASKS/2026-08-30-r-f-thread-web-detail/findings.md` (现有面板数据流调研)
- `Doc/09-PLANNING/TASKS/2026-08-30-r-f-thread-web-detail/progress.md` (R-F.1 状态)

---

## 4. 与其他排期 / 任务的依赖

- **agora-ts SSoT**: 本阶段 agora-ts 不动; 但 R-F.1 若发现 thread 端点缺失, 触发 agora-ts §6 流程
- **R-E**: 独立并行, 不依赖
- **R-D walkthrough**: shared-work-site-phase-1 已演示 thread 端到端, 端点参考

---

## 5. Change Log

- 2026-08-30: R-F task_plan 建立; 总工排期 (R-F 2 轮 + R-E 2 轮 + 治理债 2 项)
- 2026-08-30: 路径从 docs/ 修正为 Doc/ (主仓 .gitignore 排除 /docs, 与 matrix 仓 Doc/ 约定一致)
- 2026-08-29 (R-F.1 close): R-F.1 完成。新增 `lib/agora-client.ts` + `types/agora.ts` + `components/task/TaskDetailSheet.tsx`;改 `pages/ProjectDetailPage.tsx` + `types/task.ts`。dev server ready,lint pass,tsc 零新增 typedrift。`npm run check` 整体仍 fail(主仓 baseline pre-existing R-D typedrift + React.act 测试债)。详见 `findings.md` + `progress.md` + §2.4 实测记录。
