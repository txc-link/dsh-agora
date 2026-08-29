# R-D (T-3) Findings — matrix reply-to → agora inbox/comment (2026-08-30)

## 1. 设计决策

### 1.1 §1 boundary — Core 不解析 m.relates_to

matrix reply-to 事件的 m.relates_to.m.in_reply_to 解析**完全在 adapter 侧**（dsh-matrix-connector）。
Core `InboxReplyService` 只消费三个 opaque 标识：

```
providerMessageRef  ← adapter 解析 event_id
parentMessageRef    ← adapter 解析 m.in_reply_to.event_id（opaque parent anchor）
threadTaskBindingKey ← turn 122 thread_key（opaque）
```

Core 不 import matrix-js-sdk，不解析 Matrix 协议，不感知 room/event 结构。
移除 matrix 后 InboxReplyService 语义不变（§1 合规）。

### 1.2 复用 task_conversation_entries，不建新表

R-D 的回复是"task 上的 comment"，天然落在现有 `task_conversation_entries` 表：
- direction='inbound'
- author_kind/author_ref/display_name 承载回复者
- parent_message_ref 承载 reply-to 父事件（opaque）
- dedupe_key = `${provider}:${providerMessageRef}` 幂等

**不建平行 inbox_replies 表**（§1.5：避免重复存储语义）。

### 1.3 migration 035 — rebuild 而非 ALTER

SQLite `ALTER TABLE` 无法把 `binding_id` 从 NOT NULL 改成 nullable，必须重建表：
- `binding_id` → nullable（R-D inbound 不关联 legacy task_context_bindings）
- 新列 `thread_task_binding_id TEXT REFERENCES thread_task_bindings(thread_key) ON DELETE SET NULL`
- 包 `PRAGMA foreign_keys=OFF/ON`（FK 在连接层开启，见 database.ts:33）
- 数据迁移：`INSERT ... SELECT` 全量拷贝，thread_task_binding_id 填 NULL
- 已验证无其他表 FK 引用 task_conversation_entries（008 read_cursors 只引用 tasks/human_accounts）

### 1.4 不新增 CLI / REST

R-D 是 inbound 集成，调用者是 matrix adapter（R-D matrix side），不是 agent CLI。
§1.5 最短路径：只做 Core service + 迁移，无新入口。

## 2. InboxReplyService API

```ts
recordInboundReply({
  taskId,              // required — FK 校验存在
  provider,            // 'matrix' | 'discord' | ... (opaque)
  providerMessageRef,  // required — dedupe anchor (adapter event_id)
  parentMessageRef?,   // reply-to parent (opaque)
  body,                // required
  authorKind,          // 'human' | 'agent' | 'craftsman' | 'system'
  authorRef?,          // adapter actor id
  displayName?,
  occurredAt,
  threadTaskBindingKey?,  // turn 122 thread_key
}) => { id, deduped }
```

- task 不存在 → throw `task not found: <id>`
- 重复 providerMessageRef → `{ deduped: true }`（同 id 幂等）
- 不解析 body 语义（inbound action 判定留在 Phase 2 / adapter）

## 3. 测试覆盖

| suite | tests | 覆盖 |
|---|---|---|
| `inbox-reply-service.test.ts` (core) | 7 | inbound 写入、parent 链接、dedupe、thread binding、task 校验、body/provider 校验 |
| `migration-035.test.ts` (db) | 3 | legacy 迁移保留、NULL binding + thread binding、dedupe 唯一索引 |

## 4. 兼容性

- `TaskConversationEntryRecord.binding_id: string | null`（原 string）
- `InsertTaskConversationEntryInput.binding_id?: string | null` + 新 `thread_task_binding_id?`
- `TaskConversationEntryDto` zod schema 同步（binding_id nullable + 新字段）
- 所有既有调用方（craftsman-callback / notification-dispatcher / task-broadcast / task-conversation-service）传 binding_id，向后兼容
- 全回归 1333 pass / 37 fail（baseline EROFS，0 回归）

## 5. 历史 typecheck debt（非本任务引入）

typecheck 有 ~15 个既有错误，全在 test 文件 mock fixture：
- `borrow-command.test.ts` — vi.fn().mockReturnValue(null) 泛型推断
- `worksite/*.test.ts` + `thread-*` tests — workflow.graph 缺 graph_version/entry_nodes
- 本任务新文件已修干净（2 处），未扩大 debt

## 6. R-D matrix side（下一个 PR，dsh-matrix-connector）

- 监听 room 的 m.room.message
- 解析 m.relates_to.m.in_reply_to.event_id → parentMessageRef
- room_id → threadTaskBindingKey（turn 122 binding repo lookup）
- 调 agora Core recordInboundReply（通过 CLI 或直接 service 注入）