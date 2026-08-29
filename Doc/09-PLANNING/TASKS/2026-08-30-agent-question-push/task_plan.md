# Task Plan: Agent Question Push (org-aware-work-os S5)

> 日期: 2026-08-30 · 来源: 用户愿景 "主动向我要东西" + checklist.md S5
> 蓝图: Doc/03-ARCHITECTURE/org-aware-work-os/04-proactive-push.md

## Worktree

- 路径: `.dsh/workspaces/agent-question`
- 分支: `feat/agent-question-push`（基于 develop 3f54c41）

## 目标

Agent 遇到歧义/缺资源/需确认时**主动发问**给"助手"（优先）或"CEO"（升级），问题有状态机、有 IM 推送缝、有 CLI 入口。这是用户愿景 S5 的核心。

## 设计（按 §1.5 最短路径）

- 状态机: `pending → answered | escalated → answered；answered/pending/escalated → closed`
- 路由: `routeQuestion` 纯函数 — 配置了 assistantRef → target=assistant，否则 → ceo；escalate() 强制 target=ceo
- kind: clarify / resource / approval / info / research（escalation 是状态不是 kind）
- **ResearchRequestService 不单独建**（对照蓝图修正）: research 作为 kind + answer 承载结果，避免过度设计；findings 记录该偏差
- IM 推送: 注入可选 `IMMessagingPort`（已有 im-ports.ts 端口），create/escalate 时推送通知；answer 不回推（agent 用 list/show 轮询，§1.5 不加额外回推机制）
- `packages/core` 零平台名: 只有 targetRef 字符串与端口注入

## 轮次

| 轮 | 内容 | 状态 |
|---|---|---|
| R1 | contracts: AgentQuestionRecord + IAgentQuestionRepository (section 31) | pending |
| R2 | core: routeQuestion + AgentQuestionService + TDD | pending |
| R3 | db: migration 037 + AgentQuestionRepository | pending |
| R4 | core index 导出 + CLI `agora ask {create,list,show,answer,escalate,close}` + 全量回归 | pending |
| R5 | 真实冒烟（隔离 HOME）+ merge + 回写 | pending |

## 未决引用

- U2 助手形态（agent or 人）→ 默认 assistantRef 可配置，不阻塞
- approval 类问题是否升级 Dashboard 门控 → 本轮不做，findings 记录
