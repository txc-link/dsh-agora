# Task: T-0 matrix thread → WorkSite resolver (2026-08-30)

## 1. 目标

修 Phase 1 留的 5 个 WorkSite resolver stub 之一. 当前 `WorksiteResolverRegistry` 只注册 task resolver, thread type `resolveWorksite(uri)` 抛 `WorksiteNotImplementedError`. 补完后 `agora://thread/mx_xxx` 能走通用 resolver 路径.

## 2. 范围

### 必须
1. `agora-ts/packages/core/src/worksite/thread-resolver.ts` — `ThreadWorksiteResolver implements WorksiteResolver<ThreadWorksite>`
2. `agora-ts/packages/core/src/worksite/thread-resolver.test.ts` — TDD (in-memory stub port)
3. 定义 `ThreadSourcePort` interface (in worksite/resolver.ts 或 thread-resolver.ts) — composition 注入的真实 thread metadata 来源
4. 注册到 `WorksiteResolverRegistry` (在 worksite/registry.ts 加 1 行)
5. core barrel export `ThreadWorksiteResolver` + `ThreadSourcePort`
6. task_plan.md + findings.md + progress.md

### 不做
- ❌ matrix 真实 transport (T-1, 单独 PR)
- ❌ ThreadSourcePort 真实实现 (留到 T-1 或 composition 阶段)
- ❌ thread resolver messages/events 实时同步 (按需 fetch 模式)

## 3. 设计

```ts
// ThreadSourcePort: composition 注入 thread metadata 来源
export interface ThreadMetadata {
  roomId: string;
  name?: string;
  topic?: string;
  memberCount?: number;
  lastEventAt?: string;
  scopeAuthorization?: ScopeAuthorization;
}
export interface ThreadSourcePort {
  getThreadMetadata(roomId: string): Promise<ThreadMetadata | undefined>;
  listRooms(): Promise<string[]>;
}

// ThreadWorksiteResolver
export class ThreadWorksiteResolver implements WorksiteResolver<ThreadWorksite> {
  constructor(private readonly threadSource: ThreadSourcePort) {}
  readonly type = 'thread' as const;
  canResolve(uri: WorksiteUri): boolean { return uri.type === 'thread'; }
  async resolve(uri: WorksiteUri): Promise<ThreadWorksite> {
    // parse mx_xxx from uri.path
    // fetch metadata via threadSource
    // return ThreadWorksite
  }
}
```

## 4. worktree

- worktree: `.worktrees/feat-matrix-tier0-thread-resolver/`
- branch: `feat/matrix-tier0-thread-resolver` (base master `7493cd4`)

## 5. 验证

- thread-resolver.test.ts 全绿 (in-memory port)
- build 0, typecheck 0
- 全量 baseline apps/cli 36 EROFS + locale 不变