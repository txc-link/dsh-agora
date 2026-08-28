# task_plan.md — v0.3 war room (3 commits)

**Date:** 2026-08-29
**Author:** dsh-agent
**Status:** 设计 → 3 个 RED/GREEN/smoke 循环
**Branch:** `feat/v03-war-room` (forked from `feat/dsh-matrix-connector@c4bff9e`)
**Worktree:** `/home/ailink/dsh-agora/.worktrees/feat-v03-war-room/dsh-matrix-connector/`

## 目标 — 房间变成 agent 军机处

3 块独立 commit,每个都可独立回滚:

1. **v0.3.1 post-mortem** — SSE tick 触发 task status pull, 摘要发回房间
2. **v0.3.2 room roster** — `/agora dispatch <name>` 用房间成员解析
3. **v0.3.3 status panel** — 每房间一条聚合 status 消息, SSE tick 后 edit

## §1 边界检查

- **Core 不动**: agora 端 schema 已有 `state`, `subtasks[].output`, `artifacts[]`
- **§1.5 最短路径**: 3 块都用现有 SSE tick + existing endpoint (GET /api/tasks/:id, GET /rooms/:id/joined_members), 零新 server endpoint
- **threadKey 不出 wire**: assert 在每个 smoke

## 关键事实 (来自 findings.md)

1. **`task.state` 真实值只有 `created` / `active`** — quick 任务不会自动 `completed`
2. **真正的"完成"在 `subtasks[].status`** + `subtasks[].output` — quick 任务会派 1 个 subtask, 完成后 output 有内容
3. **TaskRecord 没有 `result` 字段** — post-mortem 数据来源 = `subtasks[].output` + `artifacts[]`
4. **Matrix `/rooms/{id}/joined_members`** 返回房间成员列表 — 包括非人类 bot
5. **Room roster 解析**: 拿 room 成员 mxid, 匹配 `@<bot>:domain` 的 localpart = `agentId`

## v0.3.1 — post-mortem

### 行为
SSE tick `event: tick` 携带 task_id. plugin 维护一个 in-memory 缓存:
- 每次 tick 后 1s 内用 `taskBridge.show(taskId)` 拉完整 task
- 如果 subtasks 全部 done 或任意 subtask 有 output → 发摘要消息
- 同一 task 只发 1 次 (用 `taskId → posted` 集合去重)

### 摘要内容
```
[agora post-mortem] task OC-1787934650636
  state: active (subtask complete in 12s)
  subtasks: 1/1 done
  output: "<last 200 chars of subtasks[0].output>"
  artifacts: <count> uploaded
```

### 测试
- mock agora: tick → taskBridge.show 返 stub
- assert: 1 条 message sent with format above
- assert: 同一 task_id tick 第 2 次不发

## v0.3.2 — room roster resolver

### 行为
解析 `/agora dispatch <name> <prompt>`:
- 拿房间 roster → member localparts list
- 在 case 2/3 加 case 4: name 在 roster 唯一匹配 (exact + prefix) → citizen_id = match

### 测试
- mock matrix.joinedMembers 返 3 个 bot
- /agora dispatch reviewer 审 PR → 解析到 code-reviewer (唯一 prefix)
- /agora dispatch 审 PR → 解析到 code-reviewer (唯一 exact)
- /agora dispatch foo 审 → 找不到 (无 prefix match)
- /agora dispatch rev 审 → 多个 prefix match → 报错让用户精确

## v0.3.3 — status panel

### 行为
每房间一条 panel message:
- plugin 维护 `roomId → panelEventId` 映射
- 首次 SSE tick 触发 dispatch 后 → 发新 panel
- 后续 tick → edit panel

Panel 内容:
```
[war room] tasks in this room:
 ⏳ OC-1787934... (executor:code-reviewer, 47s, stage:execute)
  ✅ OC-1787933... (executor:haiku, 22s, output: "...")
  ▶ OC-1787932... (executor:tester, 12s, stage:execute)
```

### 测试
- 模拟 SSE tick for 3 tasks in same room → 1 panel created + 2 edits
- 模拟 SSE tick for 0 tasks → 无 panel 发

## 不做

- 多 room 共享 panel
- panel 按 room title 命名
- 持久化 panel eventId (重启会重新创建)

## 验收

- [ ] 55/55 v0.2b tests 仍绿
- [ ] 3 块各 3-5 新 tests, 全部绿
- [ ] 3 块各 1 smoke, 全部 PASSED
- [ ] master chain clean
- [ ] walkthrough + progress.md

## 实施顺序

1. v0.3.1 → commit → smoke → merge master
2. v0.3.2 → commit → smoke → merge master
3. v0.3.3 → commit → smoke → merge master
4. walkthrough + progress

合并前不破坏 v0.2b 行为 (zero regression)。