# 01 — 组织模型（团队 / 角色 / 职责 / 委派链）

> 子能力 S1（用户 turn 159 原话："既然有组织架构，就可以指定某几个常驻 agent"）
> 日期: 2026-08-30

## 1. 现状（Core 已实现的组织能力）

| 服务 | 文件 | 职责 |
|---|---|---|
| `CitizenService` | `core/src/citizen-service.ts` | 公民定义（display_name / persona / boundaries / skills_ref / channel_policies / runtime_projection） |
| `ProjectMembershipService` | `core/src/project-membership-service.ts` | 项目成员（admin / member） |
| `ProjectAgentRosterService` | `core/src/project-agent-roster-service.ts` | agent_ref → kind (controller / craftsman) |
| `RolePackService` | `core/src/role-pack-service.ts` | role pack 管理 |
| `team-member-kind.ts` | `core/src/team-member-kind.ts` | controller / craftsman / citizen 分类 |
| `TaskParticipationService` | `core/src/task-participation-service.ts` | 任务参与关系 |
| `StageRosterService` | `core/src/stage-roster-service.ts` | 阶段名册 |

## 2. 用户愿景对应的组织形态

```
CEO (用户, 董事)
  └── 助手 (assistant agent) — 挡大部分事情
        ├── 常驻 agent A (职责: 开发/Dev)
        │     └── 下级 agent A1 / A2 (执行)
        ├── 常驻 agent B (职责: 调研/Research)
        │     └── 下级 agent B1 / B2
        └── 常驻 agent C (职责: 运维/Ops)
              └── 下级 agent C1
```

### 角色示例

```ts
// 常驻 agent = 有"职责声明"的 citizen
const devLead = {
  name: 'dev-lead',
  role: 'team-lead',
  responsibility: 'dev',        // 职责域
  skills: ['typescript', 'node'], // 技能
  reportTo: 'assistant',          // 上级
  subordinates: ['dev-worker-1', 'dev-worker-2'],  // 下级
};
```

## 3. 现有能力映射

| 组织概念 | 现有 Core | 差距 |
|---|---|---|
| 公民 (citizen) | ✅ CitizenService | 无 |
| 角色 (role) | ✅ RolePackService | 无 |
| 成员 (membership) | ✅ ProjectMembershipService | 无 |
| agent 分类 | ✅ team-member-kind (controller/craftsman) | 无 |
| **团队/部门 (team)** | ⚠️ roster 有 kind，无"team 聚合" | 缺 team 聚合模型 |
| **上下级 (reportTo)** | ❌ | 缺组织层级 |
| **职责域 (responsibility)** | ⚠️ skills_ref 有技能，无职责域 | 缺职责声明 |
| **委派链** | ⚠️ subtask 有，无按层级路由 | 缺委派路由 |

## 4. 设计（规划）

### 4.1 Team 聚合模型

```ts
interface Team {
  id: string;
  name: string;
  lead: string;             // team lead agent ref
  members: string[];        // member agent refs
  responsibility: string[]; // 职责域
  parent?: string;          // 上级 team / assistant / ceo
  project_id: string;
}
```

### 4.2 组织层级

- `Organization` = 根（用户 = CEO）
- `Team` = 组织下分组（开发/调研/运维）
- `Citizen` = 成员（常驻 agent 或执行 agent）
- `reportTo` = 委派链（assistant → team lead → worker）

### 4.3 新增组件（规划）

| 组件 | 职责 |
|---|---|
| `TeamService` | 团队 CRUD + 成员 + 层级 |
| `OrgHierarchyResolver` | reportTo / subordinates 解析（委派路由用）|
| `ResponsibilityMatcher` | 职责域 ↔ 任务类型匹配（S2 用）|
| CLI: `agora org` / `agora team` | 组织配置入口 |

## 5. 验收

1. 创建 org（CEO = 用户）→ team（dev/research/ops）→ citizen（常驻 agent）
2. 配置 reportTo 层级（assistant → lead → worker）
3. 委派时按层级路由（S2/S3 联调）

## 5.5 实现记录（2026-08-30, develop `090ca6d`）

- Team 聚合: `org_teams` 表 (migration 038, unique project+name) + `TeamService`
- 层级: team parent 链即委派链; `OrgHierarchyResolver` 提供 chainToRoot / leadsAbove / subtreeAgents / orgTree
- CLI: `agora team` (CRUD+成员+层级) + `agora org show|chain`
- 未决默认拍板: ProjectMembership **并存**; 存储 **SQLite org_teams**; **每项目一个 org**; 助手形态仍 U2

## 6. 未决

- 现有 ProjectMembership (admin/member) 与 Team 的关系（并存 or 统一）
- "助手"作为特殊 agent 类型的定义
- 组织配置存哪（SQLite 表？config 文件？）
- 多项目共享 org 还是每项目一个 org
