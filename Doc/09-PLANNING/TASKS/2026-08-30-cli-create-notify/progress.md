# progress — CLI create 通知收口

- worktree: .dsh/workspaces/cli-notify (feat/cli-create-notify → develop 7dc4d3a, worktree 已删)
- TDD: 2 集成测试(开/关) → 回归 1425/1425 + 双 gate ✅
- 冒烟: CLI 直连 live 中央库 create → outbox 35s delivered → 组织房间实测推送 ✅
- 发现: worktree 里 agora-ts/.agora 路径是 index 中的怪条目(gitlink), add -A 需排除; 已用显式路径 add
- undecided 状态: 已收口(设计取舍=单一扫描者原则, CLI 只写行)
