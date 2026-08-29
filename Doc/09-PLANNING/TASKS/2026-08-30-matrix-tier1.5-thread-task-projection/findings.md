# T-1.5 Findings (2026-08-30)

## 1. 范围

R-C T-1.5 thread ↔ Task 双向 state 投影。**本 PR 只完成 R-C-1（dsh-agora side）**：threadKey ↔ taskId binding store + CLI commands。

**R-C-2 (matrix adapter 真实投影 Task title → matrix room name) 留给 dsh-matrix-connector 后续 PR**。

§1 boundary 决定：agora Core 只表达 binding 抽象 + 双向查询。实际 thread state 投影（Task title → room name 等）在 adapter-side (matrix-connector, R-C-2)。Core 不写平台名业务规则。

## 2. 设计决策记录

### 2.1 UNIQUE constraint on task_id

Migration 034 同时声明 `thread_key PRIMARY KEY` + `task_id UNIQUE`：
- threadKey 是 PK (one-to-many with task: threadKey → at most one task)
- taskId 也是 UNIQUE (one task → at most one threadKey)

这允许 rebind 但保证一致性。Repo 的 `bind()` 不在事务内而是 sequential DELETE/INSERT — 单用户 CLI 不存在竞态。如果未来高并发再换 `db.transaction()`（api 不存在，目前 wrap 3 个 prepared statement）。

### 2.2 no FK to tasks

`task_id REFERENCES tasks(id) ON DELETE CASCADE` **不** 加。理由：
- task 存在性由 `ThreadTaskBindingService.bind()` 在调用 ITaskRepository.getTask() 时强制
- 加 FK 把 binding 表耦合到 tasks 表结构（tasks 表列变化影响 binding 表）
- in-memory test repo（test 里用）无 tasks 表

### 2.3 threadKey pattern = composition-injected

`ThreadTaskBindingService` 接受可选 `threadKeyPattern` (default `^.+$`)。Composition root 用 `^mx_[0-9a-f]{16}$` 强制 matrix 风格 threadKey，但**Core 不写死** — 任何 opaque ID 都接受。这样未来 Slack thread / Discord thread 也能用同一 binding 表。

### 2.4 CLI command surface

- `agora-ts thread bind --thread-key <k> --task-id <id>` (mutating)
- `agora-ts thread unbind --thread-key <k>` 或 `--task-id <id>` (mutating)
- `agora-ts thread lookup --task <id>` 或 `--thread <k>` (read)
- `agora-ts thread list` (read)

跟 borrow 命令同款：纯 JSON 输出，无交互提示。

## 3. TS strict 教训

1. **`exactOptionalPropertyTypes: true`** — 不能 `args.foo = undefined`. 必须 conditional spread:
   ```ts
   if (options.x !== undefined) args.x = options.x;
   ```
   否则 TS2379 build fail。

2. **better-sqlite3 / node:sqlite 的 `get()` 返回类型** — `Record<string, SQLOutputValue>` 不是 `BindingRow`。必须 `as unknown as BindingRow[]`。

3. **`TaskRecord` 用 zod infer 出的 DTO** — `TaskLocaleDto` 是 `'zh-CN' | 'en-US'` (string literal), 不是 `{ source, timezone }`. `TaskTeamDto = { members: [] }`, `WorkflowDto = { stages: [], graph: { nodes, edges } }` (graph 必填).

4. **`TaskRepository.insertTask()`** input 形状 — required fields 缺一个会 throw。

5. **Promise unwrap in tests** — `runThreadBindCommand` 是 `async` 必须 `await`,否则 `out.ok` 是 undefined（不是 false）。Test 里 `it` callback 也要 `async`。

## 4. composition root 状态

CLI route + 仓储注入完成。但现有 composition 的 init 路径尝试写 `/root/.agora/skills/*` (sandbox EROFS) — CLI 在沙箱内只能跑 `thread --help`（无需 init）证明命令注册成功。真实 E2E 需要 dev machine。

## 5. 文件清单

| 文件 | 角色 |
|---|---|
| `packages/contracts/src/thread-task-binding.ts` | **新增** IThreadTaskBindingRepository + ThreadTaskBinding |
| `packages/contracts/src/index.ts` | +1 export |
| `packages/core/src/thread-task-binding-service.ts` | **新增** service (binding logic + validation) |
| `packages/core/src/thread-task-binding-service.test.ts` | **新增** 9 TDD tests |
| `packages/core/src/thread-bind-command.ts` | **新增** CLI command logic (bind/unbind/lookup/list) |
| `packages/core/src/thread-bind-command.test.ts` | **新增** 8 TDD tests |
| `packages/core/src/index.ts` | +2 exports |
| `packages/db/src/migrations/034_thread_task_bindings.sql` | **新增** table migration |
| `packages/db/src/database.ts` | +1 migration filename |
| `packages/db/src/repositories/thread-task-binding.repository.ts` | **新增** SQLite impl |
| `packages/db/src/repositories/thread-task-binding.repository.test.ts` | **新增** 7 integration tests |
| `packages/db/src/index.ts` | +1 export |
| `apps/cli/src/index.ts` | +1 deps field + 4 thread CLI subcommands + service factory |

## 6. 未决 (后续段)

- ❌ matrix adapter 真实投影 (R-C-2, dsh-matrix-connector)
- ❌ thread → Task inbound events (T-3 / T-8 webhook)
- ❌ Task state machine 触发自动 thread 投影 (R-C-2 扩展)
- ❌ R-H (P3.5-3a) — scope authorization 走 WorksiteResolverRegistry