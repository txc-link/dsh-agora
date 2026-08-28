# task_plan.md — v0.2b /agora dispatch <citizen_id>

**Date:** 2026-08-29
**Author:** dsh-agent
**Status:** 设计 → RED → GREEN → smoke
**Branch:** `feat/v02b-citizen-routing` (forked from `feat/dsh-matrix-connector@3c0d32c`)
**Worktree:** `/home/ailink/dsh-agora/.worktrees/feat-v02b-citizen-routing/dsh-matrix-connector/`

## 目标

让用户能在 Matrix 里发：
```
/agora dispatch @code-reviewer 帮我审 PR #42
```
→ agora 中央把 task 派给 `agentId=code-reviewer` 的 citizen。

之前 `/agora dispatch <prompt>` 只能建通用 quick task，由 agora 自己挑 agent。

## §1 边界检查

- **Core 不动**：agora 中央 `createTaskRequestSchema` 已经有 `team_override.members[]`，
  含 `agentId` / `member_kind: 'citizen'`。plugin 只**填充**这个字段。
- **不引入新概念**：plugin 解析 `@<citizen_id>` 前缀，调 `agora.createTask()` 传 `team_override`。
  schema 已支持，零 schema 改动。
- **§1.5 最短路径**：不写 citizen cache，不写 fuzzy match，
  不写"找不到就自动建 citizen"。**找不到直接报错** — 用户自己查 `/agora citizen list`。

## 范围

### 必须做
1. **plugin 端**：
   - `DispatchBridge.dispatch(args)`: 解析首个 `@<id>` token，剥出 citizen_id + 剩余 prompt
   - 构造 `team_override.members[]`：1 个 executor, `member_kind: 'citizen'`, `agentId: <citizen_id>`
   - placeholder 文案带 `[→ @citizen_id]` 前缀让用户知道派给谁
2. **plugin 端**：resolve citizen失败（route 404）→ 提示用户先跑 `/agora citizen list`
3. **plugin tests**：dispatch with citizen id / without citizen id / invalid format
4. **smoke**：真 dispatch + 看 task.team.members[0].agentId == 期望值

### 不做（v0.2c / v0.3）
- fuzzy citizen 名称匹配
- 多 citizen 协作 (team > 1 members)
- 默认 fallback executor（找不到 citizen 时）

## 设计 — args 解析格式

```
/agora dispatch <citizen_id_or_@mention> <prompt...>
```

解析规则：
- 第一个 token 形如 `@<id>` 或纯 `<id>` → 当作 citizen_id
- 第一个 token 不以 `@` 开头且不是数字开头字母结尾的纯字符串 → 走老路径（通用 dispatch）

边界：
- `/agora dispatch @code-reviewer 帮我审 PR #42`
  → citizen_id=`code-reviewer`, prompt=`帮我审 PR #42`
- `/agora dispatch 帮我审 PR #42`
  → citizen_id=`undefined`, prompt=`帮我审 PR #42` (老路径)

## 实施步骤

1. **RED tests**: `tests/dispatch-bridge.test.mjs`
   - `parseDispatchArgs(['@code-reviewer', '帮我审 PR'])` → `{citizen_id: 'code-reviewer', prompt: '帮我审 PR'}`
   - `parseDispatchArgs(['帮我审 PR'])` → `{citizen_id: undefined, prompt: '帮我审 PR'}`
   - `parseDispatchArgs([])` → 抛 'requires prompt'
2. **GREEN**: 在 bridges.ts 加 `parseDispatchArgs`, 改 `dispatch()` 接受 citizen_id
3. **typecheck** + **49/49 unit green**
4. **build lib/**
5. **smoke**: `tests/smoke-v02b-citizen-routing.mjs` 真 POST /api/tasks 带 team_override
6. **commit + merge + walkthrough**

## 验收

- [ ] 单元测试全绿 (含新增 dispatch-bridge tests)
- [ ] plugin build clean
- [ ] smoke 真创建 task，team.members[0].agentId == 'code-reviewer'
- [ ] master commit 链完整
- [ ] walkthrough + progress.md 更新

## 不做兼容性

按 §7 — 老路径 `/agora dispatch <prompt>` (无 `@` 前缀) 仍走原逻辑，零回归。