# Phase 3 Design: Agent Borrow + Three-Posture Governance + scope-authorization

> 来源: turn 104 8 轮计划 R6 + decisions.md U3=C/U4=A + QM 调研 (02-qm.md) + 总工 §1.5 first-principles
> 日期: 2026-08-30
> 参与者: 总工 (agent), 用户 (turn 104 完全授权 / turn 108 "有问题找总工,不必找我")

## 0. 摘要

Phase 3 把 turn 25 "受控" 关键词落成 Core 语义: 任何 agent 借用 (borrow) 另一个 agent/工作区的执行权, 都必须带 **scope 授权** (WorkSite 字段) + **三 posture** (Strict/Auto/Dangerous) + **audit trail**, ACL 跟 scope 一次查完 (U4=A)。

本设计分两段:
- **Phase 3 (本段)**: Core 抽象 — borrow 模型 + posture 决策函数 + WorkSite scope-authorization 字段 + resolver 查询
- **Phase 3.5 (后续)**: Dashboard 人类批准入口 + borrow store 持久化 + kill switch + governance gate

## 1. 已确认设计

### 1.1 WorkSite `scope-authorization` 字段

所有 6 类型 WorkSite 共享可选字段:

```ts
export interface ScopeAuthorization {
  readonly scope: string;            // URI 前缀, e.g. 'agora://workspace/repoA'
  readonly posture: Posture;         // 'Strict' | 'Auto' | 'Dangerous'
  readonly permissions: readonly Permission[];  // 'read' | 'write' | 'delete' | 'execute'
}
```

- 放 `WorksiteMetadata` (与 adapterFields 同级, 可选)
- Core 只表达 scope 抽象 (URI 前缀), 不编码平台名 (§1)
- 缺省 = 无授权 → 决策函数 fail-safe 到 Strict

### 1.2 Borrow 模型 (Core 编排语义)

```ts
export interface BorrowRequest {
  readonly actor: string;          // 借用方, e.g. 'agent:matrix-bridge'
  readonly target: string;         // 目标 work site URI
  readonly scope: string;          // 请求的 scope (必须 ⊆ scope 授权)
  readonly permissions: readonly Permission[];
  readonly posture: Posture;       // 请求 posture
  readonly ttlMs: number;          // 借用有效期
  readonly reason: string;         // 动机 (审计)
}

export type BorrowDecision =
  | { readonly outcome: 'grant' }
  | { readonly outcome: 'needs_confirm' }   // Strict: 人类单次确认
  | { readonly outcome: 'needs_dual' }      // Dangerous: 双人确认
  | { readonly outcome: 'deny'; readonly reason: string };
```

决策函数 `decideBorrow(req, scopeAuth)` 纯函数:
1. 无 scopeAuth → deny (fail-safe)
2. ttl ≤ 0 → deny
3. 请求 permissions ⊄ scopeAuth.permissions → deny
4. **Auto + delete/prod/privacy → 升级 needs_confirm** (比 QM 严格, decisions §U3 gate)
5. Dangerous → needs_dual
6. Strict → needs_confirm
7. Auto → grant

### 1.3 Resolver 集成 (U4=A)

- `resolveScopeAuthorization(uri)` 一次查完 scope + ACL (resolver 层)
- 无 scope 授权 → 返回 undefined → 决策 fail-safe Strict

### 1.4 边界

- 人类批准入口: Dashboard (Phase 3.5, Entry Surface §2 禁止伪造 reviewer_id)
- store: Phase 3.5
- kill switch: Phase 3.5

## 2. 未决事项 (undecided)

- kill switch 粒度 (by node / by task / by user) 实现时机
- org-level vs scope-level posture 双层合并规则
- Auto classifier 具体实现 (QM 启发, 不照搬)
- borrow 的 ttl 默认值策略
- Phase 3.5 是否走独立 PR

## 3. 实施计划 (本段)

1. `types.ts`: + ScopeAuthorization + Permission type
2. `borrow.ts` (新): BorrowRequest / BorrowDecision / decideBorrow
3. `resolver.ts`: + resolveScopeAuthorization
4. `index.ts`: 导出
5. TDD 10 cases (见 task_plan §4)
