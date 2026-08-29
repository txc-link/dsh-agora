# Architecture: Buzz — Block.xyz Agent Collaboration Platform (2026-08-30)

> **Status**: research-only, no commitment, no install, no code.
> **来源**: [block.xyz/inside/introducing-buzz-where-humans-and-agents-work-together](https://block.xyz/inside/introducing-buzz-where-humans-and-agents-work-together) (fetched 2026-08-29).
> **License**: Apache-2.0.
> **Repo**: `github.com/block/buzz`.
> **Site**: `buzz.xyz`.
> **关联任务**: `Doc/09-PLANNING/TASKS/2026-08-30-ecosystem-design-inputs/`。

## 1. 已确认的设计 / 事实

> 仅采纳 Block 官方稿明确写出的事实, 不外推。

- **协议层**: 基于 **Nostr**, 不是 Matrix / Slack / Discord 私有协议。
- **身份**: 每个参与者 (人或 agent) 持一对 **cryptographic keypair**; 身份可移植到任何 Nostr-compatible 系统, 不绑定 Block 平台。
- **模型无关 / agent 无关**: 不绑定单一 LLM 或 agent 框架, 已声明支持 Claude Code / Codex / goose / bring-your-own / build-new。
- **Stack (协作 surface)**: channels、threads、DMs、voice、media、code repos、automated workflows。
- **权限**: 由 team 配置, 每个 agent 单独声明可做哪些事 (post / review code / run approved automations / participate in conversations)。
- **信任模型原话**: "humans and agents in the same room, working on the same thing, with shared context" — 把 context 当 first-class, 不分人/机。
- **Git 集成**: 早期阶段 (per Block), 未来方向 "host projects + discuss + review changes + work alongside agents in one place"。
- **License**: Apache-2.0, 开源, 不是闭源 SaaS。

## 2. 与 Agora 对比 (4 维度)

> 关键词来自 turn 25 锁定的 8 个: 协同 / 主动 / 24×7 / 不断运行 / 维护 / 分解 / 有组织的协同 / 进化 / 共享 / 完成复杂任务。
> 标记规则: ✅ 直接命中该维度 (平台明确支持) / ⚠️ 部分命中 / ❌ 不命中。

| 维度 | Buzz | Agora | Agora 是否需要跟进 |
| --- | --- | --- | --- |
| 协同 | ✅ channels + threads + DMs + voice | ✅ Core Task/Context/Participant + IM adapter | 已领先 (Agora 中央是 task orchestrator, Buzz 是 surface) |
| 主动 | ✅ automated workflows | ✅ runtime binding + scheduler | 不需, 抽象已对 |
| 24×7 | ⚠️ 取决于 relay + agent 部署 | ✅ sentinel 已落地 (持续唤醒 + 重启复活) | 不需, sentinel 已覆盖 |
| 不断运行 | ⚠️ agent process 由各 runtime 保证 | ✅ Core scheduler + recovery | 不需 |
| 维护 | ⚠️ Nostr relay 维护归 operator | ✅ Core archive + state machine | 不需 |
| 分解 | ⚠️ workflows 是声明式, 非显式 DAG | ✅ Core graph / scenario primitives | 不需 |
| 有组织的协同 | ⚠️ channel-level 隔离, 不等于 role/org | ✅ org-aware Work OS (Phase 2 在议) | 不需 |
| 进化 | ❌ 平台不主张 agent 自身进化 | ⚠️ U3 agent 借用审批已 lock, "进化" 是组织语义 | 不需 |
| 共享 | ✅ shared context as first-class | ✅ Phase 1 WorkSite URI `agora://<type>/<id>` 已落地 | 已领先 (抽象更通用, 不绑 IM 协议) |
| 完成复杂任务 | ✅ review code + run automations in surface | ✅ Core task orchestration 全链路 | 已领先 (Agora 把 surface 留给 adapter, Buzz 自己就是 surface) |

**小结**: Buzz 直接命中 3 项 (协同 / 共享 / 完成复杂任务), 全部命中 8 项中 Buzz 仅这 3 项, 其余 5 项是"协作 surface 隐含", 不是平台主张。Agora 全部 8 项已覆盖 (其中 24×7 已由 sentinel 落地, 共享已由 Phase 1 WorkSite 落地)。

## 3. 借鉴决策 (§1.5 first-principles)

> §1.5: 不允许兼容性补丁; 不允许过度设计; 不允许扩展到用户未要求的范围; 必须主链路自洽。

### 可借鉴

- **Nostr-style cryptographic identity**: 跨平台携带身份, agent keypair 在多个 system 间复用 — 这一思路与 Agora "Participant 是抽象 actor, 持有可移植凭证" 的方向一致, 不绑任何 IM provider。
- **Model-agnostic agent framing**: Buzz 明确不锁模型/agent, Agora Core §1 已锁定 (Core 不绑任何具体 Runtime/Craftsman)。这一项是 §1 已锁, 不是 Buzz 首创, 但 Buzz 是**外部第三方对同一原则的独立确认**。
- **"Shared context as first-class"**: Buzz 把 conversation + code + git review 放在同一 surface, 不让人/agent 在多个工具间切换。Agora Phase 1 WorkSite URI `agora://<type>/<id>` 是同一思想的抽象层版本, 且抽象更彻底 (不绑 Nostr / Matrix / Slack 任一协议)。

### 不借鉴

- **Buzz 是 IM/聊天为核心**: Agora 中央是 task orchestration, 主语义不同。把 Buzz 的 channel/thread 模型当 Core 主模型会违反 §1。
- **Buzz 默认信任 agent**: 没有 explicit "受控" / gate / approval 语义 (turn 25 关键词之一)。Agora U3 已 lock agent 借用/审批, 与 Buzz 默认信任路径不兼容。
- **Buzz 没有 agent 借用/审批**: agent 在 channel 里直接 post/review/automate, 不经过"借出-归还"流程。Agora 的 U3 lock 与 Buzz 这条默认路径互斥, 不能套用。

## 4. 跟 Agora 已落地 Phase 1 的差异

> Phase 1 已落地见 `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/`。

- **Phase 1 WorkSite** = 抽象层 URI (`agora://<type>/<id>`), 与具体 IM 协议 / Git 平台 / DB 无关, 由 adapter 投影。
- **Buzz** = 一个**实际** Nostr-based collaboration surface (channels/threads/code review 全包), 把 surface 协议栈**自己实现并持有**。
- **关键差异**:
  - Agora = 中央 orchestration, **把 surface 留给 adapter** (matrix / sentinel / git / dashboard 各做一个 adapter 投影到同一 URI 空间)。
  - Buzz = **自己就是 surface**, 用 Nostr 把 surface 替换了, 中央 orchestration 仍是 Buzz 自带的 channel/thread 逻辑。
  - 含义: Buzz 不是 "另一个 Agora adapter 候选", 因为它不只暴露协议, 还承载应用语义。强行适配等于把 Buzz 的 channel/thread 当 adapter 状态, 但 Buzz 的协作语义 (NIP event kinds, relay 路由, keypair social graph) 会反过来渗入 Core, 违反 §1。
- **Phase 2 含义 (matrix-connector, 待 U1 决议)**:
  - matrix-connector 可以**学习 Buzz 的两条**: shared context as first-class (URI 已经在做) + agent identity portable (Nostr keypair 是参考形态, matrix 的 `access_token` 是另一形态)。
  - matrix-connector **不学** Buzz 的 surface 一体化 — 保留 matrix 多 Room 模拟 thread 的 turn 59 lock, 不替 matrix 选 Nostr。

## 5. 风险 / 限制

- **Git 集成早期阶段**: Block 自己写 "early-stage", code review + project hosting + work alongside agents 全部未到生产质量。
- **Nostr 仍是 niche protocol**: 与 Matrix / Slack / Teams 相比, relay 生态、客户端覆盖、运维工具、企业合规都薄。Block 押注 Nostr 是赌协议层胜利, 不是赌 Buzz 单产品胜利。
- **Block 的 vested interest**: Block = Square / Cash App / Tidal / TBD 母公司, Buzz 与 Block 商业版图强绑定, governance 路线、agent 默认信任策略、数据 relay 选择都可能受商业驱动, 不是纯社区项目。
- **Self-host vs hosted trade-off**: Nostr relay 可自托管, 但 agent runtime / LLM API / git hosting 全是另外一层; 真实部署比单 docker-compose 复杂, "data / relay / agents control" 三层各有取舍, Block 没说提供统一 SLA。

## 6. 关联

- **Phase 1 (已落地)**: `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/` — WorkSite URI 抽象 + matrix-connector 投影。
- **Phase 2 (待 U1 决议)**: matrix-connector 是否引入 Buzz-style shared-context 表达, 但保留 matrix 多 Room 模拟 thread (turn 59 lock)。
- **Tutti·VM brainstorm**: `Doc/09-PLANNING/TASKS/2026-08-29-tutti-vm-paradigm-review/` — Buzz 的 "shared context as first-class" 与 Tutti·VM 的 multi-agent context 假设同源, 但 Tutti·VM 走 VM sandbox, 走法不同。

## 7. 跟踪

- **task_dir**: `Doc/09-PLANNING/TASKS/2026-08-30-ecosystem-design-inputs/`
- **worktree**: **不开** (§3 纯调研, 不写代码, 不改 Core, 不改 adapter; 仅落盘此 capture doc)。
- **scope**: research-only, **不装**, **不写代码**, **不提交到 plugin catalog**, **不替 Buzz 在 Agora 任何 layer 立项**。
- **下一步**: 等用户对 §3 借鉴决策做 review; 未 review 前不向 Phase 2 matrix-connector 或任何其他 adapter 推任何 Buzz 元素。
