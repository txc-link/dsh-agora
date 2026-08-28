# findings.md — v2.0 stuck alert

## turn 46 关键发现（推翻 turn 45 review）

### 1. Core 已经有 stuck detection
**位置**: `agora-ts/packages/core/src/task-recovery-service.ts:140`

```ts
export class TaskRecoveryService {
  ...
  probeInactiveTasks(options): {
    scanned_tasks, controller_pings, roster_pings, human_pings, inbox_items
  }
}
```

- 写 `inbox_escalated` flow_log
- 写 inbox_items table  
- 触发 controller / roster / human pings (按 escalation policy)

### 2. Background scheduler 已经在跑
**位置**: `agora-ts/apps/server/src/runtime.ts:344`

```ts
const observationScheduler = createObservationScheduler({
  config, taskService, ...
});
// 内部 setInterval 每 scheduler.scan_interval_sec 跑 probeInactiveTasks()
```

默认配置 (runtime.ts 113 行附近): 
- `controller_after_sec` 默认几十秒
- `roster_after_sec` 默认几分钟
- `inbox_after_sec` 默认更久

### 3. inbox_escalated 已经写进 SQLite
`sqlite3 ~/.agora/agora.db`:
```
event:
  inbox_escalated
  roster_pinged
  controller_pinged
  state_changed
```

**已经在生产数据里** — 不是空钩子。

### 4. SSE `/api/events/stream` 已经推 inbox_escalated
**位置**: `app.ts:5165-5230`

flow_log 每个 row 都被 push 为 `event: tick`, `type: entry.event`:
```
{ seq, type: 'inbox_escalated', task_id, state, stage_id, detail: {idle_ms, ...}, ... }
```

**Plugin 端 v2.0 真正的实现**:
```ts
if (evt.type === 'inbox_escalated' && evt.detail?.kind === 'inbox_escalated') {
  await postStuckAlert(evt.task_id, evt.detail.idle_ms, ...)
}
```

### 5. 没有 task-level retry endpoint
- `/api/archive/jobs/:id/retry` 存在但只给 archive jobs
- 没有 `/api/tasks/:id/retry` 或 `/api/tasks/:id/reassign`

**结论**: v2.0 不做 auto-reassign — 自创 endpoint = 动 Core = §1 禁止

## 真实 v2.0 范围

| 块 | 在哪 |
|---|---|
| v2.0.1 stuck alert | **plugin** |
| v2.0.2 /agora stuck | **plugin** |
| ~~v2.0.3 auto-reassign~~ | Core, §1 禁止 |

## §1 边界确认

- v2.0.1: plugin 订阅 SSE inbox_escalated → 发消息。**Core 不动**。
- v2.0.2: plugin 调 GET /api/events (已有) → filter by event === 'inbox_escalated' → 渲染。**Core 不动**。

## 待澄清 (resolved by v2.0.1 plan)

- ✅ 怎么判断 stuck: Core 已判 (inbox_escalated type)
- ✅ 怎么获取 idle_ms: `evt.detail.idle_ms` 在 SSE payload 里
- ✅ dedup 策略: 内存 Set (post-mortem 同模式)
- ✅ 不重试: 不做 — §1.5 诚实判断

## 未决 (留给未来 Core 改动)

- ❌ auto-reassign (需 Core endpoint)
- ❌ escalation dashboard
- ❌ Cross-channel mirror (Slack/Discord)