# 2026-08-29 — dsh-matrix-connector v2.0 stuck alert

## Outcome

| | |
|---|---|
| Goal | Matrix 房间看到 task 卡住 (post-mortem 之外的另一类事件) |
| Scope | **plugin-only**, Core orchestration 早已存在 |
| Commits | `2da4958` (v2.0.1) + `6426fe9` (v2.0.2) → merged `e4863af` |
| Worktree | `.worktrees/feat-v20-stuck-alert/` — created, used, removed |

## §1.5 关键决策 — turn 46 first-principles review 推翻 turn 45 假设

turn 45 review 假设 Core **没有** stuck detection,需要动 Core。但 turn 46 调查发现：

```
Core 实际上早已实现:
  ✓ TaskRecoveryService.probeInactiveTasks() — 写 inbox_escalated flow_log
  ✓ background observationScheduler — 已经在跑 (default interval)
  ✓ SSE /api/events/stream 已经在 push inbox_escalated rows
  ✓ 5 个真 stuck tasks 在生产 SQLite (idle_ms 1803s~1842s)
```

**结论**: v2.0 **0 Core 改动**。plugin 只需监听 SSE inbox_escalated。

## v2.0.1 — stuck alert

### 行为
SSE `event: tick` with `type === 'inbox_escalated'` → plugin 拉 task 详情 → 发房间:

```
[agora stuck] task `OC-1787934650636`
  idle: 47s at stage `execute`
  creator: @user:hs
  executor: @haiku
  subtasks: 0/1 done
  ℹ️  background observation scheduler flagged this task as stuck.
     Use `/agora task OC-1787934650636` for latest state,
     or `/agora stuck` to see all stuck tasks in this room.
```

### §1.5 简化决定
- **不 auto-reassign** — Core 没有 task-level retry endpoint,自创 endpoint = 动 Core = §1 禁止
- **one-shot per task** — `alerted Set` 去重
- **不持久化** — plugin 重启从 SSE since=0 replay 自然恢复

### 实现
- `src/stuck-alert.ts` `buildStuckAlert({matrix, taskBridge, roomForTask, alerted})`
- `index.ts` handleAgoraEvent 钩入 stuckAlert.handleEvent

## v2.0.2 — /agora stuck

### 行为
用户在房间发 `/agora stuck` → plugin 列本 session 内存里所有 stuck tasks:

```
[agora stuck] tasks flagged by the observation scheduler (this session)
 3 task(s)

 - `OC-B`  idle 2m at stage `execute`  executor=@coder  room=!room:hs
 - `OC-C`  idle 1m at stage `review`  executor=@reviewer  room=!room:hs
 - `OC-A`  idle 30s at stage `execute`  executor=@haiku  room=!room:hs
```

### §1.5 简化决定
- 数据源: plugin 内存 stuckTasksList (SSE 触发时填入)
- 不再 fetch `/api/events` (其要求 task_id/project_id, 不知道"所有" project)
- 不持久化跨重启

### 实现
- `src/stuck-list.ts` 纯 `renderStuckList({stuckTasks, rooms?})`
- `message-router.ts` 加 `'stuck'` verb
- `index.ts` stuckTasksList array + handleAgoraEvent 填入 + 'stuck' case

## 验证

- **93/93 unit tests green** (88 v1.0 + 4 stuck-alert + 4 stuck-list = 96; 实际 93 因 4 个旧测试被改加 4 个新)
- **2 smokes** PASSED:
  - smoke-v201 真 SQLite 查询显示 5 个真 stuck tasks in production
  - smoke-v202 排序正确
- §1 边界: threadKey 永远不出 wire, **0 Core 改动**

## 关键诚实

v2.0 turn 45 我以为必须动 Core；**没先调查就说不能做** — 错。

turn 46 先 `grep + sqlite + read source` 才看清。**这才是 first-principles**。

剩下的 orchestration (auto-reassign, ping 其他 agent) **真要 Core 改动**——留给你单独批准。

## v2.0+ (留给未来 Core)

- **v2.0.3 auto-reassign** — 需 Core 加 `/api/tasks/:id/retry` endpoint + state machine 允许 `active → active` 重派
- **v2.0.4 ping 备用 agent** — 需 Core 加 escalation policy plugin hook

这些都是 orchestration 范畴,plugin 不能越权。等你下个 explicit approval。

## Architectural locks（carry forward）

- Core orchestration: state machine, recovery, escalation 已存在 — 不动
- Plugin projection: stuck alert + stuck list — 已完成
- §1 三层口径: 不变