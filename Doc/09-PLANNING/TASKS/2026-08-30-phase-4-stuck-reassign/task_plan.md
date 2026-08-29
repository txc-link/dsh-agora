# Task: R7 Phase 4 — v2.1 stuck auto-reassign (2026-08-30)

## 1. 目标

U2 决议 (decisions.md §U2): v2.1 stuck auto-reassign — 复用 v2.0 stuck 检测, 新增 Core 端重派决策层, 走三 posture, 每次决策落 audit。

## 2. 决策引用

- decisions.md §U2: 复用 stuck-alert/stuck-list 检测 + 重派决策层 + 三 posture + audit
- decisions.md §U3=C / §U4=A: posture 语义 + scope 授权
- §1: 重派决策是 Core 编排 (Scheduler/Recovery); adapter 只喂 stuck 信号
- §1.5: 0 overdesign / 最短路径

## 3. 范围

### 必须 (本段)
1. `src/worksite/stuck.ts` (新): StuckSignal / ReassignDecision / decideReassign / ReassignAuditEvent
2. `index.ts` 导出
3. TDD 10 cases
4. task_dir + 设计回写

### 不做
- ❌ 真实调度器重派执行 (Core 端点由 Phase 3.5+ 接; 本段纯决策函数)
- ❌ adapter stuck 检测 (v2.0 已有, 新仓)
- ❌ audit 落盘 (Phase 3.5 store)

## 4. 阶段

1. ✅ worktree (base Phase 3 `cdbd936`)
2. ⏳ task_dir
3. ⏳ TDD stuck.test.ts → 红
4. ⏳ 实施 stuck.ts → 绿
5. ⏳ 全量回归 + build
6. ⏳ commit + push + PR (base feat/phase-3-agent-borrow)

## 5. 验证口径

- stuck.test.ts 10/10
- core 全量 421+10 绿
- build 0 errors
- §1 边界: 无平台名

## 6. 决策语义 (U2)

- Auto (非关键) → auto_reassign
- Strict → needs_confirm (人工确认)
- Dangerous → escalate (不自动 + 升级)
- 无 scopeAuth / 无效信号 → deny
- Auto + delete 权限 → needs_confirm (QM-stricter gate 延续)

## 7. 关联

- v2.0: dsh-matrix-connector/src/stuck-alert.ts (新仓) — 注释明言缺 Core 端点
- Phase 3: borrow.ts / ScopeAuthorization (base 分支 `cdbd936`)
- U2: decisions.md §U2 (master `8df2d88`)
