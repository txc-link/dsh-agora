# task_plan.md — v2.0 stuck alert (plugin-only)

**Date:** 2026-08-29
**Author:** dsh-agent
**Status:** 设计 → 2 commit (v2.0.1 + v2.0.2)
**Branch:** `feat/v20-stuck-alert` (forked from `feat/dsh-matrix-connector@477f19a`)
**Worktree:** `/home/ailink/dsh-agora/.worktrees/feat-v20-stuck-alert/dsh-matrix-connector/`

## §1.5 决策回顾 — turn 46 first-principles review

**关键发现 (调查后)**：

| 期待 | 现实 |
|---|---|
| Core 没有 stuck detection | Core **已经有** — `TaskRecoveryService.probeInactiveTasks()` + background `observationScheduler` 定时跑 |
| Core 没有 stuck signal | Core **已经在写** `inbox_escalated` flow_log |
| Core 没有 SSE 推送 | SSE `/api/events/stream` 已经把 flow_log 全部 rows 推出去, type='inbox_escalated' |
| Core 没有 task reassign endpoint | **没有**, 唯一 `archive/jobs/:id/retry` 不是 task-level |

**结论**：Core 端的 stuck detection + signal **已经齐全**。plugin 只缺**把信号投影到房间**。

**v2.0 范围**（plugin-only, 0 Core 改动）：
- v2.0.1 stuck alert: 监听 SSE `type: 'inbox_escalated'` → 房间发"卡住了"
- v2.0.2 /agora stuck: 列所有 stuck tasks (查询 flow_log via 已有 /api/events)

## v2.0.1 — stuck alert

### 行为
当 SSE `event: tick` 携带 `type: 'inbox_escalated'` → 拉 task 详情 → 发到房间:

```
[agora stuck] task `OC-1787934650636`
  idle: 47s at stage `execute`
  creator: @user:domain
  executor: @haiku
  subtasks: 0/1 done
  ℹ️  bot's observation scheduler flagged this task as stuck.
     Use `/agora task OC-1787934650636` for the latest state,
     or `/agora stuck` to see all stuck tasks in this room.
```

### §1.5 简化
- **不自动 retry** — 没现成 endpoint，自创 endpoint 是动 Core (§1 禁止)
- **不转发到其他 agent** — 那是 orchestration 范畴
- **one-shot per task** — `stuckAlertedTasks` Set 去重（同 v0.3.1 post-mortem 模式）
- **不持久化** — 重启后从 SSE 历史 replay 一遍 inbox_escalated 重新发 (在 v0.2 SSE 模式下 plugin 重启重新订阅 since=0, 会收到历史 inbox_escalated)

### 实现
- `src/stuck-alert.ts` 纯 `buildStuckAlert({matrix, taskBridge, roomForTask, alerted})` factory
- 监听 SSE tick 时 `if evt.type === 'inbox_escalated' && evt.detail?.kind === 'inbox_escalated'`
- 检测 evt 的 task_id, 拉 task, 渲染, 发房间

### 测试
- `stuck-alert.test.mjs` (4 tests): 触发有/无 output, dedup, idle_ms 渲染

## v2.0.2 — /agora stuck

### 行为
用户在房间发 `/agora stuck` → bot 渲染:
```
[agora stuck] tasks flagged as stuck in the last 1h:
 - OC-1787... idle 47s at stage execute (creator: @user)
 - OC-1787... idle 120s at stage execute (creator: @user)
```

### §1.5 简化
- 数据源: 已有 `GET /api/events?since=X` 端点, filter `event='inbox_escalated'`
- 不再 fetch 单个 task (skill 已是轻量)
- 时间窗口: 默认 1h, 可加 arg `/agora stuck 6h`

### 实现
- `StuckListBridge` 类: `listStuck(sinceMs?: number): Promise<string>` 
- 注入 `agora.getEvents` (已存在)
- message-router 加 `'stuck'` verb

### 测试
- `stuck-list.test.mjs` (3 tests): filter by event type, time window, 空 list

## 验收

- [ ] 83/83 v1.0 tests 仍绿
- [ ] 2 commit 各 3-4 new tests 绿
- [ ] 2 smoke PASSED
- [ ] master chain clean
- [ ] walkthrough + progress

## 不做 (留给未来 Core 改动)

- ❌ Auto-reassign (需 Core endpoint)
- ❌ Ping 其他 agent 来帮忙 (orchestration)
- ❌ Stuck tasks 在 dashboard 上的实时表
- ❌ Slack/Discord mirror

## 实施顺序

1. v2.0.1 stuck alert → commit → smoke
2. v2.0.2 /agora stuck → commit → smoke
3. walkthrough + progress
4. merge + cleanup