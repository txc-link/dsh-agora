# T-0 Findings (2026-08-30)

## 1. Phase 1 留的 stub 现状

`WorksiteResolverRegistry` (`packages/core/src/worksite/resolver.ts`) 已实现：
- `register(resolver)` + `has(type)` + `list()` + `resolveWorksite(uri, ctx)`
- 未注册 type → 抛 `WorksiteNotImplementedError`
- resolver 返回 null → 抛 `WorksiteNotFoundError`

Phase 1 留下 5 个 type (thread/commit/watch/workspace/session) 没有 resolver。其中 `thread` 是 matrix 平台主线最先需要的（matrix thread Room auto-create 已在 main 实现）。

## 2. ThreadWorksite 类型契约

`ThreadWorksite extends WorksiteMetadata` (types.ts) — 字段:
- `type: 'thread'`
- `id: string`
- `refs: readonly WorksiteRef[]`
- `uri: string`
- 继承自 WorksiteMetadata: `adapterFields?` + `scopeAuthorization?`

**§1 边界**: platform-specific 字段（room name/topic/member count/lastEventAt）通过 `adapterFields` 暴露，不作为 Core 强类型。Core 只消费 `roomId` (URI 身份) + `scopeAuthorization` (borrow 治理)。

## 3. composition root 缺口 (发现)

`grep "new TaskWorksiteResolver"` 在 apps/ 找不到调用 — **composition root 当前没建 registry 实例 + 注册任何 resolver**。

测试里 registry 是手工 new + register。生产路径上 `resolveWorksite('agora://thread/...')` 即使有 ThreadWorksiteResolver 也**没人调它**。

这是**更大的缺口**，但超出 T-0 范围。T-0 范围 = thread resolver 抽象 + ThreadSourcePort 契约 + 单测。Wiring 进 composition 留给后续段（建议: T-2 R-H 与 P3.5-3a scopeAuthResolver worksite 接入一起做）。

## 4. 设计决策记录

- `ThreadMetadata` interface 放在 `thread-resolver.ts`（同文件，避免 split file overhead）
- `ThreadSourcePort` 暴露 `listRooms()` 即使当前 unused — 为后续 bulk enumeration (T-1.5 Task 绑定扫描) 留 seam
- `toThreadWorksite()` pure mapper 单独 export — 便于 adapter 端直接调用（不走 resolver）
- 测试用 `InMemoryThreadSource` (test-local) — 不污染生产 source code

## 5. TS 严格性 (教训)

第一次写 `Object.freeze([]) as readonly ThreadWorksite['refs']` — TS 1354 错误: `'readonly' type modifier is only permitted on array and tuple literal types`.

修法: `Object.freeze([]) as ThreadWorksite['refs']` — `ThreadWorksite['refs']` 已经是 readonly 数组类型。as 后类型由表达式期望推断，不需要额外 readonly 修饰。