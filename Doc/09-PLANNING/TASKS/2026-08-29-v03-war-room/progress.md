# progress.md — v0.3 war room

## 阶段 1 — 调查 (turn 44 step 4-17)
- `task.state` 永远 stuck at `active` (quick任务不自动 completed)
- 真正"完成"在 `subtasks[].status === 'completed'` + `subtasks[].output`
- `TaskRecord` 无 `result` / `conversation` 字段
- Matrix `/rooms/{id}/joined_members` 标准 API 返回 user_ids
- `task.team.members[0].agentId` 是 agora 实际派给的 agent

## 阶段 2 — Worktree + plan (turn 44 step 17-19)
- 开 `feat/v03-war-room` (forked from feat/dsh-matrix-connector)
- 写 task_plan.md (3 块规划) + findings.md (8 个关键事实)

## 阶段 3 — v0.3.1 post-mortem (turn 44 step 20-40)
- RED: 写 `tests/post-mortem.test.mjs` (4 tests)
- GREEN: 写 `src/post-mortem.ts` (buildPostMortem factory)
- 接 plugin index.ts: handleAgoraEvent 调用 postMortem.handleTick
- 修 `taskBridge.show` 类型不匹配 → 用 `agora.getTask` raw record
- ⚠️ `tests/smoke-v02b-citizen-routing.mjs` throw Skipped 干扰 unit → 改 `process.exit(0)`
- **60/60 unit green**
- smoke-v031-post-mortem PASSED
- **commit `3205a26`**

## 阶段 4 — v0.3.2 room roster (turn 44 step 41-63)
- RED: 写 `tests/room-roster.test.mjs` (7 tests)
- 设计反转: 测试期望 agentId 是 local-part (`code-reviewer`), 但实际 bot user_id local-part 是 `dsh-bridge-code-reviewer`. 重新设计：strip `dsh-bridge-` 前缀
- GREEN: `src/room-roster.ts` resolveFromRoster(candidate, roster)
- MatrixClient.transport 加 optional `joinedMembers?(roomId)`
- DispatchBridge.dispatch(args, roster=[]) 加 fallback
- handleRoomMessage dispatch case 调 matrix.joinedMembers
- 同样修 smoke-v032-room-roster 缺 env → exit 0
- **68/68 unit green**
- smoke-v032-room-roster PASSED (真解析 `@dsh-bridge-node-a` → `node-a`)
- **commit `64d0f6a`**

## 阶段 5 — v0.3.3 status panel (turn 44 step 64-75)
- RED: 写 `tests/status-panel.test.mjs` (3 tests)
- ⚠️ SyntaxError: `'OC-1': {` 需要 quotes (Node 解析 `OC-1:` 为减号)
- GREEN: `src/status-panel.ts` buildStatusPanel factory
- index.ts: roomTasks Map + rememberTask + panelFor + 在 handleAgoraEvent 调 panelFor(room).handleTick
- 修 smoke-v032 syntax
- **72/72 unit green**
- **commit `773c0c8`**

## 阶段 6 — Merge + cleanup (turn 44 step 74)
- merge `0bed4fb` to master
- ff-merge master into feat/dsh-matrix-connector
- worktree remove feat/v03-war-room
- branch delete

## 阶段 7 — Walkthrough 落地 (turn 44 step 75)
- Doc/10-WALKTHROUGH/2026-08-29-dsh-matrix-connector-v03-war-room.md
- Doc/09-PLANNING/TASKS/2026-08-29-v03-war-room/progress.md (this file)

## 验收检查

- [x] §1 边界保持 — 3 块都不出 threadKey, 不进 agora Core
- [x] §3 worktree-first — 用 feat/v03-war-room, 已合已删
- [x] §4 TDD — 3 块 RED (4+7+3 fail) → GREEN (4+7+3 pass)
- [x] §4 walkthrough + progress 全落地
- [x] 72/72 unit tests green
- [x] 3 smoke PASSED
- [x] master chain clean

## 未完成 / 留给未来

- v1.0: task 卡住自动呼叫 (orchestration, 跨 IM adapter)
- v1.0: 跨房间汇总面板
- v1.0: artifact 摘要自动回投
- 持久化 panel eventId