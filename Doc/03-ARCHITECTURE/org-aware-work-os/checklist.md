# Checklist — 公司化 Agent 组织 OS（S1–S6 执行清单）

> 用途: 本工作流唯一细粒度执行清单。每轮迭代开发→测试循环后更新勾选状态与证据引用。
> 来源: 用户愿景 (turn 158-160) + 差距盘点 (turn 163) + 实施进度 (2026-08-30 起)
> 规则: 每个条目完成 = worktree + TDD + build/gates + 冒烟 + 合并 + SSoT/walkthrough 回写 + 本文件勾选
> 汇总索引见 README.md（本文件为细粒度唯一清单, 不另设平行表）

## 迭代循环纪律（每条目固定流程）

1. 读蓝图对应子文档 + §3 建 task_dir（task_plan/findings/progress）
2. worktree（`.dsh/workspaces/<slug>`）
3. TDD: red 测试 → green 实现 → 回归全绿
4. `npm run build` + gate:core-architecture + gate:barrel-governance
5. 真实冒烟（隔离 HOME 跑真 CLI，对着真实生命周期验证）
6. merge 回 develop → 删 worktree（Hygiene）
7. 回写: SSoT Change Log + task_dir progress + 蓝图子文档实施记录 + 本文件勾选 + walkthrough
8. gm_record 更新长期记忆

---

## S1 组织架构（Team / 层级 / 职责域）

- [x] 调研: Core 已有 CitizenService / RolePackService / ProjectAgentRosterService / team-member-kind（turn 163）
- [ ] `TeamService`: Team 聚合模型（lead / members / responsibility / parent）+ 持久化
- [ ] `OrgHierarchyResolver`: reportTo / subordinates 层级解析
- [ ] CLI: `agora org` / `agora team` 配置入口
- [ ] 与 ProjectMembership 的关系定型（统一 or 并存）→ 未决 U6

## S2 主动任务接取（✅ 主体已完成 505ce4d）

- [x] `TaskClaimService` 状态机（claim/release/expire）— 测试 9/9
- [x] `matchTaskToAgent` 职责匹配（skills_ref ↔ skill_policy）— 测试 9/9
- [x] `ResidentAgentPoller` 定时轮询 — 测试 7/7
- [x] CLI `agora claim {create,release,list,claimable}` — 测试 7/7 + 冒烟 8/8
- [x] migration 036_task_claims + TaskClaimRepository
- [ ] Poller composition root 落地（server 常驻进程内启动 + 常驻 agent 配置源: citizens/roster 读取）
- [ ] 认领超时 expire 的周期性执行（poller 内挂 expire 扫描）

## S3 委派路由（依赖 S1 Team 模型）

- [ ] `DelegateRouter`: 组织架构 → 下级 agent 委派
- [ ] 委派任务群发通知（复用 TaskBroadcastService）
- [ ] 委派深度限制 + 环路检测

## S4 共享记忆（mem0 + ProjectBrain + obsidian）

- [ ] mem0 部署形态调研定型（本机 docker / REST）→ 未决 U3
- [ ] `adapters-mem0`: GroupMemoryService + mem0 client adapter（agent 经验写入 / 检索）
- [ ] 群组维度接入点: 任务完成写经验 / 任务开始读经验
- [ ] obsidian vault 分组映射（复用 adapters-obsidian）
- [ ] 跨节点 L4 记忆（federation P2 实现）

## S5 主动对话 push（✅ 主体已完成 d002792, 2026-08-30）

- [x] `AgentQuestionService`: 状态机 pending→answered|escalated→answered; *→closed — 测试 11/11
- [x] `routeQuestion`: 助手优先 → CEO（assistantRef 可配置解耦 U2）
- [x] `agora ask` CLI: {create,list,show,answer,escalate,close} — 测试 7/7 + 冒烟 7/7
- [x] QuestionMessagingPort 推送缝（create/escalate 通知; core 零平台名）
- [ ] IM 真实通道绑定（composition root 注入真实 adapter — 归 Phase 6 matrix transport 真实化）
- [x] ResearchRequestService: 以 kind=research + answer 承载（D1 修正, 不单独建服务, 见 planning D1）
- [ ] 调研结果自动写回共享记忆（依赖 S4）

## S6 反思进化 + 论坛

- [ ] `ReflectionService`: 读 scorecard → 反思报告生成
- [ ] `ForumService`: 帖子模型（lesson/howto/insight/question/proposal）+ CRUD + 搜索 → 存储形态未决 U4
- [ ] `AgentEvolutionService`: 反思 → agent 配置更新（自动 or 建议+确认）
- [ ] 学习注入: 新任务开始时检索相关帖子进上下文
- [ ] CLI: `agora reflect` / `agora post` / `agora forum`

## 部署与入口（Phase 6）

- [ ] dsh-matrix-connector transport 真实化（matrix-js-sdk 真 homeserver 连接, 消除 stub）— 现状见 `2026-08-30-matrix-roadmap/02-current-state.md`
- [ ] worksite thread resolver 实现（5 个 stub 之一, matrix 仓盘点 §5）
- [ ] 3 台机拓扑落地（推荐方案 C: Linux 中央 + Win/Mac 客户端）→ 未决 U5
- [ ] federation P3（自动团队组建）
- [ ] Discord 冒烟（积压 R-G）
- [ ] E2EE 决定（积压 R-D）

---

## 已完成里程碑

| 日期 | 交付 | commit | 证据 |
|---|---|---|---|
| 2026-08-30 | 蓝图 7 文档落盘 | `bf3bc72` | Doc/03-ARCHITECTURE/org-aware-work-os/ |
| 2026-08-30 | S2 任务认领主体（service/matcher/poller/CLI/migration） | `505ce4d` | 33 新测试 + 回归 592/592 + 冒烟 8/8 |
| 2026-08-30 | S2 回写（SSoT/progress/walkthrough/checklist） | `80056f3` | Doc/10-WALKTHROUGH/2026-08-30-org-aware-task-claiming.md |
| 2026-08-30 | S1-S6 细粒度执行清单建立 | `3f54c41` | checklist.md + host goal + 图谱记忆 |
| 2026-08-30 | S5 主动提问 push（service/route/CLI/migration 037） | `d002792` | 18 新测试 + 回归 610/610 + 冒烟 7/7 |

## 迭代顺序（按用户优先级 D5: S2→S5→S4→S6→部署）

1. ✅ S2 主动任务接取（505ce4d）
2. ✅ S5 主动对话 push 主体（d002792）
3. ⏭ **下一轮: S2 收尾**（Poller composition root + expire 周期扫描）
4. S4 共享记忆（mem0, 用户 turn 160 指定复用）
5. S1+S3 组织模型 + 委派路由
6. S6 反思论坛
7. Phase 6 部署 + matrix 真实化（含 S5 IM 通道绑定）
