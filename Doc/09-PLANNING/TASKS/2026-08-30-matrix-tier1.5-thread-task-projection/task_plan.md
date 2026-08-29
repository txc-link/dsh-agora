# Task: T-1.5 thread ↔ Task binding repo (2026-08-30)

## 1. 目标

提供 threadKey ↔ taskId 双向绑定 (R-C 第一段). agora Core 通过 binding 知道哪个 task 对应哪个 thread, **不直接操纵 thread state** (matrix adapter responsibility, R-C-2).

§1 boundary: agora Core 只表达 binding 抽象 + 双向查询; 实际 thread state 投影 (Task title→room name 等) 在 dsh-matrix-connector (R-C-2).

## 2. 范围

### 必须 (本 PR)
1. `packages/contracts/src/repository-interfaces.ts` — 新接口 `IThreadTaskBindingRepository` (bind/unbind/findByTask/findByThreadKey/list)
2. `packages/core/src/services/thread-task-binding-service.ts` — 业务服务封装 (validate threadKey opaque format, prevent duplicate binds)
3. `packages/persistence/src/sqlite/thread-task-binding-repository.ts` — SQLite 实现 (db migration vN+1)
4. `apps/cli/src/commands/thread-bind-command.ts` + 集成到 apps/cli/src/commands
5. tests: TDD (service unit + repo integration + cli end-to-end)
6. `Doc/09-PLANNING/TASKS/2026-08-30-matrix-tier1.5-thread-task-projection/{task_plan,findings,progress}.md`

### 不做 (后续段)
- ❌ Task title → matrix room name 投影 (R-C-2, dsh-matrix-connector 仓)
- ❌ thread event → Task inbox/comment inbound (T-3, T-8 webhook)
- ❌ task state machine → thread topic live updates (R-C-2)

## 3. 设计

```ts
// contracts
export interface IThreadTaskBindingRepository {
  bind(threadKey: string, taskId: string): void;
  unbindByThreadKey(threadKey: string): boolean;
  unbindByTask(taskId: string): boolean;
  findByTask(taskId: string): ThreadTaskBinding | undefined;
  findByThreadKey(threadKey: string): ThreadTaskBinding | undefined;
  list(): readonly ThreadTaskBinding[];
}

export interface ThreadTaskBinding {
  readonly threadKey: string;
  readonly taskId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// core service
export class ThreadTaskBindingService {
  constructor(private readonly repo: IThreadTaskBindingRepository, private readonly taskRepo: Pick<ITaskRepository, 'getTask'>) {}
  bind(threadKey: string, taskId: string): ThreadTaskBinding
  unbindByThreadKey(threadKey: string): boolean
  unbindByTask(taskId: string): boolean
  findByTask(taskId: string): ThreadTaskBinding | undefined
  findByThreadKey(threadKey: string): ThreadTaskBinding | undefined
  list(): readonly ThreadTaskBinding[]
}
```

CLI commands:
```
agora-ts thread bind <threadKey> --task <taskId>
agora-ts thread unbind <threadKey>
agora-ts thread lookup --task <taskId>
agora-ts thread lookup --thread <threadKey>
agora-ts thread list
```

## 4. worktree

- path: `.worktrees/feat-matrix-tier1.5-thread-task-projection/`
- branch: `feat/matrix-tier1.5-thread-task-projection` (base master `e8ecf12`)

## 5. 验证

- TDD: service unit tests + repo integration tests + cli E2E
- build/typecheck 0
- 全量回归 (baseline 36 EROFS + 1 locale, 无回归)