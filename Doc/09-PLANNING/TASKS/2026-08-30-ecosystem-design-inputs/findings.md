# Findings: Ecosystem Design Inputs (4 products research, 2026-08-30)

## 1. 调研方法

- Source A: `web_search` 4 个产品名 (turn 76 step 2) → 8 个 snippet
- Source B: `web_fetch` Block.xyz Buzz 官方 blog + Tent.co QM 评估文章 + Anthropic Computer Use docs (turn 76 step 6/8)
- Source C: 旧 `Doc/03-ARCHITECTURE/2026-08-29-dsh-ecosystem-probe/` (turn 76 step 4 read, 确认 turn 75 不重复)

每个产品必须给出 ✅ 真存在 + URL + 核心机制, 或 ⚠️ snippet-only + fetch failed。

## 2. 4 个产品 — 真存在性 + 核心机制

| # | 产品 | 状态 | URL | 核心机制 (1 行) |
|---|---|---|---|---|
| 1 | **Buzz** | ✅ | [block.xyz blog](https://block.xyz/inside/introducing-buzz-where-humans-and-agents-work-together), [repo github.com/block/buzz](https://github.com/block/buzz) | Nostr 协议 + channels/threads/code/voice/automations; cryptographic identity per agent (跨 Nostr 系统 portable); model-agnostic (Claude Code/Codex/goose 都可) |
| 2 | **QM** | ✅ | [Tent.co 评估](https://developer.tenten.co/qm-agent-multiplayer-security), [repo github.com/yc-software/qm](https://github.com/yc-software/qm) | Scope-as-first-class (personal/room/group/project) + 三 posture (Strict/Auto/Dangerous) + durable sandbox + audit trail; Pi/OpenCode/Codex/ClaudeCode 共享同一 core contract |
| 3 | **Composable CRM** | ✅ (concept) | [LinkedIn](https://www.linkedin.com/pulse/composable-crm-future-salesforce-architecture-k3hac), [JetSoftPro](https://jetsoftpro.com/blog/composable-software-modular-architecture-2025/) | Architecture pattern: 把 monolith CRM 拆成 Packaged Capability (PBC), 每个有 data + API + lifecycle; MACH (Microservices/API-first/Cloud-native/Headless) |
| 4 | **Computer Use** | ⚠️ snippet-only | [Anthropic docs fetch failed 422](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool), [CNBC](https://www.cnbc.com/2026/03/24/anthropic-claude-ai-agent-use-computer-finish-tasks.html) | Architecture pattern: 给 agent 一个 computer (VM/container), agent 用 screenshot + mouse/keyboard 操作; persistent workspace; Anthropic/OpenAI Operator/Google Mariner 都 follow |

## 3. 跟 Agora turn 25 锁定的 10 维度 (8 keywords + 受控) 命中表

| 维度 | Buzz | QM | Comp CRM | Computer Use | Agora |
|---|---|---|---|---|---|
| 协同 | ✅ | ✅ | ❌ | ❌ | ✅ (turn 25 锁) |
| 主动 | 部分 | ✅ | ❌ | ❌ | ✅ |
| 24×7 / 不断运行 | 部分 | ✅ | ❌ | ✅ | ✅ (sentinel) |
| 维护 | ❌ | ✅ | ✅ | ❌ | ✅ |
| 分解 / 有架构 | ✅ | ✅ | ✅ | ❌ | ✅ (§1 adapter) |
| 有组织的协同 | 部分 | ✅ | 部分 | ❌ | ✅ (Phase 3+) |
| 进化 | ❌ | 部分 | 部分 | ❌ | ✅ (graph-memory) |
| 共享 | ✅ | ✅ | ❌ | ❌ | ✅ (Phase 1 WorkSite) |
| 完成复杂任务 | ✅ | ✅ | ❌ | ✅ | ✅ |
| **受控** (turn 25) | ⚠️ | ✅ | ❌ | ⚠️ | ✅ (U3/U4 待决) |

**关键发现**:
- **QM 是唯一一个同时命中 "有组织 + 受控 + 共享 + 24×7" 的产品** (跟 turn 25 root goal 对齐度最高)
- **Agora 已经在 10 维度中命中 10** (但 "受控" 依赖 U3/U4 决议)
- **Comp CRM** 主要命中 "有架构/分解", 跟 §1 Core Constitution 已经 follow 的 adapter pattern 对齐
- **Buzz** 主要命中 "协同/共享", 但**没有显式 受控**
- **Computer Use** 主要命中 "24×7/完成复杂任务", 是 execution layer 终极能力

## 4. 借鉴决策 summary (详细见各 01-04 doc + README.md)

### ✅ 借鉴 (Phase 2/3/4 可参考)
- **QM Scope-as-first-class** → U3 (Agent 借用边界) 决策输入
- **QM 三 posture (Strict/Auto/Dangerous)** → U3 + U4 决策输入
- **QM Audit trail by default** → Agora audit log 改默认启用
- **QM Durable sandbox** → Phase 1 `worksite/session` type 已隐式支持
- **Comp CRM PBC 概念** → §1 adapter pattern 已经在 follow; docs 可加自描述
- **Computer Use 持久化 workspace** → Phase 1 `worksite/workspace` type 已支持

### ❌ 不借鉴 (§1.5 不主动扩展)
- Buzz 默认信任 agent → 违反 turn 25 "受控"
- QM Core replacement 策略 → 违反 §1 Core 不绑 Runtime
- QM Slack 为 primary surface → 违反 §1 Core 不绑 IM
- Comp CRM SaaS-focused → Agora 是 self-host 路线
- Computer Use 单机 → Agora 是 multi-agent orchestration

## 5. §1.5 错误更正 (这条 turn 之前)

- turn 76 step 6: 尝试 fetch Anthropic Computer Use docs + Wikipedia → 422 失败
- **正确做法**: snippet-level 验证 + 诚实标 "⚠️ snippet-only", 不假装有完整 design doc
- 旧 `dsh-ecosystem-probe` (turn 49-51) **没**覆盖这 4 个产品 (那是 DSH 插件生态内部调研, 不是外部产品)

## 6. 还没做的事 (undecided.md 跟踪)

- [ ] **没装任何东西** — 调研结束, 等用户决策
- [ ] **没读 dsh-ecosystem-probe 的全部 findings** (但已 read task_plan + findings + progress + README + undecided)
- [ ] **没重试 fetch Anthropic Computer Use docs** (turn 76 step 8 也失败)
- [ ] **没决定 Phase 2 怎么借 QM Scope 设计** (等 U1 决议)
- [ ] **没改 Agora audit log 为默认启用** (等用户决策)

## 7. U1/U3/U4 输入候选 (undecided.md 详细)

### U1 (URI scheme) — 4 产品给的输入
- Buzz 用 Nostr (single protocol identity) — 倾向单 scheme
- QM 用 core contract (model-agnostic) — 不绑具体 scheme
- Comp CRM 用 PBC API — 不绑具体 scheme
- Computer Use 用 file-based workspace — 不绑具体 scheme
- **倾向**: 单 scheme `agora://<type>/<id>` (§1.5 草案, 4 产品都不反对)

### U3 (Agent 借用边界) — 4 产品给的输入
- Buzz: 默认信任 (不借鉴)
- **QM**: **3 posture (Strict/Auto/Dangerous)** — 跟 §1.5 草案"严格"对齐
- Comp CRM: 不涉及
- Computer Use: 默认信任 (不借鉴)
- **倾向**: §1.5 草案 B (严格) + QM 三 posture 模型

### U4 (ACL bundled) — 4 产品给的输入
- Buzz: ACL 跟 Nostr identity 一起
- **QM**: **ACL 跟 scope + posture 一起** — 跟 §1.5 草案"一起"对齐
- Comp CRM: ACL 跟 PBC lifecycle 一起
- Computer Use: 不涉及
- **倾向**: §1.5 草案 A (一起, 最短路径)

## 8. 期望用户回应

按 §1.5 + turn 73 lesson (用户让你做,你直接做):
- 我**没**弹菜单; 但 undecided.md 会列具体选项
- 等用户**自由文字**回应:
  - (a) "U1/U3/U4 我决定 → X/Y/Z" — 我开 Phase 2 task_dir + worktree
  - (b) "继续 Phase 2 (沿用 §1.5 草案)" — 我开 Phase 2 task_dir + worktree
  - (c) "再做一轮 research" — 我扩展 task_dir
  - (d) "暂停" — 我停, 等下次

## 9. 总工 review 结论 (turn 79+, synopsis.md 摘要)

> 详细见 `Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/synopsis.md` 234 行
> 立场: §1.5 候选不是决议, 决策权在用户

### 9.1 4 视角对话结论

- **🔍 researcher**: 调研事实充分, 不需要补 capture
- **🏛️ architect**: 借鉴收敛在 **QM 三 posture + PBC docs 自描述**, 其他不需要
- **😈 skeptic**: 借鉴必须带 governance gate, 不照搬 QM Auto classifier; **不决策本身就是最大风险**
- **👤 user-rep**: 1 份总工 review 文件 + 1 条结论, 比 4 角色 AgentTeam 协调更实际

### 9.2 核心结论 (1 行)

**QM 三 posture 是唯一可立刻升级为 U3 候选的具体设计; 其他 3 个产品只提供 "docs 自描述 + Phase 3+ adapter 候选" 价值, 不足以单独立项 Phase 2**.

### 9.3 P0-P4 优先级

| 优先级 | 内容 | 状态 |
|---|---|---|
| P0 | U3 候选升级 A/B → A/B/C (C = QM 三 posture) | ✅ 本 turn 完成 (本 §10) |
| P1 | 4 capture + README + undecided + planning 三件套 | ✅ 已完成 |
| P2 | Phase 2 启动决策 (U1/U3/U4 拍板) | ⏳ 等用户决策 |
| P3 | docs 加 "Agora is Composable" 自描述段 | ⏳ pending |
| P4 | Computer Use 作为 Phase 3+ Craftsman adapter 候选 | ⏳ pending |

### 9.4 不做清单 (§1.5 禁止 + 反对派警告)

- ❌ Buzz portable cryptographic identity 引入 (违 §1 解耦)
- ❌ QM classifier 照搬 (启发式不完备, 02-qm §5 自己承认)
- ❌ Composable 改造 Agora (已经 follow, 不为"composable"拆更细)
- ❌ MACH tag / vendor 站台 (品牌风险)
- ❌ 4 产品任一单独立项 Phase 2 (只有 QM 三 posture 是真前置)

## 10. U3 候选升级 C — QM 三 posture (总工 review P0, **turn 79+ 已决议 C**)

> **状态变更**: turn 79+ 用户拍板 → **C 已决议** (U1=A / U3=C / U4=A, 详见 [`decisions.md`](../../03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/decisions.md))

### 10.1 U3 候选从 2 个升级为 3 个

| 候选 | 内容 | 来源 | 状态 |
|---|---|---|---|
| A (宽松) | borrow_request ttl ≤ 24h, source_user dashboard 一键 approve | turn 60 草案 | ❌ 未选 |
| B (严格) | borrow_request 必须有 reason + 关联 task + ttl ≤ 1h, source_user 必须手写理由 approve | turn 60 草案 | ❌ 未选 |
| **C (NEW)** | **QM 三 posture (Strict/Auto/Dangerous) + audit trail by default + governance gate 保留** | **02-qm §3 + turn 79 总工 review** | ✅ **已决议** |

### 10.2 QM 三 posture 完整定义 (引用 02-qm §1)

- **Strict**: 几乎每个 harness tool call 都暂停请求人类批准
- **Auto** (QM default): classifier 屏幕 provenance-labeled 外部文本 + tool results
- **Dangerous**: 移除 content screening, 在 tool calls 之间暂停

### 10.3 风险标注 (来自 02-qm §5 + 总工 review §2.3 反对派警告)

- Auto posture 的 classifier 是**启发式, 不完备** (02-qm §5)
- browser-runner actions 不一定回 command policy
- Auto classifier 只 cover 部分 command results / multimodal / raw webhook
- credentials materialize as plaintext in env var / file
- file artifacts no expiry; secret scanning on file writes absent; org-wide kill switch incomplete

### 10.4 Agora 必须保留的 governance gate (即使选 C)

- Auto classifier **不能直接照搬** — Agora 必须自定 governance gate (与 QM 不同)
- 关键路径 (delete / prod deploy / privacy) 必须走 Strict posture 等价物
- audit trail 不可关 — QM 已经 default, Agora 也必须 default
- kill switch 完整性 — 必须比 QM 完整 (kill by node / by task / by user)

### 10.5 U3 决议 C 落地路径 (locked)

- **Phase 2 (matrix-connector @pull)**: 不直接用三 posture, 但**预留 WorkSite `scope-authorization` 字段** (per Room = 1 scope), 为 Phase 3 铺路
- **Phase 3 (Agent borrow + Dashboard approve)**: U3=C + U4=A 一并落地:
  - WorkSite 扩展 `scope-authorization` 字段
  - 三 posture 配置 (org-level + scope-level 双层)
  - audit log 默认开 (不可关)
  - ACL 跟 borrow 一起做 (U4=A)
- **Phase 3.5 (governance gate 比 QM 严格)**: Strict 默认 / Auto 需 opt-in / Dangerous 需 dual approval