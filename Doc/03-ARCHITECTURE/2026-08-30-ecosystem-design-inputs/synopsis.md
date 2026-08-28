# Architecture: Ecosystem Design Inputs — 总工 Review (2026-08-30)

> 来源: 2026-08-29 用户 "还有组织一下团队, 讨论一下这个项目和我们的项目 对比 交叉 融合, 后续发展, 计划更新之类的, 然后给我结论, 应该怎么做"
> 角色: 总工 (架构师 / Chief Architect)
> 立场: **§1 不动 Agora Core / §1.5 不主动扩展 / 结论是候选不是决议**
> 不开 worktree (§3 纯文档), 不写 Agora 代码 (§1)

## 0. 立场声明 (§1.5)

- 4 份 capture (`01-buzz.md` / `02-qm.md` / `03-composable-crm.md` / `04-computer-use.md`) + README + undecided + task_plan/findings/progress **已落地且质量合规**, 本 turn 不重新验证, 仅引用
- 本文件 = **总工对 4 份 capture 的 review** + **4 视角对话** + **裁决候选** — 决策权在用户
- 不擅自把候选升级为决议, 不动 Agora Core, 不开 Phase 2 worktree

## 1. 事实底座 (引自 4 capture + findings)

### 1.1 4 产品对 Agora turn 25 10 维度 (8 keywords + 受控) 命中矩阵

(来自 findings §3, 此处简版)

| 维度 | Buzz | QM | Comp CRM | Computer Use | Agora |
|---|---|---|---|---|---|
| 协同 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 主动 | 部分 | ✅ | ❌ | ❌ | ✅ |
| 24×7 / 不断运行 | 部分 | ✅ | ❌ | ✅ | ✅ |
| 维护 | ❌ | ✅ | ✅ | ❌ | ✅ |
| 分解 / 有架构 | ✅ | ✅ | ✅ | ❌ | ✅ (§1 adapter) |
| 有组织的协同 | 部分 | ✅ | 部分 | ❌ | ✅ (Phase 3+) |
| 进化 | ❌ | 部分 | 部分 | ❌ | ✅ (graph-memory) |
| 共享 | ✅ | ✅ | ❌ | ❌ | ✅ (Phase 1 WorkSite) |
| 完成复杂任务 | ✅ | ✅ | ❌ | ✅ | ✅ |
| **受控** | ⚠️ | ✅ | ❌ | ⚠️ | ✅ (U3/U4 待决) |

### 1.2 关键事实 (引用, 不重复)

- **QM** 是唯一**同时**命中 "有组织 + 受控 + 共享 + 24×7" 的产品 (findings §3 关键发现)
- **Buzz** 没有显式 "受控" (跟 turn 25 冲突)
- **Composable CRM** 不是产品是 pattern, Agora §1 已经 follow
- **Computer Use** ⚠️ snippet-only (Anthropic docs fetch 失败), 结论 50% 可信度

## 2. 4 视角对话 (总工主持)

### 2.1 🔍 调研员 (researcher) — "事实是什么?"

- 4 产品都**真存在** (3 个 ✅ verify + 1 个 ⚠️ snippet-only)
- QM 的设计跟 turn 25 root goal **完美对齐** (4 in 1 命中)
- Composable CRM 是**我们已经 follow 的 pattern** — 不构成新设计输入, 只构成"自描述"价值
- Computer Use 是 execution layer, Agora 是 orchestration layer — **互补**, 不竞争
- Buzz 的"portable cryptographic identity" 跟 §1 解耦原则**不冲突**也不必抄, WorkSite 已有类似抽象

**调研员输出**: 调研事实充分, 不需要补 capture, 进入 review 阶段

### 2.2 🏛️ 架构师 (architect) — "该 follow 什么?"

- **QM 三 posture (Strict/Auto/Dangerous)** 是 turn 25 "受控" 的**最具体实现** — **升级为 U3 候选 C** (取代草案 A/B)
- **QM 的 Scope + ACL + posture 三位一体** = Agora 的 WorkSite + 借用权限 + 组织 posture 三位一体 — **三者必须一起规划**, 不分批割裂 (§1.5 最短路径)
- **Composable CRM 的 PBC 命名** = 显式化 "Agora already follows PBC" — docs 自描述**不违反 §1.5**, 应该做
- **4 产品没一个跟 §1 Core 解耦原则冲突** → **不需要改造 Agora**, 只需要补决策 + docs 自描述

