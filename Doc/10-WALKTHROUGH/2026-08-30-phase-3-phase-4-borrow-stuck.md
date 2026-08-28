# Walkthrough: Phase 3 (Agent Borrow + Three-Posture) + Phase 4 (v2.1 Stuck Auto-Reassign)

> 回写日期: 2026-08-30
> 来源: turn 104 8 轮计划 R6/R7 + turn 108 用户 "有问题找总工,不必找我,务必确保任务一直向前推进"
> 决策 SSoT: Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/decisions.md (U2/U3=C/U4=A)

## 1. Phase 3 — Agent Borrow + Three-Posture Governance (R6, PR#5)

### 目标
把 turn 25 "受控" 落成 Core 语义: agent 借用执行权必须带 scope 授权 + 三 posture + ACL 一起 (U3=C / U4=A)。

### 变更 (agora-ts/packages/core/src/worksite/)
- `types.ts`: `Posture` / `Permission` / `ScopeAuthorization` + `WorksiteMetadata.scopeAuthorization` (6 类型共享)
- `borrow.ts` (新): `BorrowRequest` / `BorrowDecision` / `decideBorrow` — fail-safe 顺序
- `resolver.ts`: `resolveScopeAuthorization` (U4=A: ACL 跟 scope 一次查完)
- `index.ts`: 导出

### 决策语义
- 无 scopeAuth / ttl 过期 / scope 越界 / 权限越权 → deny
- Dangerous → needs_dual / Strict → needs_confirm / Auto → grant
- **Auto + delete → needs_confirm** (比 QM 严格, decisions §U3 gate)

### 验证
- borrow.test.ts 12/12; core 421/421; build exit 0

### 边界 (Phase 3.5)
- Dashboard 人类批准 / borrow store / kill switch — 未决事项见设计文档

## 2. Phase 4 — v2.1 Stuck Auto-Reassign (R7, PR#6)

### 目标
U2 决议: 复用 v2.0 stuck 检测 (新仓 stuck-alert), 新增 Core 端重派决策层, 三 posture, 每次决策落 audit。

### 变更 (agora-ts/packages/core/src/worksite/)
- `stuck.ts` (新): `StuckSignal` / `ReassignDecision` / `ReassignAuditEvent` / `decideReassign`

### 决策语义
- Auto → auto_reassign / Strict → needs_confirm / Dangerous → escalate (永不自动)
- 无 scopeAuth / 空 taskId / idleMs<=0 / 未知 executor → deny (fail-safe)
- 每次决策返回 audit event (ts/taskId/posture/outcome/actor/reason)

### 验证
- stuck.test.ts 10/10; core 431/431; build exit 0

### 边界
- 纯决策函数; 调度器执行 + audit 落盘属 Phase 3.5+/adapter

## 3. 全链状态 (turn 110 结束时)

| 轮 | 交付 | 状态 |
|---|---|---|
| R1 | decisions.md U1=A/U3=C/U4=A | ✅ master `61684ca` |
| R2 | hygiene commit (50 files) | ✅ master `61684ca` |
| R3 | 3 PR (matrix#1, agora#3, agora#4) | ✅ OPEN |
| R4 | matrix Room auto-create (12 tests) | ✅ matrix PR#2 |
| R5 | U2 = v2.1 stuck auto-reassign | ✅ master `8df2d88` |
| R6 | Phase 3 borrow + posture (12 tests) | ✅ agora PR#5 |
| R7 | Phase 4 stuck reassign (10 tests) | ✅ agora PR#6 |
| R8 | 本文件 + worktree 清理 | ✅ |

### PR 链 (等 review)
- txc-link/dsh-matrix-connector#1 (Phase 2) → #2 (R4)
- txc-link/dsh-agora#3 (walkthrough mirror) / #4 (Slice 6 cordis)
- txc-link/dsh-agora#5 (Phase 3) → #6 (Phase 4)

## 4. 未决 (后续轮)
- PR review/merge (用户)
- Phase 3.5: Dashboard 批准 + store + kill switch
- Discord smoke (user dev machine)
- v2.1 调度器真实接入 (adapter 喂 stuck 信号 → Core 决策 → 执行重派)
- npm publish dsh-matrix-connector (待用户决定)
