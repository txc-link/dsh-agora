# Progress — v0.1.1 Slash Command Smoke Closeout

**Date**: 2026-09-01 (Asia/Shanghai)

---

## P1. 验证证据

### P1.1 实测样本（CEO 收件箱）

| 命令 | 响应样本 / 指纹 | 通过判定 |
|---|---|---|
| `/agora task <id>` | 返回 task 状态 JSON（done / creator / type） | ✅ |
| `/agora task <id> artifacts` | 列出 `441f2302…-executive-deliverable` 形式产物 | ✅ |
| `/agora call join` | 返回 Element Call URL（token 为占位）| ⚠️（设计预期，等 LiveKit）|
| `/agora task transfer <id>` | 返回 "not implemented yet" 字面响应 | ✅（占位明确）|
| 自然对话 | "Dispatch claimed by runtime node" | ✅（DSH 本地 agent 处理）|
| `/agora calendar today` | HTTP 404 | ❌（agora-ts backend 缺路由）|
| `/agora doc show <id>` | HTTP 404 | ❌（agora-ts backend 缺路由）|
| `/agora say 语音测试` | `information policy not found` | ❌（agora-ts policy 未建）|

### P1.2 securityBoundary 实测指纹

- CEO 收件箱：所有 slash 命令正常响应 → 在白名单内 ✓
- node-home-linux：`/agora help` 无响应（不在白名单），但自然对话能正常回（"Dispatch claimed"）→ 自然对话不走 securityBoundary ✓

## P2. 完成步骤

- [x] P2.1 探索仓库 + SSoT + 现有 task_dir 模板（turn 24）
- [x] P2.2 task_plan.md 落地
- [x] P2.3 findings.md 落地（含 F1-F7 七条事实）
- [x] P2.4 progress.md 落地（本文件）
- [ ] P2.5 walkthrough 落地 `Doc/10-WALKTHROUGH/2026-09-01-v011-slash-command-smoke-closeout.md`
- [ ] P2.6 SSoT §1 row 8 + §7 entry 落地
- [ ] P2.7 gm_record securityBoundary 事件落地
- [ ] P2.8 双绑校验（task_dir ↔ walkthrough ↔ SSoT）

## P3. Backlog 转交

排进后续 phase（按 AGENTS.md §6 流程）：

| ID | 触发命令 | 范围 | 优先级 |
|---|---|---|---|
| B1 | `/agora calendar today` | agora-ts composition wire + REST + smoke | P0 |
| B2 | `/agora doc show <id>` | agora-ts core service + REST + smoke | P0 |
| B3 | `/agora say` | agora-ts information policy + connector fish-speech 配置 | P1 |
| B4 | `/agora call join` | connector LiveKit 部署 + 配置 | P2 |

每项触发时新建独立 task_dir + worktree + SSoT 段，本次只做记账。

## P4. 未决 / 风险

- **U1**：9 个白名单房间的精确名单未在实测报告中列出 → 后续需要时从 connector 配置 / 源码获取（暂不阻塞）。
- **U2**：fish-speech 服务 :8080 可达性未确认 → B3 触发时第一件事就是 probe + 配 connector。
- **U3**：LiveKit 部署属独立基础设施 → B4 不阻塞主流程但限制 `/agora call` 实际可用性。

## P5. 关联 walkthrough

`Doc/10-WALKTHROUGH/2026-09-01-v011-slash-command-smoke-closeout.md`（P2.5 落地后填入）
