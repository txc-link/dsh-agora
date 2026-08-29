# T-2 Findings (2026-08-30)

## 1. turn 119 §3 "接而不入" 债的偿还

R-A T-0 thread WorkSite resolver 提交时 (turn 119):
- 加 `WorksiteResolverRegistry` class + interface ✓
- 加 `TaskWorksiteResolver` ✓ (但只注册在 tests)
- 加 `ThreadWorksiteResolver` ✓
- 加 `WorksiteNotImplementedError` / `WorksiteNotFoundError` ✓

**漏掉**：
- composition root 没真 instantiate `WorksiteResolverRegistry`
- `TaskWorksiteResolver` / `ThreadWorksiteResolver` 没在 composition 注册
- `BorrowService.scopeAuthResolver` 仍走 `() => scopeAuthorizationFromEnv(process.env)` — **target 参数被忽略**

本 PR 修这三件事。

## 2. scopeAuthorization 设计决策

### 2.1 同步 vs 异步

`BorrowService.scopeAuthResolver` 是 `(target: string) => ScopeAuthorization | undefined` (同步). `WorksiteResolverRegistry.resolveWorksite` 是 `async` (返回 Promise).

折衷：composition 不用 registry 真做 resolve（避免 async 链路），而是直接 `taskRepo.getTask + deriveScopeAuthorization`. registry 真实例化 + register 让 Phase 2 接入 thread resolver 时无缝替换。

**这是有意的两层设计**：
- composition 创建 registry + register (供未来 thread / R-C-2 接入)
- borrow path 用 sync shortcut (不引入 async 链路到 borrow CLI)

未来 R-C-2 接入 ThreadWorksiteResolver 时，`resolve` 函数加 `parsed.type === 'thread'` 分支，从 `ThreadSourcePort.getThreadMetadata(roomId).scopeAuthorization` 同步读（已有 turn 119 thread-resolver.ts 设计）。

### 2.2 Phase 1 默认策略：保守

```
posture = 'Auto'      # borrow 不需人工确认 (P3.5-3 已是默认)
permissions = [read, execute]  # 无 write/delete (留 Phase 2 ACL)
scope = agora://task/<id>       # worksite URI 作为 scope
```

理由：
- §1.5 最短路径：Phase 1 给最少能用的权限 (read + execute)，ACL 留给 Phase 2
- 让 borrow 命令**立刻可用**而不是 deny-all（用户今晚就能在自建 homeserver 跑通真 borrow）
- Phase 2 接 matrix ACL / dashboard approval 时只换 `deriveScopeAuthorization` 实现，签名不变

### 2.3 §1 compliance

`scope-auth-policy.ts` 只 import `@agora-ts/contracts` TaskRecord + 同包 types/uri. **零 matrix / discord / platform 知识**. derive 函数纯数学.

`toTaskWorksite` 现在传 scopeAuthorization，但 Phase 1 仅 task. ThreadWorksiteResolver 的 scopeAuthorization 字段已存在 (turn 119)，R-C-2 会从 matrix adapter 注入。

## 3. composition 改动细节

- `scopeAuthorizationFromEnv()` 函数**保留**（stub path 还存在）— 不删，避免破坏 test doubles 可能引用的 path
- 新增 `makeWorksiteScopeAuthResolver(db)` — 包含 registry 实例化 + register + sync resolver factory
- `createBorrowService` factory 从 `(context) => new BorrowService({ borrowRepo, scopeAuthResolver: () => scopeAuthorizationFromEnv(process.env) })` 改成 `(context) => new BorrowService({ borrowRepo, scopeAuthResolver: makeWorksiteScopeAuthResolver(context.db) })`

**关键**：registry 实例化但**未立即使用**做 lookup — `void registry` 防止 TS6133. 是设计上的预留，不是 dead code.

## 4. 测试覆盖

| test file | cases | 覆盖 |
|---|---|---|
| `scope-auth-policy.test.ts` | 4 | derive pure function (scope/posture/permissions/frozen) |
| `worksite-scope-auth-integration.test.ts` | 4 | registry register / duplicate guard / thread can register / composition pattern with real taskRepo |

## 5. TypeScript strict 教训

- `Parameters<typeof TaskRepository>[0]` 是 constructor signature，不直接 compatible `(...args: any) => any`. 改用直接 `AgoraDatabase` type 更简单。
- `ScopeAuthorization` 在 `@agora-ts/core` 已有 export，composition.ts line 121 已 import — 我新加的 import 制造 duplicate。删除新加的，让 line 121 提供 type.

## 6. 文件清单

| 文件 | 角色 |
|---|---|
| `packages/core/src/worksite/scope-auth-policy.ts` | **新增** derive pure function |
| `packages/core/src/worksite/scope-auth-policy.test.ts` | **新增** 4 tests |
| `packages/core/src/worksite/task-resolver.ts` | toTaskWorksite 注入 scopeAuthorization |
| `packages/core/src/worksite/worksite-scope-auth-integration.test.ts` | **新增** 4 integration tests |
| `packages/core/src/index.ts` | +7 exports (WorksiteResolverRegistry 等) |
| `apps/cli/src/composition.ts` | +makeWorksiteScopeAuthResolver helper,替换 stub |

## 7. 未决 (留后续段)

- ❌ ThreadWorksiteResolver 注册到 composition (R-C-2 推 thread scope auth)
- ❌ 真实 matrix ACL 注入 (Phase 2)
- ❌ write/delete permission 开关 (Phase 2)
- ❌ kill switch `agora-ts borrow revoke` (P3.5-3b)
- ❌ Dashboard human approval 入口 (separate frontend)
- ❌ borrow CLI E2E 在沙箱不能完整跑 (EROFS 写 ~/.agora/skills/*)
  - dev machine E2E: `agora-ts borrow create --actor agent:matrix-bridge --target agora://task/T-1 --scope agora://task/T-1 --permissions read,execute --reason "smoke"` 应该直接 grant (不再 env 依赖)