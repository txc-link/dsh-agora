# R-D matrix side — reply ingest REST endpoint (2026-08-30)

## 1. 目标

R-D dsh-agora side (PR#14) 交付了 `InboxReplyService.recordInboundReply`，但没有 REST 入口。
matrix-connector 无法投递 reply。本 PR 补 `POST /api/tasks/:id/conversation/reply`。

## 2. 范围

### 必须
1. `apps/server/src/composition.ts` — `createInboxReplyService` factory (InboxReplyService + TaskRepository + TaskConversationRepository)
2. `apps/server/src/app.ts` — 注入 `inboxReplyService?` + `POST /api/tasks/:id/conversation/reply` route
3. zod request schema (contracts): `recordInboundReplyRequestSchema`
4. tests: route handler (server) — 成功/404 task/task not configured/dedupe
5. doc

### 不做
- ❌ CLI (matrix side 调用 REST, agent 不需要)
- ❌ threadTaskBindingKey 关联校验 (Phase 2 — adapter 侧解析后传入)

## 3. API

```
POST /api/tasks/:id/conversation/reply
{
  "provider": "matrix",
  "provider_message_ref": "$event",
  "parent_message_ref": "$parent",       // adapter 解析 m.in_reply_to (opaque)
  "body": "回复内容",
  "author_kind": "human",
  "author_ref": "@user:agent-hub.local",
  "display_name": "user",
  "occurred_at": "2026-08-30T12:00:00Z",
  "thread_task_binding_key": "mx_xxx"    // optional
}
→ 201 { id, deduped: false }
→ 409 task not found
→ 503 service not configured
```

## 4. worktree

- path: `.worktrees/feat-rd-reply-endpoint/`
- branch: `feat/rd-reply-endpoint` (base master `d3053e4`)

## 5. 验证

- server route tests pass (4+)
- build 0 / typecheck 0
- 全回归 1333+ (0 回归)