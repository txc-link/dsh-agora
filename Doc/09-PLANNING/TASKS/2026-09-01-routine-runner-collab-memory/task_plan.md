# 任务计划：RoutineRunner、Matrix 协同轮次与结构化记忆

## 目标

在不修改 DSH、OpenClaw、Hermes 等 provider 源码的前提下，把现有三条能力补成可执行闭环：

1. Routine 从 durable run 变成可重放的 provider-neutral runtime dispatch；
2. Matrix 任务房间支持点名唤醒、有限轮次和 bot 循环抑制；
3. 终态任务总结支持结构化事实、决策、经验、未解决项，并保留确定性 fallback。

## 工作树

- Agora：`E:\Learn AI Agent\dsh-agora\.worktrees\phase-routine-runner-collab-memory`
- Agora 分支：`feat/phase-routine-runner-collab-memory`
- Matrix Connector：`E:\Learn AI Agent\dsh-matrix-connector\.worktrees\phase-routine-runner-collab-memory`
- Connector 分支：`feat/phase-routine-runner-collab-memory`

## 交付切片

- [x] A. Core：RoutineRunner 端口、租约执行、幂等、失败重试和 dispatch 结果回写；
- [x] B. Matrix adapter：显式 @/角色点名、协同轮次元数据、冷却和最大轮次；
- [x] C. Core memory：结构化摘要 provider 端口、脱敏元数据、质量字段和兼容 fallback；
- [x] D. 聚焦测试、workspace build、connector build/test、跨仓协议检查；
- [x] E. SSoT、architecture、walkthrough 回写并提交推送。

## 约束与验收

- Core 不导入 Matrix、Element、DSH、OpenClaw、Hermes 或具体 TTS 名称；
- Connector 不复制任务/组织权威状态，只调用 Core REST；
- 任务和 routine run 必须支持幂等、租约 fencing、重启恢复；
- Agent 默认不因普通 bot 消息递归唤醒，只有显式点名或协调计划触发；
- 结构化总结失败时保留 pending/failed 记录，不丢原始 conversation；
- 任何外部副作用仍受已有 ActionRisk/Human Gate 约束。
