# task_plan.md — v1.0 war room advanced (plugin-only)

**Date:** 2026-08-29
**Author:** dsh-agent
**Status:** 设计 → 2 commit (v1.0.1 + v1.0.2)
**Branch:** `feat/v10-war-room-advanced` (forked from `feat/dsh-matrix-connector@0bed4fb`)
**Worktree:** `/home/ailink/dsh-agora/.worktrees/feat-v10-war-room-advanced/dsh-matrix-connector/`

## §1.5 决策回顾

**turn 45 first-principles review 结论**:

v1.0 完整愿景（卡住自动呼叫别的 agent）是 **orchestration 概念** — 属于 Core 不是 plugin。**不在 plugin 范围**。

可做的（plugin-only）：
- v1.0.1: 跨房间汇总 panel（org chart 视图）
- v1.0.2: artifact 摘要自动回投房间

## v1.0.1 — cross-room rollup panel

### 行为
当一个 room 有 ≥1 active task 且 SSE tick 触发 → 每 N 秒（默认 30s）拉一次"全局视图"：
```
[org war room] 今日 N 个房间活跃
  #project-phoenix: 3 tasks (2 active, 1 done)
  #code-review: 1 task (1 active)
  #bug-triage: 0 tasks
```

发到 **第一个有 active task 的 room**（避免 spam）或 **DM room by config**。 §1.5: 不创建"global channel"。

### 简化决定（§1.5 最短路径）
- **不发到所有 rooms** — 只发到 `/agora rollup` 命令显式调用的 room
- 这把 v1.0.1 从 "push" 变成 "pull on demand" — 简单很多
- 命令 `/agora rollup` → 列所有 active tasks + 所有 rooms → 渲染一张视图

### 实现
- `RollupBridge` 接收 task list (从 ThreadRegistry) + citizen list + room list
- 渲染 markdown 摘要
- 走 v0.1.1 `/agora` slash command 已有的 "task" verb → 新加一个 "rollup" verb

### 测试
- `rollup.test.mjs`: 给定 mock data 渲染正确
- plugin-flow 加测试 `/agora rollup` 调用走 RollupBridge

## v1.0.2 — artifact 摘要自动回投

### 行为
当 task 跑完（v0.3.1 post-mortem 触发），自动拉每个 artifact 的**前 1KB 摘要**（不是全文），拼到 post-mortem 消息里：

```
[agora post-mortem] task `OC-1787934650636`
  executor: @code-reviewer
  artifacts (2):
    - patch.diff (text/plain, 1234 bytes) — first 240 chars:
      "diff --git a/api/error.ts b/api/error.ts..."
    - log.txt (text/plain, 567 bytes) — first 240 chars:
      "ok task ran 47s, no errors"
```

### §1.5 简化
- 只**前 240 字符**（不是全文）
- 只**text 类型** — image/binary 直接说"(binary, not shown)"
- 走 v0.3.1 post-mortem path — 修改 `PostMortemTaskRecord` 加 `artifact_summaries?: string[]`

### 实现
- `ArtifactBridge.summarize(artifactId, maxChars=240)`: 拉前 N 字节 + decode UTF-8
- 注入 `post-mortem.ts` 渲染逻辑

### 测试
- `artifact-summarize.test.mjs`: 给 stub bytes 返正确摘要
- post-mortem 测试加 case: artifact 有内容时 summary 出现

## 验收

- [ ] 72/72 v0.3 tests 仍绿
- [ ] 2 commit 各 3-5 new tests 绿
- [ ] 2 smoke PASSED (rollup 真 GET events, artifact summarize 真拉 bytes)
- [ ] master chain clean
- [ ] walkthrough + progress

## 不做 (留给 v1.1+)

- ❌ 跨房间 push panel（v1.1, 需 new Core signal）
- ❌ artifact 全文 upload 到 Matrix（v1.1, plugin 已有 uploadMxc）
- ❌ 卡住自动呼叫别的 agent（v2.0, Core orchestration feature）
- ❌ 跨房间 issue 总线（v2.0+, 需 project 概念）

## 实施顺序

1. v1.0.1 rollup (slash command + rollup bridge + tests + smoke) → commit
2. v1.0.2 artifact summarize (artifact bridge + post-mortem 渲染 + tests + smoke) → commit
3. walkthrough + progress (master)
4. merge + cleanup