**架构师输出**: 借鉴收敛在 **QM 三 posture + PBC docs 自描述** 这两项, 其他不需要

### 2.3 😈 反对派 (skeptic) — "哪里可能错?"

- **风险 1**: 把 QM 三 posture 当"最佳实践" = **过度借鉴** (§1.5). QM 的 Auto posture 用 classifier 屏幕, **classifier 是启发式, 不完备** (02-qm §5 自己承认). Agora 不能照搬 classifier, **必须保留 governance gate**
- **风险 2**: Comp CRM "MACH" 是 vendor alliance 营销框架 — 加这个 tag 会让 Agora 像 vendor 站台, **品牌风险**
- **风险 3**: Computer Use ⚠️ snippet-only — 当 Phase 2 决策依据**不够**, 只能作 Phase 3+ adapter 候选
- **风险 4**: QM 自己承认的风险 (7-day npm cooldown / classifier 不完备 / Admin = privileged reader) **Agora 不能照搬**, 必须自定 governance
- **风险 5 (最严重)**: **现在最危险的不是"借鉴错", 是"什么都不做"** — turn 60 undecided.md 草案 stale 风险 + findings.md §6 列了 4 件还没做的事, 每多一天不决, Phase 2 启动越拖

**反对派输出**: 借鉴必须**带 governance gate**, 不是照搬; **不决策本身就是最大风险**

### 2.4 👤 用户代表 (user-rep) — "用户真正要什么?"

- 用户要的不是 4 份 capture 复读, 是 **"下一步具体动作"**
- 调研的隐含意图 = 调研完开 Phase 2 — **把决策选项清晰摆出来**, 让用户拍板
- 用户不需要 AgentTeam 主持 60 分钟讨论 — **1 份文件 + 1 条结论**比 4 个角色对话更实际 (本文件就是这个)

**用户代表输出**: 本 turn 的"总工 review" 是合适粒度, 不需要更多 review

## 3. 总工裁决 (§1.5: 候选不是决议)

### 3.1 核心结论 (1 行)

**QM 三 posture 是唯一可立刻升级为 U3 候选的具体设计; 其他 3 个产品只提供 "docs 自描述 + Phase 3+ adapter 候选" 价值, 不足以单独立项 Phase 2**.

### 3.2 优先级排序 (P0 → P4)

| 优先级 | 内容 | 工时 | 状态 |
|---|---|---|---|
| **P0** | U3 候选从 A/B **升级为 A/B/C**, 加 C = QM 三 posture (跟 U4=A 一起, 是 Phase 2 启动的**前置条件**) | 0 (本 turn 更新 undecided.md) | **本 turn 做完** |
| **P1** | 4 份 capture + README + undecided + planning 三件套 — **已落地**, 不补 capture | 0 | **已完成** |
| **P2** | Phase 2 启动决策 (U1/U3/U4 拍板) | 等用户决策 | **pending** |
| **P3** | docs 加 "Agora is Composable" 自描述段 (§1.5 允许, 不算新设计, 加在 whitepaper.md 或 README) | 半文件, 等用户拍板后做 | **pending** |
| **P4** | Computer Use 作为 Phase 3+ Craftsman adapter 候选 | 等 Phase 3 启动 | **pending** |

### 3.3 不做的事 (§1.5 禁止 + 反对派警告)

| 不做 | 原因 |
|---|---|
| Buzz portable cryptographic identity 引入 | 违 §1 解耦, WorkSite 已隐式支持 portable 抽象 |
| QM classifier 照搬 | 启发式不完备 (QM §5 自己承认), Agora 必须自定 governance gate |
| Composable 改造 Agora | §1 已经 follow, 不需要为"composable"拆更细 (违反 §1.5 不过度设计) |
| MACH tag / vendor 站台 | 品牌风险 (§1 强调独立) |
| 4 产品任一单独立项 Phase 2 | 只有 QM 三 posture 是 Phase 2 启动的**真前置**, 其他不够格 |

