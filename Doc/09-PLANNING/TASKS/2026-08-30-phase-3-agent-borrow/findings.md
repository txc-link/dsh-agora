# Findings: R6 Phase 3 — Agent borrow + 3-posture + scope-authorization (2026-08-30)

## 1. 决策引用 (SSoT)

- **U3=C** (QM 三 posture + audit trail + gate 保留): decisions.md §U3
  - Strict: 每个 harness tool call 暂停请求人类批准
  - Auto: classifier 屏幕 provenance-labeled 外部文本 + tool results (QM default)
  - Dangerous: 移除 content screening, tool calls 之间暂停
- **U4=A** (ACL 跟 scope + posture 一起做): decisions.md §U4
- **U1=A** (单 scheme agora://<type>/<id>): decisions.md §U1

## 2. 现状调研 (develop `551fa53`)

- `agora-ts/packages/core/src/worksite/`: Phase 1 merged — types.ts (6 类型 union + WorksiteMetadata.adapterFields) / uri.ts / resolver.ts / task-resolver.ts / index.ts
- 测试: vitest (`agora-ts/package.json test = vitest run`)
- WorksiteMetadata 目前只有 `adapterFields` (adapter 提示, 非 Core 决策)
- **无** scope-authorization / borrow / posture 概念 (Phase 3 全新)
- monorepo: npm workspaces (apps/*, packages/*); core 依赖 @agora-ts/contracts + @agora-ts/db + qdrant

## 3. 设计要点 (总工 §1.5)

### 3.1 scope-authorization 字段 (WorkSite 层)

- 每个 WorkSite 绑定一个 scope 授权: `scope` (URI 前缀) + `posture` + `permissions` (read/write/delete/execute)
- 放 WorksiteMetadata 可选字段 (6 类型共享, 不破坏现有 shape)
- Core 只表达 scope 抽象, 不编码平台 (§1): scope 是 URI 前缀字符串, 无平台名

### 3.2 Borrow 模型 (Core 编排语义)

- BorrowRequest: actor / targetUri / scope / permissions / posture / ttl / reason / status
- BorrowDecision: 三 posture 决策 — grant (Auto) / needs_confirm (Strict) / needs_dual (Dangerous)
- 决策纯函数 (无 IO), store 属 Phase 3.5
- Auto 必须比 QM 更严格 (decisions §U3 Phase 3.5 gate): delete/prod/privacy 不可走 Auto

### 3.3 边界 (本段不做)

- Dashboard 人类批准 (Phase 3.5, Entry Surface §2)
- borrow store 持久化 (Phase 3.5)
- kill switch (Phase 3.5)
- matrix-connector adapter (新仓独立)

## 4. 测试方案 (TDD 10 cases)

1. scope-authorization: WorkSite 类型接受 scopeAuthorization 字段
2. scope-authorization: 缺省无 scopeAuthorization → 无授权
3. borrow: Auto posture + 非关键权限 → grant
4. borrow: Auto posture + delete 权限 → 升级 Strict (needs_confirm)
5. borrow: Strict posture → needs_confirm
6. borrow: Dangerous posture → needs_dual (dualApproval)
7. borrow: ttl 过期 → deny
8. borrow: permissions 超出 scope 授权 → deny
9. resolver: resolveScopeAuthorization(uri) 返回绑定 scope (一次查完, U4=A)
10. resolver: 无 scope 授权 → 默认 Strict (fail-safe)

## 5. 关联

- Phase 1: agora-ts/packages/core/src/worksite/ (develop `551fa53`)
- decisions.md U3=C / U4=A (master `8df2d88`)
- R5 U2=v2.1 (Phase 4, master `8df2d88`)
- QM 调研: Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/02-qm.md
