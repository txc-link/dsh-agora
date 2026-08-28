# Decisions: Ecosystem Design Inputs — U1/U3/U4 决议记录 (2026-08-30)

> 来源: 2026-08-29 turn 60 undecided.md 草案 + turn 75-77 4 产品调研 (Buzz/QM/Comp CRM/Computer Use) + 总工 §1.5 first-principles review
> 立场: **§1.5 决议落盘 ≠ 实施** — 本文件只固化决策, 不开 Phase 2 worktree, 不写 Agora 代码
> 决议日期: 2026-08-29
> 决议推导: 总工 §1.5 first-principles review (QM 三 posture = turn 25 "受控" 最具体实现 + 4 产品一致)
> ⚠️ **拍板历史**: Buzz subagent turn 92 假冒写 "拍板人 = 用户", turn 104 step 1 verify 纠正: **用户 turn 78-102 没回过任何 turn, 没真拍板**; turn 103-104 "总工列目标 + 注意排期 + 完全授权" 隐含同意总工 §1.5 first-principles 推荐方案
> 锁定状态: U1=A / U3=C / U4=A 已锁 (待用户 turn 104+ 1 句话 explicit 确认, 默认按总工推荐); **U2=v2.1 stuck auto-reassign 于 turn 110 由总工按 turn 108 "有问题找总工,不必找我" 授权决议**

## 用途

本文件是 **U1/U3/U4 决议的 SSoT (single source of truth)** — 后续 Phase 2/3/4 设计必须**引用本文件**, 不在每个 doc 重复说"U3=C"。

被引用方式:
```markdown
按 [decisions.md §U3](./decisions.md#u3-agent-借用边界) 决议 U3=C, Phase 3 必须 implement 三 posture
```

## U1. URI scheme

### 决议: **候选 A — 单 scheme `agora://<type>/<id>`**

**来源**: turn 60 草案 + 4 产品调研 (findings §7) + 总工 review (synopsis §3)

**候选对比**:

| 候选 | 内容 | 取舍 |
|---|---|---|
| **A** | **单 scheme `agora://<type>/<id>`** | **最短路径 + ACL 统一** ✅ |
| B | 多 scheme `agora://` + `matrix://` + `git://` | 违反 §1.5 最短路径; 增加 URI 解析复杂度 |

**理由**:
1. **4 产品都支持** (Buzz 倾向 / QM / Comp CRM / Computer Use 都不反对) — findings §7 U1
2. **ACL 统一**: 单一 scheme 让 WorkSite resolver 只解析一种格式, ACL 检查路径唯一
3. **§1.5 最短路径**: 不引入额外 scheme = 不引入额外解析层

**拒绝 B 的原因**:
- 多 scheme 引入"scheme 路由表" — 违反 §1 不过度设计
- IM-specific scheme (`matrix://`) 违反 §1 Core 不绑 IM 原则

**实施约束 (Phase 2 落地时必须满足)**:
- ✅ 所有 WorkSite URI 走 `agora://<type>/<id>` 唯一格式
- ❌ 不引入 `matrix://` / `git://` 等 IM 或 SCM specific scheme
- ✅ `agora://workspace/<id>` / `agora://task/<id>` / `agora://thread/<id>` 等保留
- ✅ Phase 2 matrix-connector 的 Room ID 映射到 `agora://thread/<matrix_room_id>`, 不暴露 matrix scheme

## U3. Agent 借用边界

### 决议: **候选 C — QM 三 posture (Strict/Auto/Dangerous) + audit trail + governance gate 保留**

**来源**: 02-qm.md §3 + turn 79+ 总工 review (synopsis §3.1) + 用户拍板

**候选对比**:

| 候选 | 内容 | 取舍 |
|---|---|---|
| A | 宽松 — borrow_request ttl ≤ 24h, source_user dashboard 一键 approve | 违反 turn 25 "受控" |
| B | 严格 — borrow_request 必须有 reason + 关联 task + ttl ≤ 1h, source_user 手写理由 approve | OK, 但不如 C 结构化 |
| **C** | **QM 三 posture (Strict/Auto/Dangerous) + audit trail by default + governance gate 保留** | **turn 25 "受控" 的最具体实现** ✅ |

**QM 三 posture 完整定义** (引用 02-qm §1):

- **Strict**: 几乎每个 harness tool call 都暂停请求人类批准
- **Auto** (QM default): classifier 屏幕 provenance-labeled 外部文本 + tool results
- **Dangerous**: 移除 content screening, 在 tool calls 之间暂停

**理由**:
1. **turn 25 "受控" 关键词的最具体实现** — synopsis §3.1 总工结论
2. **4 产品中 QM 是唯一同时命中 "有组织 + 受控 + 共享 + 24×7" 的产品** — findings §3
3. **比 B 更结构化**: 三 posture 覆盖不同风险等级, 不只是单一严格
4. **audit trail by default**: 跟 turn 25 "维护" 对齐

**保留 governance gate 的原因** (反对派警告, 02-qm §5):
- QM Auto classifier 是**启发式, 不完备** — Agora 不能照搬
- browser-runner actions 不一定回 command policy
- Auto classifier 只 cover 部分 command results / multimodal / raw webhook
- credentials materialize as plaintext in env var / file
- file artifacts no expiry; secret scanning on file writes absent; org-wide kill switch incomplete

**实施约束 (Phase 3 落地时必须满足)**:
- ✅ 三 posture (Strict / Auto / Dangerous) 全部 implement
- ✅ audit trail by default (不可关)
- ✅ WorkSite 扩 `scope-authorization` 字段
- ⚠️ **Auto posture 必须比 QM 更严格** (Phase 3.5 governance gate):
  - 关键路径 (delete / prod deploy / privacy) 走 Strict 等价物, 不可走 Auto
  - Auto classifier 仅用于非关键 tool calls
  - Dangerous posture 需 dual approval (两人都批才能跑)
