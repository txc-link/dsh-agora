# CLI create 通知补全（undecided 收口）

- worktree: .dsh/workspaces/cli-notify | 分支: feat/cli-create-notify
- 背景: task_created 自动通知挂在 server REST; CLI `agora create` 直写共享中央 db 时未写 outbox 行 → CLI 场景无通知。server 周期扫描是唯一扫描者（单一扫描者原则, 避免双端重复推送）→ 最短闭环 = CLI create 也写 outbox 行, 推送由 server 60s 扫描兜底。
- 开关: 同 im.*.notify_on_task_create（CLI composition config）
- 状态: [x] TDD [x] build/gates/回归 [x] 冒烟 [x] merge+回写
