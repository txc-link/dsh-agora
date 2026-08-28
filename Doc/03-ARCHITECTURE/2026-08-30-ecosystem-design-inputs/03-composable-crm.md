# Architecture: Composable CRM (2026-08-30)

> 来源 (snippet-level, full design doc 未 fetch 成功):
> - turn 76 step 2 snippet 1: `linkedin.com/pulse/composable-crm-future-salesforce-architecture-k3hac` — "In a composable Salesforce architecture, you break down your CRM into smaller, reusable, and interoperable components. These might include..."
> - turn 76 step 2 snippet 2: `jetsoftpro.com/blog/composable-software-modular-architecture-2025/` — "Composable software is replacing monoliths in 2025. Learn how modular systems like Odoo-based boost agility, scale, and innovation."
> - **限制**: turn 76 step 6/8 `web_fetch` 失败 ("web-fetch-http is not registered"); MACH Alliance 官方白皮书未 fetch 到; 所有结论仅基于 snippet 文本 + §1.5 第一性原理推断。
>
> License: 公开概念, 无单一"官方仓"。Status: research-only, partial data, snippet-level verified。

## 子目录索引

- 上层索引: [`README.md`](./README.md) §2 (8-keywords 命中表) + §借鉴决策 summary
- 未决事项: [`undecided.md`](./undecided.md) — 4 产品对 Agora U1/U3/U4 的输入

## §1 已确认的设计 / 事实

- **Composable CRM / Composable Software / Packaged Capability**: 把 monolith CRM 拆成 "smaller, reusable, and interoperable components" (snippet 1)
- 每个组件 = **PBC**: 独立 data + API contract + lifecycle
- **MACH principles**: Microservices / API-first / Cloud-native / Headless
- 2025 趋势: "Composable software is replacing monoliths in 2025" (snippet 2)
- 厂商代表: **Salesforce** (Composable CRM), **Odoo** (modular), **HubSpot** (modular)
- **注意**: 不是单一产品, 是 **architecture pattern**; 没有 "Composable CRM official repo"; 厂商各自实现 (AppExchange / Odoo Apps / HubSpot App Marketplace)
- §1.5 含义: Agora 不应该"装 Composable CRM"; 应该"评估 Composable 是否是 Agora 已经在 follow 的 pattern"

## §2 与 Agora 对比 — 8 keywords 命中表

| 维度 | Composable CRM | Agora | Agora 是否需要跟进 |
|---|---|---|---|
| 协同 | ❌ (单租户为主) | ✅ | 否 |
| 主动 | ❌ (被触发) | ✅ | 否 |
| 24×7 / 不断运行 | 部分 (SaaS 在线) | ✅ | 否 |
| 维护 | ✅ (组件 lifecycle) | ✅ | 否 (都已 follow) |
| **分解** | ✅ **(核心 — PBC 拆分)** | ✅ | **否 (§1 已锁定 adapter)** |
| **有架构** | ✅ **(PBC API contract)** | ✅ | **否 (§1 已对齐)** |
| 进化 | 部分 (组件迭代) | ✅ (Core 不动) | 否 (Agora 更彻底) |
| 共享 | 部分 (multi-tenant) | ✅ | 否 |
| 完成复杂任务 | ❌ (单体功能) | ✅ | 否 |

### 关键 insight (§1.5)
- Composable CRM 直接命中 **分解** + **有架构** = 核心
- Agora §1 Core Constitution 锁定的 "Core / adapter 分离" **已经是 Composable 模式**
- §1 命中 2 维 + §1.5 不主动扩展 = **不需要为 Composable 改造 Agora**
- §1 约束: 不能为"composable" 拆更细 (§1 不过度设计), 也不能为"simplicity" 砍 adapter 边界 (§1 解耦优先)

## §3 借鉴决策 (§1.5 first-principles)

### ✅ 可借鉴
1. **Packaged Capability (PBC) 概念命名**: 每个 adapter 是有自己 data + API + lifecycle 的包; Agora 已 follow (e.g. `matrix-connector` 独立 npm package, `dsh-matrix-connector` 独立 dsh plugin); **建议级**: docs 加 "Agora is Composable" 自描述, 跟 §1 adapter pattern 显式对齐
2. **MACH principles**: API-first (REST+CLI ✅) / Headless (UI 是 Dashboard adapter ✅) / Cloud-native (SQLite 可迁 Postgres ✅) / Microservices (中央 + adapters 独立 ✅); **结论**: 4 条都已隐式满足, 不需要新增 tag
3. **Composable 决策语义** = "用什么组件拼什么": Agora 可显式支持"按场景拼装 adapter 组合"; §1.5 不允许主动扩展 → 留为 Phase 2+ 决策

