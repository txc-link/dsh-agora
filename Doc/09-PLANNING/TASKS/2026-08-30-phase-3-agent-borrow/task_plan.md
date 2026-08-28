# Task: R6 Phase 3 — Agent borrow + 3-posture governance + scope-authorization (2026-08-30)

## 1. 目标

按 decisions.md U3=C / U4=A 落 Phase 3 第一段：Core 层 Agent borrow 模型 + 三 posture 治理 + WorkSite `scope-authorization` 字段。Dashboard 人类批准入口属 Phase 3.5（Entry Surface §2），本段只落 Core 抽象与决策函数。

## 2. 决策引用 (SSoT)

- decisions.md §U3 (三 posture + audit + gate 保留): 见 Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/decisions.md
- decisions.md §U4 (ACL 跟 scope 一起): 同上
- §1 Core Constitution: WorkSite 是 Core 抽象, 不编码平台细节; borrow 是 Core 编排语义
- §1.5: 0 overdesign, 0 compat, 0 fallback, 最短路径
- §3 Mandatory Planning Loop + Worktree First: 本 worktree `feat/phase-3-agent-borrow` (from origin/develop `551fa53`)
- §4 TDD: red → green

## 3. 范围

### 必须 (本段)
1. **WorkSite 扩 `scope-authorization` 字段** — WorksiteMetadata.scopeAuthorization (scope / posture / permissions), 所有 6 类型共享
2. **Borrow 模型** — `src/worksite/borrow.ts`: BorrowRequest / BorrowDecision, 三 posture 决策函数
3. **Resolver 集成** — resolveScopeAuthorization 查询 (ACL 跟 scope 一次查完, U4=A)
4. **TDD** — 8-12 cases: borrow 决策 (Strict/Auto/Dangerous) + scope-authorization 校验 + resolver 查询
5. **设计文档** — Doc/03-ARCHITECTURE/2026-08-30-phase-3-agent-borrow/ (讨论落地 §3)

### 不做 (本段)
- ❌ Dashboard 人类批准 UI (Phase 3.5, Entry Surface §2)
- ❌ borrow 持久化 store (本段决策函数纯函数; store 是 Phase 3.5)
- ❌ kill switch 实现 (Phase 3.5 gate)
- ❌ matrix-connector 侧改动 (新仓独立)

## 4. 阶段

1. ✅ 开 worktree (turn 110 step 54)
2. ⏳ task_dir 三件套 (本文件 + findings + progress)
3. ⏳ 设计文档 Doc/03-ARCHITECTURE/2026-08-30-phase-3-agent-borrow/
4. ⏳ TDD: tests/worksite/borrow.test.ts 先写 (8-12 cases)
5. ⏳ 跑测试 → 红
6. ⏳ 实施: types.ts + borrow.ts + resolver.ts
7. ⏳ 跑测试 → 绿 + 全量回归
8. ⏳ commit + push + PR (base develop)

## 5. 验证口径

- borrow 决策 8-12 cases 全绿
- 既有 worksite 测试 (uri/resolver) 全绿
- agora-ts 全量测试通过
- tsc build 0 errors
- §1 边界: 无平台名硬编码

## 6. worktree / 分支

- worktree: `/home/ailink/dsh-agora/.worktrees/feat-phase-3-agent-borrow/`
- branch: `feat/phase-3-agent-borrow` (tracking origin/develop)
- base: `551fa53` (Phase 1 merged)

## 7. 关联

- Phase 1: agora-ts/packages/core/src/worksite/ (merged develop)
- R1 decisions.md U3=C / U4=A (master `8df2d88`)
- R5 U2=v2.1 (Phase 4 真项目, master `8df2d88`)
