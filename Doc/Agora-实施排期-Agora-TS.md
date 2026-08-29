# 实施排期 SSoT — agora-ts (主仓后端)

**Last updated**: 2026-08-29 (Asia/Shanghai)
**Owner**: 总工
**Repo**: txc-link/dsh-agora (主仓, branch master / develop)
**Phase**: 3 (matrix-connector v0.1.x + 准备 R-E Space / R-F Web Detail)

---

## 1. Status

| Slice | Status | Notes |
|---|---|---|
| 0. SSoT 建立 (本文件) | ✅ done (turn 142) | 治理基础回填 |
| 1. R-A / R-B / R-C / R-D 系列切片 | ✅ done | 见 walkthroughs Doc/10-WALKTHROUGH/ |
| **2. R-D hotfix (60b01a6)** | ✅ **done** | InboxReplyService wiring + auto-bind thread on first reply — SSoT 回写 (本文件 §4) |
| 3. R-E Space 嵌套 | ⏳ scoped to connector (matrix 仓), agora-ts 不动 | 见 matrix SSoT phase 3 |
| 4. R-F thread web 详情面板 | ⏳ scoped to dashboard (主仓前端), agora-ts 不动 | 见 Dashboard SSoT |
| 5. agora-ts 自身大改 | ⏳ not started | 需新建独立 phase 计划 |

**Phase 3 默认原则**：R-E / R-F 严格限定在 connector + dashboard 侧，**agora-ts 这一阶段不主动大改**。仅当 connector / dashboard 侧需要 agora-ts 暴露新能力时，按 §6 流程加 slice。

---

## 2. Architecture Decisions (locked)

| ID | Decision | Reference |
|---|---|---|
| **A1** | 三层口径: IM adapters / Core Orchestrator / Runtime Craftsmen | AGENTS.md §1 |
| **A2** | Core 只表达抽象语义, 平台具体规则不进入 core | AGENTS.md §1 硬约束 |
| **A3** | DSH plugin 不复制核心编排, plugin = slash bridge / live status / 轻量 action | AGENTS.md §2 |
| **A4** | Human 入口唯一 = Dashboard 登录态 | AGENTS.md §2 |
| **A5** | Slack/Discord/Matrix 同等 IM adapter — 不可在 Core 写死任一平台 | AGENTS.md §1 |

**Implementation implications for agora-ts**:
- `packages/core` 只能表达抽象端口与状态机
- 任何 IM/platform 接入 = 独立 adapter 包 (adapters-discord / adapters-cc-connect / ...)
- `apps/server` 与 `apps/cli` = composition root, 不承载业务语义

---

## 3. R-D hotfix 回写 (60b01a6)

**Commit**: `60b01a6 fix(inbox-reply): wire inboxReplyService + auto-bind thread task on first reply`
**Date**: 2026-08-29
**Trigger**: 真实 homeserver + agora-ts server E2E smoke 暴露 2 个 gap

### 3.1 改动文件 (4 个, +92 行)
- `apps/server/src/composition.ts` (+6) — wire `ThreadTaskBindingService`
- `apps/server/src/index.ts` (+1) — `createAppFromRuntime` 传入 `runtime.inboxReplyService`
- `packages/core/src/inbox-reply-service.ts` (+17) — auto-bind thread↔task before insert
- `packages/core/src/inbox-reply-service.test.ts` (+68) — 新增 4 个测试覆盖 auto-bind 路径

### 3.2 两个 gap
1. **composition → buildApp 漏传**: `createAppFromRuntime` 没把 `inboxReplyService` 传给 `buildApp`, reply route 永远 503
2. **首回复未绑定 thread**: adapter 给 opaque threadKey 但 binding row 不存在时, FOREIGN KEY 失败 — 房间首次回复永不绑定

### 3.3 修复策略
- 修 composition wiring (gap 1)
- reply 路径检测 threadKey 无 binding 时, 先调 binding service 创建 binding 再 insert conversation (gap 2) — auto-bind on first reply

### 3.4 验证
- E2E smoke (real homeserver + real agora-ts): matrix reply → ingestMatrixReply → POST reply → conversation entry. PASS
- matrix side walkthrough: `Doc/10-WALKTHROUGH/2026-08-30-shared-work-site-phase-1.md`

---

## 4. Phase 3 Slice Plan

agora-ts 这一阶段不主动开 slice。R-E / R-F 按矩阵仓 SSoT phase 3 + Dashboard SSoT 推进。

**例外流程** (§6): 若 R-E / R-F 在 connector / dashboard 实现过程中发现 agora-ts 缺少必要 REST endpoint / 数据模型, 按 §6 流程补 agora-ts slice。

---

## 5. Cross-references

- **矩阵仓 SSoT**: `.repos/dsh-matrix-connector/Doc/Agora-实施排期-dsh-matrix-connector.md`
- **Dashboard SSoT**: `Doc/Agora-实施排期-Dashboard.md`
- **架构决议 SSoT**: `Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/decisions.md`
- **AGENTS.md §1**: 三层口径与硬约束
- **AGENTS.md §3**: SSoT 与 planning 双向绑定 (本文件 ↔ Doc/09-PLANNING/TASKS/)

---

## 6. 跨切片依赖提交流程 (agora-ts 受外部需求触发时)

1. connector 或 dashboard 仓在 phase X 发现 agora-ts 缺能力
2. 在本仓 master 提 issue-style 记录 (本文件加 §3.X 候选段)
3. 新建 `Doc/09-PLANNING/TASKS/<日期>-agora-ts-<能力名>/{task_plan,findings,progress}.md`
4. 开 worktree `feat/agora-ts-<能力名>`
5. TDD 先行 + 实现 + 测试 + 验证
6. 回写本 SSoT (commit hash + 摘要) + walkthrough

---

## 7. Change Log

- 2026-08-29: agora-ts SSoT 建立 (本文件); 回写 60b01a6 R-D hotfix; R-E / R-F 显式 scope 到 connector + dashboard, agora-ts 不动
