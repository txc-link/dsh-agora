# Architecture: Computer Use (Agent 持久化电脑工作区 pattern) (2026-08-30)

> 来源: 2026-08-30 turn 76 step 2 snippet-only (Anthropic docs full fetch failed turn 76 step 6/8);
> research-only, snippet-level 验证;
> 公开 pattern, 不绑定单一产品。

## 已确认的设计 / 事实 (§1)

### 1. Computer Use = 给 agent 一个 "computer"
- 提供 VM / container / 真机, agent 透过 **screenshot + mouse + keyboard** 操作
- 不是 API 调用, 是 **visual 操作** → agent 能做 human 做的任何事 (含 GUI-only 应用)
- Source 1 (snippet): "Claude can interact with computer environments through the computer use tool, which provides screenshot capabilities and mouse/keyboard control for autonomous..."

### 2. Persistent workspace = 跨 turn 状态保留
- 文件 + 安装的工具 + 配置 跨 turn 保留
- 跟 QM durable sandbox 思路相同 (workspace 不是 ephemeral)
- 关键能力: agent 第 N 步能看到第 1 步写的文件, 不需要重新传 context

### 3. 不是单一产品, 是 architecture pattern
- Anthropic Claude Computer Use
- OpenAI Operator
- Google Project Mariner
- 都 follow 类似 pattern (VM + screenshot + input control)

### 4. "Send Claude to finish tasks" 委托语义
- Source 2 (CNBC snippet): "Anthropic says Claude can now use your computer to finish tasks for you in AI agent push"
- User 把任务"委托" 给 agent, 跨长时间跑 (跟 turn 25 "长期" 完美对齐)

### 5. 关键 insight
- 不是 API 调用, 是 visual 操作 → **human-imitative capability**
- 一个 agent 拿到 Computer Use = 能做 human 在电脑上做的任何事
- 持久化 = agent 能跑长任务 (小时/天), 不丢 state

## 与 Agora 对比 (§2)

| 维度 | Computer Use | Agora | Agora 是否需要跟进 |
|------|--------------|-------|--------------------|
| 协同 | ❌ (单 agent) | ✅ (multi-agent orchestration) | — |
| 主动 | ⚠️ (event-driven) | ✅ (proactive 调度) | — |
| 24×7 | ✅ (persistent workspace) | ✅ (long-running scheduler) | — |
| 不断运行 | ✅ (跨 turn 保留) | ✅ (state machine + recovery) | — |
| 维护 | ✅ (workspace 跨 turn) | ✅ (archive + recovery) | — |
| 分解 | ❌ (单 VM) | ✅ (task graph decomposition) | — |
| 有组织的协同 | ❌ (无 multi-agent) | ✅ (org-aware work OS) | — |
| 进化 | ❌ (无显式 memory) | ✅ (archive + replay) | — |
| 共享 | ❌ (单 container) | ✅ (cross-agent context) | — |
| 完成复杂任务 | ✅ (human-imitative) | ✅ (multi-agent 协同) | — |

**关键 insight**:
- Computer Use 直接命中: **完成复杂任务** (human-imitative), **24×7** (persistent), **维护** (workspace 跨 turn)
- Agora 命中: **全部 10 维度**
- Computer Use 是 **execution layer** 终极能力, Agora 是 **orchestration layer**
- 两者不冲突, 可组合: Agora 调度 → Computer Use 执行

## 借鉴决策 (§1.5 first-principles)

### 可借鉴
- **持久化 workspace 概念** — Agent 跨 turn 保留 file state
  - Agora Phase 1 WorkSite 的 `worksite/workspace` type 已经支持类似概念
  - 不需要新做, 已对齐
- **Human-imitative capability** — Agent 能做 human 做的 (含视觉判断 / GUI 操作)
  - Agora 的 Craftsman adapter 层可以 follow
  - e.g. `dsh-claude-code` adapter 用 Claude Computer Use 作为底层实现
- **"Send user to send Claude to finish tasks"** 委托语义
  - turn 76 step 2 CNBC snippet
  - user 把任务"委托" 给 agent 跨长时间 (跟 turn 25 "长期" 完美对齐)
  - Agora 的 long-running task model 已经支持

