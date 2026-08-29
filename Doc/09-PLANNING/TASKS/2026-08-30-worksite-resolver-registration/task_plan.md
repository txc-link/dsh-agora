# Task: T-2 worksite resolver composition wiring (2026-08-30)

## 1. 目标

把 R-A T-0 (thread WorkSite resolver) + Phase 1 task resolver 的**接而不入**债还上: composition root 真 instantiate `WorksiteResolverRegistry` + 注册 `TaskWorksiteResolver`, 并把 `BorrowService.scopeAuthResolver` 从 env stub 换成走 worksite registry 的真实 lookup.

闭环现有 P3.5-2 borrow CLI — 用户不再需要手设 `AGORA_BORROW_SCOPE` / `AGORA_BORROW_POSTURE` / `AGORA_BORROW_PERMISSIONS` 三个 env var, scope authorization 自动从 task 推导.

## 2. 范围

### 必须 (本 PR)
1. `packages/core/src/worksite/scope-auth-policy.ts` — `deriveScopeAuthorization(task): ScopeAuthorization` 纯函数 (Phase 1 default: read+execute, Auto posture, scope = `agora://task/<id>`).
2. `packages/core/src/worksite/task-resolver.ts` — `toTaskWorksite(task)` 现在填 `scopeAuthorization` 字段.
3. `packages/core/src/worksite/scope-auth-policy.test.ts` — 4 TDD tests (scope/posture/permissions/frozen).
4. `packages/core/src/worksite/worksite-scope-auth-integration.test.ts` — 4 integration tests (registry register / duplicate guard / thread register / composition pattern).
5. `apps/cli/src/composition.ts` — `makeWorksiteScopeAuthResolver(db)` helper + 替换 `scopeAuthorizationFromEnv` stub.
6. `packages/core/src/index.ts` — export `WorksiteResolverRegistry`, `TaskWorksiteResolver`, `parseWorksiteUri`, `formatWorksiteUri`, `deriveScopeAuthorization`, `resolveScopeAuthorization`.
7. `Doc/09-PLANNING/TASKS/2026-08-30-worksite-resolver-registration/{task_plan,findings,progress}.md`.

### 不做 (后续段)
- ❌ ThreadWorksiteResolver 在 composition 注册 (R-C-2, dsh-matrix-connector 推 scope auth)
- ❌ 真实 matrix ACL 注入 (Phase 2)
- ❌ kill switch (P3.5-3b)
- ❌ Dashboard human approval 入口 (separate frontend work)

## 3. 设计

```ts
// packages/core/src/worksite/scope-auth-policy.ts
export function deriveScopeAuthorization(task: TaskRecord): ScopeAuthorization {
  return Object.freeze({
    scope: formatWorksiteUri('task', task.id),
    posture: 'Auto',                          // Phase 1: borrow 决策不需人工确认
    permissions: Object.freeze(['read', 'execute']),  // Phase 1: 无 write/delete (留 ACL)
  });
}
```

```ts
// apps/cli/src/composition.ts
function makeWorksiteScopeAuthResolver(db: AgoraDatabase) {
  const taskRepo = new TaskRepository(db);
  const registry = new WorksiteResolverRegistry();
  registry.register(new TaskWorksiteResolver({ taskRepository: taskRepo }));

  return (target: string) => {
    try {
      const parsed = parseWorksiteUri(target);
      if (parsed.type !== 'task') return undefined;
      const task = taskRepo.getTask(parsed.id);
      if (!task) return undefined;
      return deriveScopeAuthorization(task);
    } catch { return undefined; }
  };
}
```

## 4. worktree

- path: `.worktrees/feat-worksite-resolver-registration/`
- branch: `feat/worksite-resolver-registration` (base master `efbd3ba`)

## 5. 验证

- 4 + 4 = 8 新 test pass
- build 0 / typecheck 0
- 全回归 1323/1360 (37 fail = baseline EROFS, **0 回归** vs turn 122 baseline 1315)
- worksite 域 85/85 pass