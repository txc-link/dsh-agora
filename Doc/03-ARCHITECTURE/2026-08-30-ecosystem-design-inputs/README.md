# Architecture: Ecosystem Design Inputs (2026-08-30)

> 来源: 2026-08-29 用户 turn 75 "做之前研究一下 buzz 人类和ai共用协作平台 和 qm组织级ai agent 工作空间 comp crm 和computer agent的持久化电脑工作区"
> 意图: 这 4 个产品都跟 Agora turn 25 锁定的 8 keywords (协同/主动/24×7/维护/分解/有组织/进化/共享/完成复杂任务) 有交集;
> 在做 Agora Phase 2/3/4 之前, 必须 verify 这 4 个产品的真实机制, 决定 Agora 是否需要 follow / 借鉴 / 不借鉴。
>
> §1 约束: 不写 Agora 代码, 不动 Core; 纯 research-only, 落盘供未来 Phase 决策。
> §1.5 约束: 不假装, 不主动扩展, snippet 没验证 = 不假装设计。
> §3 约束: 走 architecture capture + task_dir 标准流程。

## 子目录索引

- [`01-buzz.md`](./01-buzz.md) — Block.xyz Buzz (Nostr-based collaboration)
- [`02-qm.md`](./02-qm.md) — Y Combinator QM (scope-as-first-class multiplayer harness)
- [`03-composable-crm.md`](./03-composable-crm.md) — Composable CRM / Packaged Capability pattern
- [`04-computer-use.md`](./04-computer-use.md) — Anthropic Computer Use (persistent computer workspace)
- [`undecided.md`](./undecided.md) — 4 个产品对 Agora U1/U3/U4 决策的输入
- [findings](../../09-PLANNING/TASKS/2026-08-30-ecosystem-design-inputs/findings.md) — 4 产品 verify 表 + 跟 Agora 8 keywords 命中表
- [progress](../../09-PLANNING/TASKS/2026-08-30-ecosystem-design-inputs/progress.md) — 阶段进度
- [task_plan](../../09-PLANNING/TASKS/2026-08-30-ecosystem-design-inputs/task_plan.md) — 调研 task_plan

## 已确认的事实 (§1.5)

### 1. 这 4 个产品都是真项目, 不是营销话术
- **Buzz**: Block.xyz 官方 release (2026-08), Apache-2.0, github.com/block/buzz, 基于 Nostr 协议
- **QM**: Y Combinator 官方 release (2026-07-29), MIT, github.com/yc-software/qm, 9700+ stars by 2026-08-04
- **Composable CRM**: 不是单一产品, 是 architecture pattern (Salesforce / Odoo / HubSpot 都在 follow)
- **Computer Use**: 不是单一产品, 是 architecture pattern (Anthropic / OpenAI Operator / Google Mariner 都 follow)

### 2. 这 4 个产品跟 Agora turn 25 锁定的 8 keywords 命中表

| 维度 | Buzz | QM | Comp CRM | Computer Use |
|---|---|---|---|---|
| 协同 | ✅ (核心) | ✅ (scope) | ❌ | ❌ |
| 主动 | 部分 (agent 参与 workflows) | ✅ (Auto posture) | ❌ | ❌ |
| 24×7 / 不断运行 | 部分 (open-source 可自托管) | ✅ (durable sandbox) | ❌ | ✅ (persistent) |
| 维护 | ❌ | ✅ (audit trail) | ✅ (组件 lifecycle) | ❌ |
| 分解 / 有架构 | ✅ (channels/threads/code) | ✅ (scope 4 types) | ✅ (PBC 核心) | ❌ |
| 有组织的协同 | 部分 (Nostr 团队) | ✅ (scope + posture) | 部分 (multi-tenant) | ❌ |
| 进化 | ❌ | 部分 (audit → next run) | 部分 (组件迭代) | ❌ |
| 共享 | ✅ (核心) | ✅ (shared scope) | ❌ | ❌ |
| 完成复杂任务 | ✅ (code review + automations) | ✅ (model-driven work) | ❌ | ✅ (做 human 任何事) |
| **受控** (turn 25 关键词) | ⚠️ (无 explicit approve) | ✅ (3 postures) | ❌ | ⚠️ (无 explicit approve) |

**关键 insight**: QM 是唯一一个 **同时** 命中 "有组织 + 受控 + 共享 + 24×7" 的产品。

