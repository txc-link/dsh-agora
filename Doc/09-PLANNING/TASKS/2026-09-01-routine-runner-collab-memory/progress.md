# Progress

## 2026-09-01

- 已读取 `AGENTS.md`、Agora SSoT、现有 memory/routine/matrix 架构文档。
- 已建立 Agora 与 Matrix Connector 独立 worktree，provider 源码不在本阶段修改范围。
- 已确认现有 Routine、Runtime Dispatch、Task Conversation 和 Matrix command 入口，开始 TDD 实现。
- 已完成 RoutineRunner：migration 051、dispatch 关联、结果/artifact/delivery 状态、失败投递重试、server route 与可选 runner timer。
- 已完成结构化记忆：provider port、deterministic fallback、facts/decisions/lessons/unresolved、confidence 和写入前脱敏。
- 已完成 Matrix 回合控制：显式 @role 唤醒、agent 普通消息抑制、cooldown、轮次上限、event 去重，并接入普通消息入口。
- 验证：Core focused 7/7、DB routine 2/2、Server route 1/1、workspace build、connector 295/295 + build；全套 DB 测试仍受 Windows 临时目录 EPERM 影响。
