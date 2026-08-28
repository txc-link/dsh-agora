# task_plan.md — 组织化 agent 工作 OS — dsh-matrix-connector v0.1 实现

## 1. 任务来源
2026-08-28 turn 26，用户三个"是"+ turn 27 "实现"

## 2. 任务目标
v0.1 让 matrix 房间 = agora citizen 会议室；4 周交付；9 工作日。

## 3. 工作树（按 §3 强制要求）

- 主工作区：`/home/ailink/dsh-agora`（master @ 80dda57）
- 新 worktree：`/home/ailink/dsh-agora/.worktrees/feat-dsh-matrix-connector/`
- 新 git 仓：`/home/ailink/dsh-agora/.worktrees/feat-dsh-matrix-connector/dsh-matrix-connector/`
- 分支：`feat/dsh-matrix-connector`（基 master @ 80dda57）
- 工作区干净（除 .audit/、Doc/ 新文档、worktree 自身）

## 4. 阶段（按 §4 TDD + 验证 + 回写）

| 阶段 | 产物 | 状态 |
|---|---|---|
| 1. 仓初始化 + RED test 骨架 | package.json + dsh.plugin.json + cordis.patch.yml + 5 个空 test + RED | in_progress |
| 2. matrix-client 绿 | src/matrix-client.ts + tests/matrix-client.test.mjs (3 case) | pending |
| 3. message-router 绿 | src/message-router.ts + tests/message-router.test.mjs (4 case) | pending |
| 4. citizen-bridge 绿 | src/citizen-bridge.ts + tests/citizen-bridge.test.mjs (3 case) | pending |
| 5. task-bridge 绿 | src/task-bridge.ts + tests/task-bridge.test.mjs (3 case) | pending |
| 6. attention-bridge 绿 | src/attention-bridge.ts + tests/attention-bridge.test.mjs (2 case) | pending |
| 7. provision-bot 脚本 | scripts/provision-bot.sh | pending |
| 8. smoke-matrix 真 Synapse | tests/smoke-matrix.mjs | pending |
| 9. README + walkthrough + 回写 | README.md + Doc/10-WALKTHROUGH/2026-08-28-dsh-matrix-connector-v0.1.md | pending |

每阶段前读 task_plan.md，后更新 progress.md。

## 5. 验收门槛

1. `npm run typecheck` 0 错误
2. `npm test` 全绿
3. `npm run smoke:matrix` 真 Synapse 跑通（8.136.15.147:8008）
4. README + walkthrough 落盘
5. agora 中央零改动

## 6. 工作流约束

- §1.5 第一性原理：每阶段前验证假设
- §3 强制规划：本目录 + Doc/ 落盘
- §4 TDD：先 RED 后 GREEN
- §8 公开 Doc：所有文档落 `Doc/`，不污染私仓

## 7. 工作量估算

| 任务 | 工作日 |
|---|---|
| 阶段 1 | 0.5 |
| 阶段 2 | 2 |
| 阶段 3 | 1 |
| 阶段 4 | 1 |
| 阶段 5 | 1 |
| 阶段 6 | 0.5 |
| 阶段 7 | 1 |
| 阶段 8 | 1 |
| 阶段 9 | 1 |
| 总计 | **9 工作日 ≈ 4 周** |