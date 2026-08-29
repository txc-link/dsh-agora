# Task Plan: Org-Aware Task Claiming (S2 主动任务接取)

> 日期: 2026-08-30
> 任务: 让"常驻 agent 定期查看任务台 → 按职责匹配认领 → 委派 → 群发"
> 来源: 用户 turn 159 愿景 S2 + org-aware-work-os 蓝图 02-task-claiming.md
> Worktree: `/tmp/dsh-agora-wt-org-claim` (branch `feat/org-aware-task-claiming`)

## 目标

实现 3 个 Core 组件 + CLI 入口，让 agent 能主动认领任务：

1. **`TaskClaimService`** — 任务认领状态机 (pending → claimed → released)
2. **`TaskClaimMatcher`** — 职责 ↔ 任务匹配 (role/skill/tags)
3. **`ResidentAgentPoller`** — 定时轮询任务台 (cron/setInterval)

CLI: `agora task claim <id>` / `agora task claimable` / `agora task claims`

## 范围（本轮不做）

- ❌ 委派路由 (DelegateRouter) — 下轮
- ❌ 群发通知 — 复用 TaskBroadcastService 已有
- ❌ mem0 共享记忆 — Phase 4.5
- ❌ Matrix transport 真实化 — Phase 6

## 分轮

- **R1**: TDD TaskClaimService 状态机 + repository
- **R2**: TDD TaskClaimMatcher (职责匹配)
- **R3**: ResidentAgentPoller 定时轮询
- **R4**: CLI 命令 + 集成
- **R5**: 回写 (SSoT + walkthrough + 蓝图状态)

## 验收

1. 创建任务 → 未认领
2. 匹配职责的 agent 认领 → claimed
3. 不匹配的 agent 认领被拒
4. 重复认领被拒
5. 释放后回 pending
6. CLI 能列出可认领任务 / 认领 / 释放