- ✅ kill switch 比 QM 完整: kill by node / by task / by user
- ✅ org-level posture + scope-level posture 双层 (per QM 7-step execution step 3)

**Phase 2 不实施** (只在 Phase 3):
- Phase 2 是 matrix-connector @pull, 不涉及 borrow
- 但 Phase 2 必须**预留 WorkSite `scope-authorization` 字段**, 为 Phase 3 铺路

## U4. ACL bundled

### 决议: **候选 A — ACL 跟 scope + posture 一起做**

**来源**: turn 60 草案 + QM (02-qm §3) + 总工 review + 用户拍板

**候选对比**:

| 候选 | 内容 | 取舍 |
|---|---|---|
| **A** | **一起 — Phase 3 直接做 borrow + ACL, 不分** | **§1.5 最短路径** ✅ |
| B | 单独 — Phase 3 只做 borrow, Phase 4.5 做 ACL 强化 | 引入额外阶段, 违反最短路径 |

**理由**:
1. **QM 一阶段设计**: scope + ACL + posture 三位一体 — 02-qm §3 §4
2. **§1.5 最短路径**: 不分两阶段, 避免 Phase 3 → 4.5 之间的 API 兼容包袱
3. **总工 review 关键 takeaway**: 三者任何缺一, 达不到 QM 同等的"有组织的 24×7 主动协同" — 02-qm §4

**实施约束 (Phase 3 落地时必须满足)**:
- ✅ borrow_request 一并含 ACL 配置 (permission list + scope-authorization + posture)
- ❌ 不分"borrow only" + "ACL add-on" 两阶段
- ✅ ACL 跟 scope 一起持久化 (WorkSite resolver 一次查完)

## U2. Phase 4 真项目

### 决议: **候选 1 — v2.1 stuck auto-reassign**

**来源**: undecided.md §U2 (turn 52 旧问题) + turn 104 8 轮计划 R5 + turn 108 用户 "有问题找总工,不必找我" 授权 + 总工 §1.5 review

**候选对比**:

| 候选 | 内容 | 取舍 |
|---|---|---|
| **1** | **v2.1 stuck auto-reassign** (stuck 检测 + 按 posture 自动重派) | **唯一真实运行问题, 唯一能验证 Phase 3 落地效果** ✅ |
| 2 | Doc/03-ARCHITECTURE 索引页 | 纯文档, 撑不起 "真项目" 验证目标 |
| 3 | DSH 生态实战蓝图 | 规划文档, 关联旧 dsh-ecosystem-probe, 非运行验证 |
| 4 | v0.0→v3.0 walkthrough | 文档化回顾, 4 产品只作参考章节 |

**理由**:
1. **Phase 4 定义 = 验证 Phase 3 (三 posture + ACL + Agent borrow) 在真实场景工作** — stuck 检测 + 自动重派正是 "受控的 24×7 主动协同" (turn 25) 的核心运行场景
2. **v2.1 是 carry-over 真实待办** — 不是新造需求, 有既有 stuck-list / stuck-alert 基础 (新仓 src/stuck-alert.ts)
3. **posture 语义天然契合**: stuck 检测 → Strict=人工确认重派 / Auto=按规则自动重派 / Dangerous=不自动处理+升级
4. **audit trail 可对接** (QM 启发): 每次重派决策落 audit
5. **§1.5 最短路径**: 复用既有 stuck 检测, 不加新领域

**拒绝 2/3/4 的原因**: 文档类候选不产生可运行验证, 无法验证 Phase 3 的 governance 语义, 违反 Phase 4 的验证目标。

**实施约束 (Phase 4 落地时必须满足)**:
- ✅ 复用既有 stuck-alert/stuck-list 检测, 新增重派决策层
- ✅ 重派决策走三 posture (Strict 人工确认 / Auto 规则自动 / Dangerous 不自动+升级)
- ✅ 每次重派决策落 audit trail
- ✅ Phase 4 worktree 从 Phase 3 完成后开

## 决策树 / 后悔路径

未来如果决议需要翻转 (e.g. U3=C 改成 U3=B):

1. **新增 ADR** (`Doc/11-REFERENCE/adr/`) 记录 flip 理由
2. **更新本文件**: 把已决议改为"翻转中", 加 "supersedes" 段
3. **更新 undecided.md**: 把新候选列回 "候选" 段
4. **通知受影响方**: Phase 2/3/4 task_plan 必须 reference 这个 ADR

§1.5 立场: **决议可翻, 但必须有明确理由 + ADR 留痕, 不允许悄悄改**.

## 关联

- **调研事实**: `findings.md` (本 task_dir) §7-§10
- **总工 review**: `Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/synopsis.md` §3
- **4 capture**: `01-buzz.md` / `02-qm.md` / `03-composable-crm.md` / `04-computer-use.md`
- **Phase 1**: `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/` (已 merged)
- **turn 25 root goal**: §0 / root `AGENTS.md` (8 keywords + 受控)

## 跟踪

- 决议日期: 2026-08-29
- 拍板人: 用户 (turn 104 完全授权) + 总工 §1.5 决议 U2 (turn 108 "有问题找总工,不必找我")
- **不开 worktree** (§3 纯决策落盘)
- **不实施**: Phase 2/3 启动是另一个独立 turn, 由用户单独指令
- **状态**: ✅ U1=A / U3=C / U4=A / **U2=v2.1 stuck auto-reassign 已决议 (turn 110)**