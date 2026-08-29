# R-D matrix side — Progress (2026-08-30)

## 状态

✅ **dsh-agora REST endpoint 完成**（`POST /api/tasks/:id/conversation/reply`）
⏳ matrix-connector reply ingest（下一步）

## 验证

- task-conversation-routes.test.ts: 4 新 route tests pass（含 404/503/dedupe）
- inbox-reply-service.test.ts: 7/7（NotFoundError 改动后仍绿）
- 全回归: 1337 pass / 37 baseline fail（**0 回归**）
- build: 0

## 变更

| 文件 | 角色 |
|---|---|
| `packages/contracts/src/task-conversation.ts` | +recordInboundReplyRequestSchema + ResponseSchema |
| `packages/core/src/inbox-reply-service.ts` | 抛 NotFoundError（task 404 语义） |
| `apps/server/src/composition.ts` | +createInboxReplyService factory + ServerComposition 字段 |
| `apps/server/src/app.ts` | +注入 inboxReplyService + POST route |

## API（matrix adapter 调用）

```
POST /api/tasks/:id/conversation/reply
{
  "provider": "matrix",
  "provider_message_ref": "$event",
  "parent_message_ref": "$parent",        // adapter 解析 m.in_reply_to
  "body": "回复内容",
  "author_kind": "human",
  "author_ref": "@user:agent-hub.local",
  "display_name": "user",
  "occurred_at": "2026-08-30T12:00:00Z",
  "thread_task_binding_key": "mx_xxx"     // optional
}
→ 201 { id, deduped: false }
→ 404 { message: "task not found: X" }
→ 503 { message: "Inbox reply service is not configured" }
```

## 下一步

matrix-connector:
1. agora-rest.recordInboundReply(taskId, body)
2. reply-ingest 模块解析 m.relates_to.m.in_reply_to
3. 挂 timeline listener