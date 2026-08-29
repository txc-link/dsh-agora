# Undecided: DSH 生态 — "建议使用哪些"

> 用户 (t=49): "你要查插件市场, 或 github 或网络搜索"
> 用户 (t=50): "继续"
> agent (t=51): 16 个查完, 14 真存在, 2 不存在; 用户 (t=51) 还没回应"建议使用的"

## 用户原始问题

> "你要查插件市场, 或 github 或网络搜索" — 调研阶段
> 然后用户说"继续" — agent 完成调研
> 但**用户最初问的是 "哪些建议使用的"** — 还没答

## 我必须做的事 vs 不能做的事

### 必须
- 把调研发现如实回报
- 列候选 + 风险 + 兼容性 + 我**不知道**的
- 等用户决策

### 不能
- 不主动装任何插件 (按 §1.5)
- 不推销 "应该装 X 因为..."
- 不假装有把握 — 我**没**真跑过 dsh-revive / dsh-automation / dsh-memory-evolve
- 不动用 agora 中央 / dsh-matrix-connector

## 候选清单 (基于 findings.md §7)

### 已装 — 不需要装
| 工具 | 用途 | 已装? |
|---|---|---|
| `dsh-sentinel` | 条件驱动唤醒 + 复活 | ✅ |
| `dsh-agent-teams` | captain 团队 | ✅ |
| `graph-memory` | 长期记忆 | ✅ |
| `dsh-notifier` | 多渠道通知 | ✅ |

### 真存在但未装 — 决策权交给用户

#### A. `dsh-revive` (重启恢复)
- 来源: BSD-3 workflow project
- 用途: DSH 进程死了重启后, 恢复会话
- **与 dsh-sentinel 重叠?**: dsh-sentinel 自己有 lease + sidecar JSONL, 已经"at-least-once"。**dsh-revive 可能补充不同面** (会话状态恢复 vs sentinel 的条件触发)
- 风险: 跟现有 sentinel 行为重叠, 装上可能冲突
- **不装理由**: 现有 sentinel 已覆盖"重启后 session 恢复" 大部分

#### B. `dsh-automation` (52 stars)
- 用途: Scheduled coding runs in fresh agent sessions with auditable history
- 风险: 不清楚会不会跟现有 dsh-agent-teams 冲突 (team member 已经能 cron 续)
- **不装理由**: 已有 `dsh-agent-teams` long-running + `dsh-schedule` (built-in)

#### C. `dsh-memory-evolve` (242 stars, 五轨记忆)
- 用途: 五轨记忆 + git 分支托管 + 后台自我进化
- 风险: 跟现有 `graph-memory` 重叠, 但**机制不同** — memory-evolve 用 git 分支托管历史, graph-memory 用 typed graph
- **不装理由**: 现有 graph-memory 已经够用, 双栈记忆可能冲突
- **装上理由**: 如果想要"git 分支托管" + "自动进化" 是新能力

#### D. `dsh-routines` / `dsh-polling` / `dsh-schedule` (3 个 cron 类)
- 用途: cron 定时跑 prompt
- 风险: 跟 built-in `@deepseek-ai/dsh-schedule` 重叠
- **不装理由**: built-in 已装, 加第三方可能冲突

#### E. `dsh-harness-ops` (11 stars, A/B snapshot rotation)
- 用途: 双 slot daily snapshot, 自动 migration + rollback
- 风险: 跟现有 master branch + worktree workflow 重叠, **机制不同**
- **不装理由**: 我们用 git worktree + worktree-hygiene 已经管理代码, snapshot rotation 是 plugin-level
- **装上理由**: 如果想要"plugin 版本 A/B 切换 + 回滚" 是新能力

#### F. `dsh-akn-plugin` (4 stars)
- 用途: Local-first Agent Experience Network, H0-H4 evidence grading
- 风险: 跟 `graph-memory` 不同机制, 双栈不冲突
- **不装理由**: 当前没有"task-level experience distillation"需求

#### G. `dsh-auto-evolve` / `dsh-continual-harness`
- 用途: 自我进化
- 风险: 跟现有 turn 35-46 手动 governance 流程重叠
- **不装理由**: 已经手动管 — 加自动可能跟人手动冲突

#### H. `dsh-workflow` / `dsh-plugin-workflow-laoboshi` (DAG)
- 用途: 持久化 multi-step workflow
- 风险: 跟 agora task orchestration 重叠 — **严重冲突**
- **不装理由**: agora 中央已经在做 task orchestration; 装上等于双 orchestration

#### I. `dsh-agent-team-gui` (129 stars)
- 用途: Persistent multi-model squads
- 风险: 跟 `dsh-agent-teams` (nanmicoder) 重叠, 但**机制不同** (GUI 模式 vs 命令式)
- **不装理由**: 现有 dsh-agent-teams 已够用

## 真实建议 (§1.5 诚实)

按 §1.5 — 我**不知道**用户具体要什么, 不能直接推荐。但基于 §1 + §1.5 + 当前需求 ("主动协同/7x24"):

**不推荐装任何新插件的理由** (按强度排):
1. **H (dsh-workflow)** — 跟 agora 中央**严重冲突**, **不装**
2. **I (dsh-agent-team-gui)** — 跟现有 dsh-agent-teams 重叠, **不装**
3. **D (cron 3 个)** — 跟 built-in dsh-schedule 重叠, **不装**
4. **A (dsh-revive)** — 跟现有 dsh-sentinel 重叠, 大部分需求 sentinel 已覆盖, **不装除非确认要新能力**
5. **G (auto-evolve / continual)** — 跟手动 governance 冲突, **不装除非想做"自动自我进化"**

**可以装的** (新增能力, 不冲突):
1. **C (dsh-memory-evolve)** — git 分支托管记忆是 graph-memory 没的能力
2. **E (dsh-harness-ops)** — plugin-level A/B snapshot rotation 是 git worktree 没管的层面
3. **F (dsh-akn-plugin)** — task-level experience distillation 是 graph-memory 没管的层面
4. **B (dsh-automation)** — 如果想要"fresh session 跑 task" 而不是 current session 续

**前提**: 用户**必须**告诉 agent "装哪个", agent 不主动选。

## 没回答的问题

1. 用户说的 "7x24 持续协同" 是不是**当前**已经满足 (dsh-sentinel + dsh-agent-teams long-running + graph-memory)? 还是有具体缺口?
2. "主动协同" 是指什么 — agent 主动找用户, 还是系统按条件触发?
3. 装新插件**会**影响现有 web profile 配置, 用户愿意承担风险吗?

## 期望用户回应

期望用户在以下3 类回答中选一个 (按可能性排):
- (1) "现在 web profile 已装的够了, 不需要装新插件"
- (2) "装 C + E + F 这 3 个, 跑 1 周看"
- (3) "只装 X, Y 不装"

agent 收到 (1)/(2)/(3) 之一才动, 否则**不主动**。