### 3.4 决策树 (用户拍板路径)

- **回 "U3=C / U4=A / U1=A"** → 直接开 Phase 2 task_dir + worktree, 沿用 QM 三 posture
- **回 "U3=B / U4=A / U1=A"** → 沿用草案, 不升级 QM 三 posture
- **回 "暂停"** → 不动, 等下次
- **回 "再调研"** → 评估还要调研什么 (e.g. 实测 QM classifier 行为, 或重试 fetch Anthropic Computer Use docs)

## 4. 计划更新 (§1.5 候选)

### 4.1 task_plan.md 增量
- 新增阶段 10: "总工 review" — 已完成 (本文件)
- 新增阶段 11: "U3 候选升级 C (QM 三 posture)" — 本 turn 完成后等用户决策
- 新增阶段 12: "Phase 2 启动" — pending 用户决策

### 4.2 progress.md 增量
- 加 "phase 0.5: 总工 review 完成" 里程碑
- 加 "phase 1.0: U1/U3/U4 拍板" pending

### 4.3 findings.md 增量
- 加 §9 "总工 review 结论" (本文件 §3 摘要, 引用本文件路径)
- 加 §10 "QM 三 posture 升级为 U3 候选 C" (候选, 不决议)

### 4.4 undecided.md 增量 (本 turn)
- **U3 候选从 A/B 升级为 A/B/C**
- C = **QM 三 posture (Strict/Auto/Dangerous)** + audit trail by default
- 加 QM 三 posture 的**风险标注**: Auto classifier 启发式不完备, Agora 必须保留 governance gate (来自 02-qm §5)

## 5. 后续发展 (Phase 2/3/4 输入, §1.5 候选)

### 5.1 Phase 2 (matrix-connector @pull) — 候选输入
- 借鉴: **QM scope-authorization 字段** (per Room = 1 scope)
- 借鉴: **matrix Room 模拟 thread** 已经隐式支持 scope
- 不借鉴: Buzz Nostr identity (违 §1)
- 不借鉴: Computer Use screenshot (matrix 已是结构化 API)
- **新增 (来自总工 review)**: QM 三 posture 中 "Auto" posture 的 classifier 不能直接抄, Phase 2 必须保留 governance gate

### 5.2 Phase 3 (Agent borrow + Dashboard approve) — 候选输入
- 借鉴: **QM 三 posture (Strict/Auto/Dangerous)** — 替代 turn 60 草案 A/B
- 借鉴: QM audit trail by default
- 借鉴: QM 7-step execution path 的 step 3 (posture + scope policy decides)
- **新增**: 不要照搬 QM Auto classifier, 留 governance gate

### 5.3 Phase 4 (真项目) — 候选输入
- 不强依赖 4 产品 — 等 U2 决议 (turn 52 旧问题)
- **新增 (来自反对派警告)**: Computer Use adapter ⚠️ snippet-only 验证, Phase 4 立项前必须重 fetch Anthropic docs 拿到完整 design doc

## 6. 关联

- **来源**: `Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/{01-buzz,02-qm,03-composable-crm,04-computer-use,README,undecided}.md`
- **planning**: `Doc/09-PLANNING/TASKS/2026-08-30-ecosystem-design-inputs/{task_plan,findings,progress}.md`
- **旧 DSH 生态调研**: `Doc/03-ARCHITECTURE/2026-08-29-dsh-ecosystem-probe/` (DSH 插件生态, 不重复)
- **Phase 1 (已 merged)**: `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/`
- **Tutti·VM**: `Doc/09-PLANNING/TASKS/2026-08-29-tutti-vm-paradigm-review/`
- **turn 25 root goal** (8 keywords + 受控): §0 / root `AGENTS.md`

## 7. 跟踪

- **task_dir**: `Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/` (capture) + `Doc/09-PLANNING/TASKS/2026-08-30-ecosystem-design-inputs/` (planning)
- **不开 worktree** (§3 纯文档)
- **research-only**, 不装任何东西, 不写 Agora 代码, 不动 Core
- **状态**: 本 turn 完成 (总工 review 输出); 等用户回应后开 Phase 2 task_dir
