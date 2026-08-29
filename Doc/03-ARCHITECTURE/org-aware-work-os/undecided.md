# Undecided — 未决事项兜底

> 日期: 2026-08-30
> 状态: 未决事项集中地（讨论只落一部分时，剩余话题必须留在这）

## 已确认（用户明确表态）

| # | 决策 | 来源 |
|---|---|---|
| D1 | 记忆共享复用 mem0 | turn 160 "记忆共享可以用 memo0" |
| D2 | 资料沉淀复用 Obsidian | turn 160 "资料沉淀分组可以用 obsidian" |
| D3 | 组织架构复用现有 Core | 总工调研结论 |
| D4 | Matrix 是群聊入口，transport stub 必须先真实化 | 总工调研结论 |
| D5 | MVP 优先 S2+S5，S6 论坛最后 | turn 159 描述顺序 |

## 未决（待决策）

### U1. 主动任务接取（S2）
- [ ] 轮询间隔默认值（N 分钟）
- [ ] 多 agent 竞争同一任务策略（先到先得 / scorecard / 轮询）
- [ ] 委派深度（几级）
- [ ] 认领超时释放策略

### U2. 主动 push（S5）
- [x] "助手"是 agent 还是人类 → **默认两态兼容**: push 走 targetRef 解析 (agentRef→房间映射 / roomId 直发), 人类与 agent 同一通道 (2026-08-30 默认拍板; 92938b0+2609572)
- [x] 提问超时自动升级策略 → **默认不自动升级** (与 S6 建议制进化一致; 后续如需 escalation 可挂 Dispatcher 定时扫描)
- [x] 与 archon review 的关系 → **并行** (S5 ask 是主动外呼, review 是网关内呼, 语义不重叠)
- [ ] 调研能力边界（web / 代码库 / 文档库）→ runtime 侧能力, 随 agent 宿主演进, 不阻塞 OS

### U3. 共享记忆（S4）
- [ ] mem0 部署形态（本地 docker / 云端 / REST）
- [ ] 群组维度 ↔ ProjectBrain 项目维度关系
- [ ] 记忆写入触发策略
- [ ] obsidian 分组与群组/项目映射

### U4. 反思论坛（S6）
- [ ] 反思频率（每任务 / 每日 / 手动）
- [ ] 进化自动改配置 or 建议+确认
- [ ] 论坛存储（SQLite / markdown / obsidian vault）
- [ ] 帖子可见性（同群组 / 全组织 / 分级）

### U5. 部署（3 台机）→ **默认方案 C 拍板 (2026-08-30, 详见 DEPLOYMENT-HANDOFF.md)**
- [x] 三台机是一个组织 → 单组织, Linux 中央 (agora+mem0+Synapse)
- [x] Windows/Mac agora 形态 → connector plugin 客户端接入中央 (deploy/01-04 runbook)
- [x] matrix 中央 homeserver or 联邦 → 中央 (localhost:8008); federation P3 留待多 homeserver 需求出现
- [x] 角色分配 → 方案 C 混合 (Linux 集中 + Win/Mac 客户端)

### U6. 组织模型（S1）
- [ ] ProjectMembership 与 Team 的关系
- [ ] "助手"特殊 agent 类型定义
- [ ] 组织配置存储位置
- [ ] 多项目共享 org or 每项目一个

## 决策流程

按 master directive：总工列目标 → 分轮 → 排期 → 实施；"后续没遇到解决不了的问题不必再问"。U 项能通过合理默认推进的，总工直接定；涉及用户偏好（助手是人还是 agent / 三台机拓扑）必须问用户。
