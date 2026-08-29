# Walkthrough — Org Teams + Hierarchy (S1)

> 日期: 2026-08-30 · develop `090ca6d`
> Planning: `Doc/09-PLANNING/TASKS/2026-08-30-org-model-teams/`

## 1. 交付

| 层 | 内容 |
|---|---|
| contracts | `TeamRecord` / `ITeamRepository`（§32; members/responsibilities JSON 存储） |
| db | migration `038_teams.sql`（unique project+name + parent 索引）+ `TeamRepository` |
| core | `TeamService`（create/member/lead/parent/delete; lead 必须 member; setParent 环守卫; 有子不可删）+ `OrgHierarchyResolver`（chainToRoot/leadsAbove/subtreeAgents/orgTree, 环安全） |
| CLI | `agora team {create,list,show,add-member,remove-member,set-lead,set-parent,rm}` + `agora org {show,chain}` |

## 2. 组织语义（蓝图 01 落地）

- Organization = 项目作用域（每项目一个 org）; Team = lead + members + responsibilities + parent; 委派链 = team parent 链
- `leadsAbove(agent)`: agent 所属 team → 根 的 lead 序列（近→远, 去重, 自身为 lead 的层不报自己）— S3 DelegateRouter 的路由依据
- `subtreeAgents(team)`: 子树全体成员（群发/下发用）

## 3. 验证

- TDD 13 新测试（repo 5 + service/resolver 8）; core+db 回归 **638/638**; build + 双 gate
- 冒烟 4/4: 三层 team 创建 + add-member → 环拒绝（干净错误）→ org show 树 → `org chain` 上报链 [dl, root]
- 踩坑: fake repo 字段名 snake_case vs service camelCase 不一致（vitest 不 typecheck 无报警）→ 已修并记录

## 4. 下一轮

S3 DelegateRouter（按 org 链路由 + 群发通知 + 环路检测）→ S6 反思论坛 → Phase 6。
