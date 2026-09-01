# Progress

## 2026-09-01

- 已读取 `AGENTS.md`、Core 解耦、执行工作流、测试标准、Agora SSoT 及相关组织/陪伴/Matrix 架构文档。
- 已建立 Agora 与 Matrix connector 独立 worktree，provider 源码不在本阶段修改范围。
- 计划已锁定，开始 A/B/C 实现。
- Core workspace build 通过；新增 migration 050、终态记忆 fingerprint/幂等服务、Routine 租约服务、server REST 和 CLI `routine` 命令。
- Core memory/routine tests 3/3、DB routine repository test 1/1、server route test 1/1 通过。
- Matrix connector 新增 `task collab|timeline|context`、绑定房间普通消息回流和 REST timeline/conversation client；`npm test` 292/292、build 通过。
- 已完成 Architecture README、walkthrough、Agora/connector SSoT 回写；Agora `3bdf458` 与 connector `de0c547` 已提交并推送到各自主分支。
