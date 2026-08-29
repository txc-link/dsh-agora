# R-D matrix side — Findings (2026-08-30)

## 1. 关键发现：R-D dsh-agora side 缺 REST 入口

PR#14 (InboxReplyService) 交付了 Core service，但**没有 REST endpoint**。
matrix-connector 是 REST 客户端（agora-rest.ts），无法调用 Core service 直连。

本 PR 补 `POST /api/tasks/:id/conversation/reply`。

## 2. §1 compliance

route handler 只消费 opaque 字段：
- `provider_message_ref` / `parent_message_ref` — adapter 解析的 event ids
- `thread_task_binding_key` — turn 122 opaque threadKey

zod schema (`recordInboundReplyRequestSchema`) 无任何 matrix 协议词汇。
m.relates_to 解析仍在 matrix adapter（下一步）。

## 3. 设计决策

### 3.1 为什么不复用 /api/conversations/ingest

现有 ingest 走 `TaskInboundService` → `TaskConversationService.ingest` → 需要
`task_context_bindings`（旧模型）才能找到 task。

R-D 走新 `InboxReplyService`（taskId 直连 + thread_task_binding_id 新列），
语义不同：
- ingest: 通过 IM thread binding 反查 task（旧模型）
- reply: 直接按 taskId 投递（新模型，thread binding 可选关联）

两者并存，互不干扰。

### 3.2 错误码约定

`InboxReplyService.recordInboundReply` 抛 `NotFoundError`（core/errors.ts）
而非裸 Error：
- task 不存在 → 404（translateError 已支持 NotFoundError）
- 其他校验失败 → 400

这是既有约定（ConflictError→409 / PermissionDeniedError→403 / NotFoundError→404）。

### 3.3 exactOptionalPropertyTypes

zod `body.parent_message_ref ?? undefined` 无法直接传给
`InboxReplyInput.parentMessageRef?: string`（strict TS 禁止显式 undefined）。
用条件 spread（与 CLI 相同模式）。

## 4. 测试覆盖

| suite | tests | 覆盖 |
|---|---|---|
| task-conversation-routes.test.ts (新增 4) | record reply 201 / dedupe / 404 / 503 | |

## 5. 下一步（matrix-connector）

1. agora-rest.ts 加 `recordInboundReply(taskId, body)` 方法
2. reply ingest 模块：解析 m.relates_to.m.in_reply_to → 调 endpoint
3. 挂到 message-router / timeline listener