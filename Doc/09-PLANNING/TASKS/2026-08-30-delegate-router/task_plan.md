# Task Plan: DelegateRouter (org-aware-work-os S3)

> 日期: 2026-08-30 · 蓝图: 02-task-claiming §2.2 流程 4-5 · worktree: .dsh/workspaces/delegate-router (feat/delegate-router)

## 设计

- core `DelegateRouter` (依赖 OrgHierarchyResolver 语义 + ITeamRepository):
  - `delegateSubtree({teamId, taskId, fromRef?})`: 子树全员委派 (排除 fromRef); 深度 = team 距根链长, 超 maxDepth(默认 4) 拒; 环检测 (parent 链 visited) 拒
  - `escalateUp({agentRef, taskId})`: leadsAbove 第一个 lead 上报路由
  - notify 端口: `IMMessagingPort.sendNotification` 形状 (targetRef + {event_type, data}), 可选注入; CLI 默认无 IM 通道 → 输出 recipients (Phase 6 绑定, 同 S5 D4)
- cli: `agora delegate subtree --team --task [--from]` + `agora delegate escalate --agent [--task]`
- 事件: `task_delegated` / `task_escalated`
