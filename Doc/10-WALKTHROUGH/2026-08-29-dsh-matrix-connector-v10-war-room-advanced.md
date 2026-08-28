# 2026-08-29 — dsh-matrix-connector v1.0 war room advanced

## Outcome

| | |
|---|---|
| Goal | plugin-only war room 高级能力（rollup + artifact summary） |
| Scope | plugin 端 only; agora 中央零改动 |
| Commits | `df725b1` (v1.0.1) + `9bf98c8` (v1.0.2) → merged `477f19a` |
| Worktree | `.worktrees/feat-v10-war-room-advanced/` — created, used, removed |

## §1 边界保持 — 关键 review 决策

**turn 45 first-principles review**（载入 aegis first-principles-review skill）确认：

| 候选能力 | 归属 | 进入 v1.0? |
|---|---|---|
| 跨房间汇总 panel | plugin (read-only) | ✅ v1.0.1 |
| artifact 摘要回投 | plugin (read-only) | ✅ v1.0.2 |
| 卡住自动呼叫别的 agent | Core (orchestration) | ❌ **超出 plugin 授权范围** |
| 跨房间 push panel | hybrid | ❌ 需 new Core signal |

**§1 关键判断**: "卡住自动呼叫"听起来诱人但是 orchestration 概念 — 它要触发 task lifecycle 变化（重新派发、超时 kill），属于 agora Core 不属于 IM adapter。**我没有越权做**。

## v1.0.1 — /agora rollup

### 行为
用户在任意 room 发 `/agora rollup` → bot 渲染一张跨房间总览：

```
[org war room] today's org-wide activity:
 2 room(s), 3 task(s)

Per-room:
 !alpha:hs: 2 task(s) (1 active, 1 done)
 !beta:hs: 1 task(s) (1 active, 0 done)

Per-task:
 OC-1  @reviewer  state=active  room=!alpha:hs
 OC-2  @coder     state=done    room=!alpha:hs
 OC-3  @tester    state=active  room=!beta:hs
```

### §1.5 简化决定
- **on-demand** (slash 命令触发)，不 push - 简单很多
- 数据源：**plugin 内存里 ThreadRegistry** (this instance has seen)，不是 agora 中央
- 含义：plugin 重启后只显示**新见到的** room/task（不持久化跨重启）

### 实现
- `src/rollup.ts` 纯 `renderRollup({rooms, tasks})`
- `ThreadRegistry` 加 `rememberRoom` / `rememberTask` / `knownRoomIds` / `taskSummaries`
- `index.ts` 在 `handleRoomMessage` 入口 + `handleAgoraEvent` tick 时记录
- `message-router.ts` 加 `'rollup'` verb

## v1.0.2 — artifact 摘要自动回投

### 行为
v0.3.1 post-mortem 消息体现在带 artifact 摘要：

```
[agora post-mortem] task `OC-1787934650636`
  executor: @code-reviewer
  state: active
  subtasks: 1/1 done
  output: ...
  artifacts: 2 uploaded
artifacts (2):
 - patch.diff (text/plain, 1234 bytes)
   <前 240 字符>...
 - screenshot.png (image/png, 9999 bytes)
   (binary, content not shown)
```

### §1.5 简化决定
- **只前 240 字符**（不是全文）
- 只**text 类型** — image/binary 直接说 "(binary, not shown)"
- 走 v0.3.1 post-mortem path — 改 `PostMortemTaskRecord` 加 `body?`
- artifactLoader 通过**注入 callback**（不是 plugin 内硬编码）— 留给以后换 LLM-summary 余地

### 实现
- `src/artifact-summary.ts` 纯 `summarizeArtifacts([...])`
- `post-mortem.ts` 加 `artifactLoader?: (id) => Promise<string|undefined>`
- `index.ts` 传 `artifactBridge.fetchBytes` (decode UTF-8)

## 验证

- **83/83 unit tests green** (v0.3 72 + rollup 5 + artifact-summary 5 + post-mortem 更新 1)
- **2 smokes** PASSED
- §1 边界: threadKey 永远不出 wire

## v1.0 完整概览（plugin 部分）

| | |
|---|---|
| v1.0.1 rollup | 跨房间只读视图 |
| v1.0.2 artifact summary | 摘要回投 (240 chars) |

## v2.0+ 留给 Core orchestration

- **v2.0 stuck auto-reassign**: Core 加 stuck detection (state machine `stuck_for_ms`); emit `agora.task.stuck` 事件; plugin 转发到房间 + Core 自动 `reassign` task
- **v2.0 cross-room push panel**: Core 加 `agora.room.broadcast` signal
- **v2.0 issue 总线**: 需 project 概念（独立任务，§2 entry surface）

这些需要 §2 design decision（orchestration 由谁触发？），**不在这份 plugin 任务范围**。

## Architectural locks（carry forward）

- matrix room = 第二 IM 入口，与 cc-connect 并行
- threadKey 对 agora 中央不透明（plugin 私有）
- §1 三层口径不变：plugin 投影, Core orchestration, runtime adapter
- v0.x → v1.x → v2.x 严格按 §1.5 推进：先 plugin-only，能不动 Core 就不动