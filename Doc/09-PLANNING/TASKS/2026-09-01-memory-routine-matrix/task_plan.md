# 任务计划：记忆总结、人格例行与 Matrix 协同

## 目标

在不修改任何 DSH/provider 源码的前提下，补齐三个可验证的用户闭环：

1. 任务终态自动生成团队/Agent 记忆摘要，并支持幂等重跑；
2. 角色的人格配置可版本化复用，长期例行可持久化、到期领取、交付回执；
3. Matrix 房间能把同一任务的线程上下文、参与者、阶段和下一步动作一次性呈现，并提供显式协同命令。

## 工作树

- Agora：`E:\Learn AI Agent\dsh-agora\.worktrees\memory-routine-matrix`
- 分支：`feat/memory-routine-matrix`
- Matrix connector：`E:\Learn AI Agent\dsh-matrix-connector\.worktrees\memory-routine-matrix`
- 分支：`feat/memory-routine-matrix`

## 交付切片

- [x] A. Core/contracts/db：任务记忆摘要服务与自动扫描；
- [x] B. Core/contracts/db/server/CLI：通用例行定义与 durable run outbox；
- [x] C. Matrix adapter：协同上下文命令、线程摘要、参与者交接提示；
- [x] D. 测试、SSoT、架构文档、walkthrough、构建与质量门；
- [x] E. 两仓提交并推送远程。

## 约束

- Core 不引入 Matrix、OpenClaw、Hermes、Mem0 或具体 TTS/provider 名称；
- 人类确认仍只走 Dashboard 登录态；
- 例行只生成 provider-neutral run，真实投递由现有 adapter/connector 消费；
- 全部新增状态必须可审计、可幂等、重启可恢复。
