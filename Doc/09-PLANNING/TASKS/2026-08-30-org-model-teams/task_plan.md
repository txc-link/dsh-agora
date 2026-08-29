# Task Plan: Org Model — Teams + Hierarchy (org-aware-work-os S1)

> 日期: 2026-08-30 · 蓝图: 01-org-model.md · worktree: .dsh/workspaces/org-model (feat/org-model, 基于 7196922)

## 未决项默认拍板（§1.5, 非用户级未决）

- ProjectMembership vs Team: **并存**（项目级权限 vs 组织聚合, 语义不同）
- 组织配置存储: **SQLite 表 org_teams**（migration 038, 与 claim/question 同模式, SSoT 单一）
- 多项目: **每项目一个组织**（team.project_id）
- 助手形态: U2 保持用户拍板, assistantRef 已由 S5 解耦, 不阻塞

## 交付

- contracts §32: TeamRecord/ITeamRepository
- db: migration 038_teams.sql (unique project+name) + TeamRepository
- core: TeamService (create/member/lead/parent/delete + 环守卫 + lead 必须 member + 有子不可删) + OrgHierarchyResolver (chainToRoot/leadsAbove/subtreeAgents/orgTree)
- cli: `agora team create/list/show/add-member/remove-member/set-lead/set-parent/rm` + `agora org show/chain`
