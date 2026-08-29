# Org-Aware Work OS — 公司化 agent 组织架构蓝图

> 来源: 2026-08-29 DSH 对话 (turn 158-163), 用户描述"公司化 agent 组织"愿景
> 日期: 2026-08-30
> 参与者: 用户 (CEO/董事 视角), 总工 (架构师 agent)
> 状态: **调研 + 蓝图确认中 — 未开始实现**

## 1. 用户愿景（原话要点）

> "既然有组织架构，就可以指定某几个常驻 agent，定期查看任务台，对应职责的 agent 接取对应任务，委派，然后往群组发，让下面的 agent 执行。一个群组的 agent 应该共享记忆、文档，应该可以主动向我要东西，可以主动调研，不需要我提醒，把我当成公司董事或 CEO，我有助手，很多事就不用找我，而是找我助手。agent 优化就是 agent 相互都可以反思进化，想办法把事情做的更好，他们可以发帖子，发技术论坛，所有 agent 可以向人一样随机查看、学习。"

### 愿景拆解（6 子能力）

| 子能力 | 用户原话 | 对应现有 agora 能力 |
|---|---|---|
| **S1 组织架构** | "组织架构" "对应职责的 agent" | ✅ Core: CitizenService / RolePackService / ProjectAgentRosterService / team-member-kind |
| **S2 主动任务接取** | "常驻 agent 定期查看任务台" "接取对应任务" | ⚠️ 有 TaskBroadcastService + CoordinationService scorecard 路由，缺定时轮询+职责匹配认领 |
| **S3 委派 + 协调** | "委派，然后往群组发，让下面的 agent 执行" | ⚠️ 有 subtask / A2A / IM 广播，缺按组织架构路由 |
| **S4 共享记忆 + 文档** | "一个群组的 agent 共享记忆、文档" | ⚠️ 有 ProjectBrainService (hybrid retrieval) + adapters-obsidian (已实现) + adapters-brain，缺跨 agent 共享层 + mem0 接入 |
| **S5 主动向人要东西 / 主动调研** | "主动向我要东西，可以主动调研" | ❌ 缺 agent→人 push 机制 (agent 发起对话) |
| **S6 反思进化 + 论坛** | "相互反思进化" "发帖子，发技术论坛" "随机查看学习" | ⚠️ 有 scorecard (CoordinationService)，缺反思循环 + 论坛/帖子模型 |

### 部署拓扑（3 台机）

- Windows / Linux / Mac 三台，**全部有 DSH**，全部连 Discord，将连 Matrix，可装 agora
- Linux = home server + memo0 server = **本机**
- 目标: agora 作为 plugin + 记忆(matrix/memo0) + dsh + 其他插件 → 组织协同 agent 从群里主动接任务

## 2. 核心判断

**Agora Core 不是空白画布——组织化 OS 骨架已经建好**。用户愿景 = 把已有 Core 能力（Citizen / Organization / Coordination / Brain / Broadcast）+ 现有 adapter（obsidian / brain / discord / matrix）+ 外部服务（mem0 / Qdrant / Matrix homeserver）**接起来** + 补 3 个缺失环节：

1. **S2 主动任务接取调度器**（常驻 agent 轮询任务台 → 按职责匹配认领）
2. **S5 主动对话 push**（agent → 人类助手 / CEO 的提问与调研请求）
3. **S6 反思进化 + 论坛**（scorecard → 反思循环 → 帖子/论坛模型）

## 3. 子文档索引

| # | 标题 | 状态 |
|---|---|---|
| [01-org-model.md](./01-org-model.md) | 组织模型（团队/角色/职责/委派链） | 规划 |
| [02-task-claiming.md](./02-task-claiming.md) | 主动任务接取（常驻 agent 轮询 + 职责匹配 + 认领） | 规划 |
| [03-shared-memory.md](./03-shared-memory.md) | 共享记忆与文档（mem0 + ProjectBrain + obsidian） | 规划 |
| [04-proactive-push.md](./04-proactive-push.md) | 主动对话 push（agent → 人 提问 / 调研请求） | 规划 |
| [05-reflection-forum.md](./05-reflection-forum.md) | 反思进化 + 论坛/帖子（scorecard → 反思循环 → 论坛） | 规划 |
| [06-deployment-topology.md](./06-deployment-topology.md) | 3 台机部署拓扑（Windows/Linux/Mac） | 规划 |
| [undecided.md](./undecided.md) | 未决事项兜底 | 规划 |

## 4. 复用 vs 新建 清单（§1.5 最短路径）

| 需求 | 复用（已有） | 新建（缺） |
|---|---|---|
| 组织架构 S1 | CitizenService / RolePackService / RosterService | 无 |
| 任务接取 S2 | TaskBroadcastService / CoordinationService / scorecard | **任务台轮询调度器 + 职责匹配认领** |
| 委派 S3 | subtask / A2A / TaskParticipationService | 委派路由（组织架构 → 下级 agent） |
| 共享记忆 S4 | ProjectBrainService / adapters-obsidian / adapters-brain | **mem0 adapter（跨 agent 记忆层）** |
| 主动 push S5 | IMProvisioningPort / TaskBroadcastService | **agent→人 对话发起机制** |
| 反思论坛 S6 | scorecard / CoordinationService | **反思循环 + 论坛/帖子模型** |
| 部署 | federation P1/P2 baseline | P3（自动团队组建 / PG HA 锁） |

## 5. 决策记录

| # | 决策 | 状态 |
|---|---|---|
| D1 | 记忆共享复用 mem0（用户建议），不自己造 | 已确认（用户 turn 160） |
| D2 | 资料沉淀复用 Obsidian（adapters-obsidian 已存在） | 已确认（用户 turn 160） |
| D3 | 组织架构复用现有 Core，不重建 | 已确认（调研结论） |
| D4 | Matrix 是群聊入口（用户 3 台机都连），transport stub 必须先真实化 | 已确认（调研结论） |
| D5 | MVP 优先做 S2+S5（用户 turn 158-159 重点），S6 论坛最后 | 已确认（用户 turn 159 描述顺序） |

## 6. 分阶段实施（排期草案）

| 阶段 | 范围 | 周期 |
|---|---|---|
| **Phase 3.5** | S2 主动任务接取（轮询 + 职责匹配认领 + 委派路由）| 1-2 周 |
| **Phase 4** | S5 主动对话 push（agent → 助手/CEO 提问） | 1 周 |
| **Phase 4.5** | S4 共享记忆（mem0 adapter + obsidian 集成验证） | 1-2 周 |
| **Phase 5** | S6 反思进化 + 论坛（scorecard → 反思循环 → 论坛） | 2-3 周 |
| **Phase 6** | 3 台机部署 + Matrix transport 真实化 + federation P3 | 2 周 |

## 7. 当前结论

**用户愿景可实现**，且**不需要从零造**——复用现有 Core + adapter + 外部服务（mem0 / obsidian / matrix），补 3 个缺失环节（S2 调度器 / S5 push / S6 反思论坛）即可。

**下一步**: 从 S2 主动任务接取开始（用户 turn 159 明确要"定期查看任务台，对应职责的 agent 接取对应任务，委派"）。见 [02-task-claiming.md](./02-task-claiming.md)。
