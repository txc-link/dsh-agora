# 02 — 主动任务接取（常驻 agent 轮询 + 职责匹配 + 认领 + 委派）

> 子能力 S2 + S3（用户 turn 159 原话："指定某几个常驻 agent，定期查看任务台，对应职责的 agent 接取对应任务，委派，然后往群组发，让下面的 agent 执行"）
> 日期: 2026-08-30

## 1. 现状

| 已有 | 文件 | 说明 |
|---|---|---|
| 任务创建 | `task-service.ts` / CLI `agora task create` | 被动创建 |
| 任务广播 | `task-broadcast-service.ts` | 任务状态变化 → IM 广播 |
| 评分路由 | `coordination-service.ts` (scorecard) | 历史分 + 负载 → 候选排序 |
| 委派 | `task-craftsman-service.ts` / subtask | 任务分解成 subtask |
| A2A | `contracts/src/a2a.ts` | agent 间消息 |

| 缺失 | 说明 |
|---|---|
| **任务台轮询调度器** | 没有"常驻 agent 定期查看未认领任务"的机制 |
| **职责匹配认领** | 没有"按 agent 角色/职责 → 匹配任务类型 → 认领" |
| **委派路由** | 没有"按组织架构 → 委派给下级 agent"的自动路由 |
| **往群组发** | 有广播但没按群组/职责定向 |

## 2. 设计

### 2.1 概念模型

```
任务台 (Task Board) = 所有 pending/ready 任务的视图
  ├── 常驻 agent (Resident Agent) = 配置了轮询的 agent
  │     ├── 角色 (Role) = 职责声明, e.g. { role: 'dev', skill: ['typescript'] }
  │     └── 认领 (Claim) = agent 把任务从台子拿走的动作
  └── 委派 (Delegate) = 认领后按组织架构分给下级执行
```

### 2.2 核心流程

```
1. [定时] ResidentAgentPoller 每 N 分钟扫任务台
2. [匹配] TaskClaimMatcher 按 agent 职责 ↔ 任务类型/标签 匹配
3. [认领] 匹配到的 agent 认领任务 (task claim)
4. [委派] DelegateRouter 按组织架构把 subtask 委派给下级 agent
5. [群发] TaskBroadcastService 把委派结果发到对应群组
6. [执行] 下级 agent 执行 → 上报 → 完成
```

### 2.3 新组件（规划）

| 组件 | 职责 | 位置 |
|---|---|---|
| `ResidentAgentPoller` | 定时轮询任务台（cron / setInterval） | `core/src/` |
| `TaskClaimMatcher` | 职责 ↔ 任务匹配（role / skill / tags） | `core/src/` |
| `TaskClaimService` | 认领 / 释放 / 认领状态 | `core/src/` |
| `DelegateRouter` | 组织架构 → 下级 agent 委派 | `core/src/` |
| CLI: `agora poll` / `agora claim` / `agora delegate` | agent 操作入口 | `apps/cli/` |

### 2.4 与现有服务的关系

- 复用 `TaskService`（读任务）+ `TaskBroadcastService`（群发）+ `CoordinationService`（评分）
- 新增 `TaskClaimService` 作为认领状态机（pending → claimed → delegated → executing）
- 职责匹配用 `RolePackService` 的角色定义 + citizen 的 skills_ref

## 3. 验收

1. 配置一个常驻 agent（含 role/skill）→ 定时轮询任务台
2. 新建匹配其职责的任务 → agent 自动认领
3. 认领后按组织架构委派给下级 → 群组收到委派通知
4. 下级执行完成 → 任务状态回写

## 4. 未决

- 轮询间隔配置（默认 N 分钟？）
- 多个 agent 同时匹配同一任务 → 竞争策略（先到先得？按 scorecard？）
- 委派深度（几级？）
- 认领后超时未执行 → 释放策略

## 5. 实施记录（2026-08-30, develop `505ce4d`）

**已实现**（TDD 33 新测试 + core/db 回归 592/592 + 真实冒烟 8/8）:

| 设计组件 | 实现 | 文件 |
|---|---|---|
| TaskClaimService | ✅ claim/release/expire | `core/src/task-claim-service.ts` |
| TaskClaimMatcher | ✅ matchTaskToAgent (skills_ref ↔ skill_policy, enforcement 语义) | `core/src/task-claim-matcher.ts` |
| ResidentAgentPoller | ✅ 轮询 + 匹配 + 自动认领 (deps 注入) | `core/src/resident-agent-poller.ts` |
| CLI | ✅ `agora claim {create,release,list,claimable}` | `apps/cli/src/index.ts` + `core/src/task-claim-command.ts` |
| 存储 | ✅ migration 036_task_claims + TaskClaimRepository | `db/src/` |
| 契约 | ✅ TaskClaimRecord + ITaskClaimRepository (contracts section 30) | `contracts/src/repository-interfaces.ts` |

**实施修正**（对照真实生命周期）:
- claimable 状态过滤 = created + **active**（`agora create` 新任务直达 active, 不滞留 created）
- 竞争策略 = 先到先得（claim 原子写入, 重复认领明确报错）
- 超时释放 = claim 带 expiresAt（--ttl-ms）, `expire()` 状态机支持; poller 周期性 expire 未排本轮

**未做（下一轮）**: DelegateRouter（组织架构 → 下级 agent 委派路由, 见 01-org-model.md）