### ❌ 不借鉴
1. **SaaS-focused**: Composable CRM 强假设 SaaS 部署 (Salesforce 生态); Agora 是 self-host / open-source 路线, **不绑** SaaS
2. **"buy vs build" 强调**: Composable CRM 默认 "从 AppExchange 买 PBC"; Agora §1 强调 "adapter 自建", **不绑** marketplace
3. **营销 tag "MACH principles"**: MACH 是 vendor alliance 推动的营销框架; Agora 已 follow 但**不需要**加 tag (避免 vendor 绑定印象)

## §4 跟 Agora 已落地 Phase 1 的差异

### Phase 1 WorkSite = 一个 PBC 模板
- WorkSite 有自己的 data type (task/thread/commit/watch/workspace/session) + URI + resolver + 抽象接口
- 完全符合 PBC 定义 (独立 data + API + lifecycle 包)
- **但 Agora 没显式用 "PBC" / "Composable" 命名**

### 建议 vs 禁止 (§1.5)
- ✅ **建议**: docs 加 "Agora is Composable" 自描述 — **自描述**而非新设计, 不违反 §1.5
- ❌ **不要**: 重命名为 "Composable Agora" 或加 "MACH principles" tag — 违反 §1.5 不主动扩展 + §1 解耦优先
- ❌ **不要**: 为"composable" 把 adapter 拆更细 (e.g. 把 matrix-connector 拆成 message-receiver + message-sender) — 违反 §1 不过度设计 + turn 25 "有架构 ≠ 无限拆"

### Phase 2+ 已 follow PBC 模式
- `matrix-connector` (独立 npm package + dsh plugin) / `sentinel` (独立 dsh plugin) / `git` (独立 dsh plugin) — 每个都是 PBC

## §5 风险 / 限制

- **buzzword 风险** (§1.5): "Composable" 是 2025 营销 buzzword, 实际门槛高; 真 Composable 要求每个组件**真独立** API + lifecycle + data; **假 Composable** = 组件只是 monolith 拆出来, 数据 / API 仍紧耦合
- **拆太细 = 集成成本爆炸**: §1.5 turn 25 "有架构" ≠ "无限拆"; 每拆一个组件, 跨组件数据一致性 / API 兼容 / 部署编排都是成本; 反例: 100 组件 "Composable CRM" 集成成本可能高于 monolith
- **数据一致性跨组件**: Composable CRM 无强一致性保证 (组件各自管理 data); 解决方案: CRDT / eventual / event sourcing; **对 Agora**: `agora.db` 是 single source of truth, 已避免
- **厂商生态绑架**: 即便组件化, Salesforce / HubSpot AppExchange 仍有 lock-in (数据迁移 / API 切换 / 计费依赖); **对 Agora**: Agora 不绑 IM / Runtime / Craftsman, 已是 anti-lock-in
- **对 Agora 的含义**: §1 锁定 adapter pattern **已经是对的**; ❌ 不要为 "composable" 拆更细; ❌ 不要为 "simplicity" 砍 adapter 边界; ✅ 可在 docs 自描述 "Agora is Composable" (自描述, 不是新设计)

## §6 关联

- **§1 Core Constitution** (root `AGENTS.md`) — adapter pattern 跟 PBC 对齐
- **Phase 1 WorkSite** — 已是 PBC 模式
- **Phase 2+** — `matrix-connector` / `sentinel` / `git` 都是独立 PBC
- **公开白皮书**: `Doc/whitepaper.md` — 可补 "Composable" 一节 (§1.5 建议级, 不是必须)
- **README 命中表**: 本目录 `README.md` §2 (8 keywords) + §借鉴决策 (✅/❌ 各 2 行)

## §7 跟踪

- task_dir: `Doc/09-PLANNING/TASKS/2026-08-30-ecosystem-design-inputs/`
- task_plan / findings / progress: `Doc/09-PLANNING/TASKS/2026-08-30-ecosystem-design-inputs/`
- **不开 worktree** (§3 纯调研, 满足 AGENTS.md §3 worktree 例外 "纯只读分析")
- research-only, snippet-level 验证 (full fetch failed turn 76 step 6/8)
- 不装任何东西, 不写 Agora 代码, 不动 Core
- 输入到: `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/undecided.md` (U1/U3/U4) + Phase 2/3/4 设计 (待 U1 决议)
