# R-D (T-3) Progress (2026-08-30)

## 状态

✅ **dsh-agora side 完成**（Core service + migration 035）
⏳ matrix-connector side（下一个 PR）

## 验证

- `inbox-reply-service.test.ts`: 7/7 pass
- `migration-035.test.ts`: 3/3 pass
- build: 0
- typecheck: 本任务新文件干净（2 处 mock fixture 修复，历史 debt 15 个未动）
- 全回归: 1333 pass / 37 fail（baseline EROFS，**0 回归**）

## 变更

| 文件 | 角色 |
|---|---|
| `packages/contracts/src/domain-types.ts` | +thread_task_binding_id, binding_id nullable |
| `packages/contracts/src/task-conversation.ts` | DTO zod schema 同步 |
| `packages/contracts/src/task-conversation.test.ts` | fixture + 断言更新 |
| `packages/db/src/migrations/035_thread_task_conversation_binding.sql` | rebuild 表 |
| `packages/db/src/migrations/migration-035.test.ts` | 3 迁移测试 |
| `packages/db/src/repositories/task-conversation.repository.ts` | +thread_task_binding_id 读写 |
| `packages/db/src/database.ts` | 注册 035 |
| `packages/core/src/inbox-reply-service.ts` | **核心交付** |
| `packages/core/src/inbox-reply-service.test.ts` | 7 测试 |
| `packages/core/src/index.ts` | export InboxReplyService |

## 下一步

1. **R-D matrix side**（dsh-matrix-connector）: reply-to event listener → recordInboundReply
2. **R-C-2**（dsh-matrix-connector）: Task title → room name 投影