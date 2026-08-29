# T-1.5 Progress (2026-08-30)

## 状态

✅ **R-C-1 完成** (dsh-agora side)

## 验证

- **service tests**: 9/9 pass (`packages/core/src/thread-task-binding-service.test.ts`)
- **repo tests**: 7/7 pass (`packages/db/src/repositories/thread-task-binding.repository.test.ts`)
- **CLI command tests**: 8/8 pass (`packages/core/src/thread-bind-command.test.ts`)
- **build**: 0
- **typecheck**: 0
- **full regression**: 1315/1352 pass (37 fail = baseline 36 EROFS + 1 locale, **0 回归**)
- **CLI --help smoke**: `agora-ts thread --help` 输出完整 4 subcommands (bind/unbind/lookup/list) ✓
- **CLI E2E (real db)**: sandbox EROFS 限制 `~/.agora/skills/*` init path, 只能在 `--help` 层验证；服务层 unit + 集成测试 + CLI help 证明命令注册成功

## 变更范围

13 文件（见 findings.md §5）

## CLI 使用样例

```bash
# bind matrix thread room → agora task
agora-ts thread bind --thread-key 'mx_a0000000000000001' --task-id T-1

# look up by task
agora-ts thread lookup --task T-1

# unbind by either side
agora-ts thread unbind --thread-key 'mx_a0000000000000001'
agora-ts thread unbind --task-id T-1

# list all
agora-ts thread list
```

## §1 compliance

- Core 不写平台名 (matrix/discord/slack) — pattern 是 composition-injected
- threadKey 对 agora central opaque — matrix adapter 解释
- binding store 是 Core 抽象 (任何 opaque ID ↔ task ID 都能用)
- 实际 matrix room state 投影留给 R-C-2 (dsh-matrix-connector)

## SSoT 回写

- 此 fork 无 `docs/Agora-实施排期-Agora-TS.md` (确认 turn 117). 不需回写.
- planning 在 `Doc/09-PLANNING/TASKS/2026-08-30-matrix-tier1.5-thread-task-projection/`.

## 下一步 (R-C-1 完成, 推荐)

**R-C-2 (dsh-matrix-connector side)**:
- 真实 matrix thread metadata → agora `ThreadMetadata` (R-A interface)
- Task title → matrix room name 投影 (订阅 agora Task state 变化, 调 matrix-js-sdk `setName`)
- matrix thread event → agora Task inbox/comment (out of scope, T-3/T-8 webhook)

或 **R-H (P3.5-3a scopeAuthResolver worksite 接入)** — 闭环现有 borrow 命令, 沙箱内可完成。