### 不借鉴
- **Computer Use 是单机** (单 container / VM)
  - Agora 中央是 multi-agent orchestration
  - 把 Computer Use 当成 agent-runtime adapter 即可, 不进 Core
- **Computer Use 强调 GUI 操作**
  - Agora §1 不绑具体 agent runtime (Claude Code / Codex 都可以)
  - GUI 操作是 adapter 层的事
- **Computer Use 没显式 "受控" 机制** (跟 Buzz 类似)
  - Agora turn 25 "受控" 是核心 (governance gate + approval)
  - 如果 Agora 接 Computer Use, **必须** 加治理层 (adapter 包, 不进 Core)

## 跟 Agora 已落地 Phase 1 的差异 (§4)

### Phase 1 WorkSite 类型
- Union 6 个: `task / thread / commit / watch / workspace / session`
- `workspace` type 已经表达了 "持久化电脑工作区" 的语义

### 直接对齐
- Computer Use pattern 跟 Agora `worksite/workspace` type **直接对齐**
- Phase 1 设计已经覆盖了 Computer Use 的核心语义 (持久化 + 跨 turn 状态)

### 不要
- Agora 不需要重做 Computer Use (违反 §1 "Core 不绑具体 Runtime")
- 不在 Core 加 screenshot / mouse / keyboard 抽象 (那是个 Computer Use specific 实现)

### 可以
- Agora 的 Craftsman adapter 层可以接 Claude Computer Use 作为底层实现
- Phase 3+ 评估, 不在 Phase 1/2 范围

## 风险/限制 (§5)

### 数据来源风险
- Anthropic docs fetch 失败 (turn 76 step 6/8) — full design 没 verify
- snippet-level 验证, 不是完整 design doc

### Computer Use 本身风险
- **Slow + 不可靠**: screenshot + mouse 是 pixel-level 操作, 易碎 (UI 改了就崩)
- **安全**: agent 有 screenshot = 能看用户屏幕 (隐私); 有 mouse/keyboard = 能操作任意 UI
- **持久化 = 风险持久化** (跟 QM durable sandbox 同): 错误配置跨 turn 保留
- **平台 lock-in**: Anthropic API 是 vendor-specific (OpenAI / Google 各自独立)

### 对 Agora 的含义
- §1 锁定的 "adapter 模式" 已经避开 vendor lock-in (Core 不绑 Anthropic / OpenAI)
- 接 Computer Use = adapter 包, Core 不变
- 必须加治理层 (受控 / approval), 不直接暴露 mouse/keyboard 给 untrusted agent

## 关联 (§6)

- Phase 1 WorkSite `workspace` type — `agora://workspace/<id>` URI
- Craftsman adapter layer (待 Phase 3+) — 可接 Computer Use 作为底层
- Tutti·VM: `Doc/09-PLANNING/TASKS/2026-08-29-tutti-vm-paradigm-review/`
  - Tutti·VM 跟 Computer Use 的 persistent workspace 是同一思路

## 跟踪 (§7)

- task_dir: `Doc/09-PLANNING/TASKS/2026-08-30-ecosystem-design-inputs/`
- 不开 worktree (§3 纯调研, snippet-level)
- research-only, snippet-level 验证 (full fetch failed)
- 不装, 不写代码
- **future work**: 当 Anthropic docs 可 fetch 时, 补 design doc

## Sources (snippet-level)

- Source 1: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool (turn 76 step 2 snippet)
  - "Claude can interact with computer environments through the computer use tool, which provides screenshot capabilities and mouse/keyboard control for autonomous..."
  - full doc fetch failed (turn 76 step 6/8)
- Source 2: https://www.cnbc.com/2026/03/24/anthropic-claude-ai-agent-use-computer-finish-tasks.html (turn 76 step 2 snippet)
  - "Anthropic says Claude can now use your computer to finish tasks for you in AI agent push · Anthropic is trialling a feature that lets users send..."

## License / Status

- 来源 license: 公开 pattern (Anthropic docs + CNBC 公开报道)
- 状态: research-only, snippet-level, partial data
- 不是产品建议, 是 architecture pattern 调研