### 3. §1 边界验证 — Agora 已经是 Composable 模式
- §1 Core Constitution 锁定的 "Core + adapter" pattern = Composable CRM 的 Packaged Capability (PBC)
- Phase 1 WorkSite = 一个 PBC 模板
- 不需要为 "composable" 改造 Agora (§1.5 不主动扩展)
- 可以 (建议级, 不是必须): docs 加一段 "Agora is Composable" 自描述

### 4. QM 的 Scope 设计 = Agora 的 WorkSite + 借用权限 + 组织 posture 三位一体
- QM 把 "Scope" 作为 turn resolution 的第一抽象
- Agora Phase 1 WorkSite 已经有 6 个 type (task/thread/commit/watch/workspace/session)
- 但 Agora WorkSite 是 "引用", 不是 "principal + scope"
- **U3 (Agent 借用边界)** + **U4 (ACL bundled)** 应该参考 QM 三 posture (Strict/Auto/Dangerous) 决议

## 借鉴决策 summary (§1.5)

### ✅ 借鉴
| 来源 | 借鉴什么 | Agora 怎么落地 |
|---|---|---|
| Buzz | Nostr cryptographic identity | 不抄 (Agora §1 不绑 Nostr); 但 WorkSite resolver 保留 "identity portable" 设计空间 |
| Buzz | "Shared context as first-class" | Phase 2 matrix-connector 已经隐式支持 (每 Room = 1 thread) |
| QM | **Scope-as-first-class** | Phase 3+ Agent borrow 设计参考 (principal + scope + posture) |
| QM | **Three-posture (Strict/Auto/Dangerous)** | U3 决策候选 (跟 turn 25 "受控" 对齐) |
| QM | **Audit trail by default** | Agora 已有 audit log, 改为默认启用 |
| QM | **Durable sandbox** | Phase 1 WorkSite `workspace/session` type 已支持类似概念 |
| Comp CRM | **Packaged Capability** | Agora 已经 follow (§1 adapter pattern), docs 可加自描述 |
| Comp CRM | **MACH principles** | Agora 已经 follow (REST+CLI / Headless / Cloud-native) |
| Computer Use | **持久化 workspace** | Phase 1 `worksite/workspace` type 已支持, 不重做 |
| Computer Use | **Human-imitative capability** | Phase 3+ Craftsman adapter 可接 Computer Use 作为底层 |

### ❌ 不借鉴
| 来源 | 不借鉴什么 | 原因 |
|---|---|---|
| Buzz | IM/聊天为核心 | Agora 中央是 task orchestrator, 主语义不同 |
| Buzz | 默认信任 agent | 违反 turn 25 "受控" |
| QM | Core replacement 策略 (Pi/OpenCode/Codex/ClaudeCode 共享 contract) | Agora §1 锁 adapter 模式不同 |
| QM | Slack 为 primary surface | Agora 中央不绑 IM |
| QM | 7 天 npm cooldown | supply chain 控制, 跟 Agora 无关 |
| Comp CRM | SaaS-focused | Agora 是 self-host / open-source 路线 |
| Comp CRM | "buy vs build" 强调 | Agora §1 强调 adapter 自建 |
| Computer Use | 单机 (单 container / VM) | Agora 中央是 multi-agent orchestration |
| Computer Use | screenshot 视觉操作 | 跟 §1 不绑具体 runtime 冲突 |

## 跟踪

- task_dir: `Doc/09-PLANNING/TASKS/2026-08-30-ecosystem-design-inputs/`
- 不开 worktree (§3 纯调研)
- research-only, 不装任何东西, 不写 Agora 代码
- 输入到: `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/undecided.md` (U1/U3/U4 决策)
- 输入到: Phase 2/3/4 设计 (待 U1 决议后)

## 关联

- 旧 DSH 生态调研 (16 DSH 插件, turn 49-51): `Doc/03-ARCHITECTURE/2026-08-29-dsh-ecosystem-probe/`
- Phase 1 (已 merged 到 develop): `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/`
- Phase 1 task_dir: `Doc/09-PLANNING/TASKS/2026-08-30-shared-work-site-phase-1/`
- Tutti·VM brainstorm: `Doc/09-PLANNING/TASKS/2026-08-29-tutti-vm-paradigm-review/`
- turn 25 root goal (8 keywords): §0 / root AGENTS.md / Doc/whitepaper.md