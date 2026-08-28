# 2026-08-29 — dsh-matrix-connector v0.3 war room

## Outcome

| | |
|---|---|
| Goal | Matrix 房间变成 agent 军机处 (post-mortem + roster + status panel) |
| Scope | plugin 端 only; agora 中央零改动 (post-mortem 用 GET /api/tasks/:id, roster 用 Matrix joined_members) |
| Commits | `3205a26` (v0.3.1) + `64d0f6a` (v0.3.2) + `773c0c8` (v0.3.3) → merged `0bed4fb` |
| Worktree | `.worktrees/feat-v03-war-room/` — created, used, removed |

## 3 个 commit 拆分理由

每个 commit 独立可回滚。三个职责清晰分离:

| Commit | 职责 | 测试 |
|---|---|---|
| v0.3.1 post-mortem | SSE tick 触发 task status pull, 摘要发回房间 | 4 unit + 1 smoke |
| v0.3.2 room roster | `/agora dispatch <name>` 用房间成员解析 | 7 unit + 1 smoke |
| v0.3.3 status panel | 每房间一条 panel 消息, SSE tick 后edit | 3 unit |

## 关键发现 — task.state 永远不 completed

**重要校正**：quick 任务在 agora 中央**不会自动 `completed`**。`task.state` 永远卡在 `active`。真正"完成"在 `subtasks[].status === 'completed'` 和 `subtasks[].output`。

v0.3.1 因此不监听 `to_state === 'completed'`，而是直接拉 task record 看 subtasks。这是 §1.5 调查阶段的产物。

## §1 边界保持

| 改动 | 是否出 wire threadKey | 是否进 agora 中央 |
|---|---|---|
| post-mortem 消息体 | ❌ 仅含 task_id, executor, output | ❌ plugin 私有 |
| room roster 解析 | ❌ 仅 user_ids (Matrix 公开协议) | ❌ plugin 私有 |
| status panel 内容 | ❌ 仅含 task_id, agent, state | ❌ plugin 私有 |

## 真实能力差异 (v0.2b → v0.3)

| 场景 | v0.2b | v0.3 |
|---|---|---|
| 任务完成后 | 看 flow_log 自己查 | bot 自动发结果摘要回房间 |
| 派活 /agora dispatch <id> | 需 `code-reviewer` 全名 | `rev`, `reviewer`, `code-reviewer` 都行 (唯一匹配) |
| 多人多任务在飞 | 房间静默 | 房间有一条 live panel 实时更新 |

## v0.3.1 — post-mortem

**触发**: SSE `event: tick` 携带 task_id (plugin 已通过 placeholder registry 认识).

**逻辑**:
```
SSE tick(task_id)
  → registry.resolveTaskId(task_id) → roomId
  → agora.getTask(task_id)  → TaskRecord
  → 若 subtasks[].status === 'completed' 或任意 output 非空
     → matrix.sendText(roomId, summary)
     → 加入 postedPostMortem 集合 (去重)
```

**摘要格式**:
```
[agora post-mortem] task `OC-1787934650636`
  executor: @code-reviewer
  state: active
  subtasks: 1/1 done
  output: <last 240 chars>
  artifacts: 2 uploaded
```

## v0.3.2 — room roster

**触发**: `/agora dispatch <args>` 解析后无 citizen_id.

**逻辑**:
```
parseDispatchArgs(args) → citizen_id 缺失
  → matrix.joinedMembers(roomId) → member user_ids
  → resolveFromRoster(args[0], member_ids)
     - 提取 dsh-bridge-<name>:domain 中的 <name>
     - exact match 或 unique prefix match
  → 若命中 → citizen_id = name → team_override
```

**示例** (room 里有 @dsh-bridge-node-a 和 @dsh-bridge-node-c):
- `/agora dispatch node-a 修 bug` → `team.members[0].agentId = "node-a"`
- `/agora dispatch nod 修 bug` → 唯一 prefix 匹配 `node-a`
- `/agora dispatch no 修 bug` → `node-a` + `node-c` 都匹配 → 不解析 (无歧义)
- `/agora dispatch @node-a 修 bug` → case 1 直接走 `parseDispatchArgs` 不需要 roster

## v0.3.3 — status panel

**触发**: SSE tick + 该 task 在某 room 的任务集合中.

**逻辑**:
```
SSE tick(task_id)
  → registry.resolveTaskId(task_id) → binding.roomId
  → roomTasks.get(roomId) → Set<taskId>
  → 对每个 task_id 拉一次 task record
  → render([task1, task2, ...])
  → 若 panelEventId 未设 → matrix.sendText (新建)
  → 否则 → matrix.edit(panelEventId, ...)
```

**面板格式**:
```
[war room] 3 task(s) in this room:
 `OC-1787...`  @code-reviewer  state=active  stage=execute
 `OC-1787...`  @haiku          state=active  stage=execute
 `OC-1787...`  @tester         state=active  stage=execute
```

**生命周期**: 内存里. plugin 重启 → 新建 panel (旧 panel 不动, 用户看到一个 room 有 2 个 panel — 可接受).

## Verification

- **72/72 unit tests green** (49 v0.1.1 + 5 dispatch-args + 1 @mention + 1 plugin-flow streamEvents mock + 4 post-mortem + 7 room-roster + 3 status-panel = 70 + 2 不计 = 72)
- **3 smokes** (post-mortem, room-roster live, status-panel) PASSED individually
- §1 边界: threadKey/actor 永远不出 wire

## 不做 (v0.3 → v1.0+)

- 多 agent 协作 (一个 task 卡住, 其他 agent 收到邀请)
- panel 跨 room 共享
- panel 持久化 (重启重建)
- artifact 内容预览

## v1.0 方向

按 turn 25 总目标, v1.0 = **房间变 agent org war room**:
- task 卡住超时时自动呼叫 @executor 来帮忙
- 房间成员列表 = agora org chart
- 跨房间汇总面板 (今日所有 rooms 进度)
- artifact 摘要自动回投 (不只是 count)