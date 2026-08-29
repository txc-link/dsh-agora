# Task: T-3 R-D matrix reply-to → agora inbox/comment (2026-08-30)

## 1. 目标

提供 Core 抽象: matrix adapter 收到 reply-to event → 调 agora Core `InboxReplyService.recordInboundReply(...)` → 写 `task_conversation_entries` 表 + 可选关联 `thread_task_bindings` (turn 122 binding).

§1 boundary: Core 只表达 opaque parent_message_ref + provider_message_ref (dedupe key). matrix m.relates_to.m.in_reply_to 解析在 adapter (R-D matrix-connector side).

## 2. 范围

### 必须 (本 PR — dsh-agora side)
1. migration 035: `task_conversation_entries` 新列 `thread_task_binding_id TEXT NULL REFERENCES thread_task_bindings(thread_key) ON DELETE SET NULL` + `binding_id` 允许 NULL (Phase 1 R-D 不依赖旧 task_context_bindings)
2. `ITaskConversationRepository.insert` 接受可选 `threadTaskBindingId`, `bindingId` 改 optional
3. `InboxReplyService` Core service: `recordInboundReply({ taskId, provider, providerMessageRef, parentMessageRef, body, authorKind, authorRef, displayName, occurredAt, threadTaskBindingKey?, dedupeKey? })`
4. SQLite impl 集成 (复用 TaskConversationRepository)
5. TDD tests: dedupe (idempotent insert), reply-to parent link, missing task fail, author metadata
6. doc: `Doc/09-PLANNING/TASKS/2026-08-30-rd-reply-inbox/{task_plan,findings,progress}.md`

### 不做 (后续段)
- ❌ matrix-connector 真实 reply-to event listener (R-D matrix side, dsh-matrix-connector)
- ❌ REST endpoint (Phase 2 — 由 web frontend 推 dashboard 用)
- ❌ CLI command (agent 不需要写 IM reply)
- ❌ reaction (only reply — §1.5 最短路径)

## 3. 设计

```ts
// packages/core/src/inbox-reply-service.ts
export interface InboxReplyInput {
  taskId: string;                             // required, FK to tasks.id
  provider: 'matrix' | 'discord' | string;    // provider identifier (opaque)
  providerMessageRef: string;                 // adapter-side event_id (dedupe anchor)
  parentMessageRef?: string;                  // adapter-side parent_event_id (opaque reply-to anchor)
  body: string;
  authorKind: 'human' | 'agent' | 'bot';
  authorRef?: string;
  displayName?: string;
  occurredAt: string;                         // ISO from adapter
  threadTaskBindingKey?: string;              // turn 122 thread binding key (opaque)
}

export class InboxReplyService {
  constructor(opts: { taskRepo, threadBindingRepo, conversationRepo, inboxRepo }) {}
  recordInboundReply(input: InboxReplyInput): InboxReplyReceipt  // { id, deduped: boolean }
}
```

dedupe 策略:
- dedupe_key = `<provider>:<providerMessageRef>` (deterministic, idempotent across retries)
- 重复 insert 返回已有 entry (TaskConversationRepository 已支持 dedupe_key lookup)

reply-to 链接:
- parent_message_ref = adapter 提供 (matrix event_id, opaque)
- 不在 Core 解析 matrix m.relates_to 协议 — adapter-side 解析后传 string

thread 关联:
- 如果 threadTaskBindingKey 提供, 写 thread_task_binding_id 列
- 否则 binding_id 允许 NULL (R-D inbound 不强制绑 thread)

## 4. worktree

- path: `.worktrees/feat-rd-reply-inbox/`
- branch: `feat/rd-reply-inbox` (base master `43958ce`)

## 5. 验证

- 6+ TDD tests (dedupe, reply parent, missing task, author metadata, thread binding link)
- build 0 / typecheck 0
- 全回归 1323+ baseline (0 回归)
- adapter-side E2E 留给 matrix-connector 后续 PR