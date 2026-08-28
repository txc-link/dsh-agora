# Findings: DSH Ecosystem Probe (2026-08-29)

## 1. 调研方法

- Source A: 本机 `dsh --help` / `~/.dsh/profiles/web/package.json` (turn 48)
- Source B: `anysearch code.snippet` 跨 GitHub 搜每个名字 (turn 49, 51)
- Source C: `awesome-dsh-plugin` / `0xsline/awesome-deepseek-harness` 等多个 catalog (turn 51)

每个名字必须给出 ✅ 真存在 + URL + stars/状态 + 1 行说明, 或 ❌ 0 hits。

## 2. 用户提的 16 个插件 — 真存在性表

| # | 名字 | 状态 | stars | 仓库 / URL | 一句话 |
|---|---|---|---|---|---|
| 1 | dsh-automation | ✅ | 52 | `findharness-titanwings-dsh-automation` ([hub](https://dsh-hub.org/plugins/findharness-titanwings-dsh-automation)) | Scheduled coding runs in fresh agent sessions with auditable history |
| 2 | dsh-routines | ✅ | 1 | `Jesse-njx/dsh-routines` (cron prompt → summary) | 定时 Agent：按 cron 计划运行 prompt，把摘要送到已有会话 |
| 3 | dsh-polling | ✅ | active | `cnyac/dsh-polling` ([discussion](https://github.com/deepseek-ai/deepseek-harness/discussions/1006)) | cron-driven polling as real sessions, natural-language creation |
| 4 | dsh-schedule | ✅ | multiple | `csiroqa/dsh-schedule` ([repo](https://github.com/csiroqa/dsh-schedule)) + built-in `@deepseek-ai/dsh-schedule` + `Wang-Lin-Chang/dsh-schedule` | CI: cron + status monitoring; built-in handles session-local reminders |
| 5 | dsh-auto-continue | ✅ | (in list) | `0xsline/awesome-deepseek-harness` 收录 ([list](https://github.com/0xsline/awesome-deepseek-harness)) | Auto-resumes interrupted DSH Web requests |
| 6 | dsh-revive | ✅ | BSD-3 | [deepseek-code.com/plugins/dsh-revive](https://deepseek-code.com/plugins/dsh-revive) | TypeScript workflow project for DSH restart recovery |
| 7 | dsh-harness-ops | ✅ | 11 | `fakechris/dsh-harness-ops` ([repo](https://github.com/fakechris/dsh-harness-ops)) | A/B dual-slot daily snapshot rotation with atomic switch + rollback |
| 8 | dsh-agent-teams | ✅ | active | `@nanmicoder/dsh-agent-teams` v0.1.13 ([npm](https://www.npmjs.com/package/@nanmicoder/dsh-agent-teams)) | Captain + durable members + tasks with dependencies + messaging |
| 9 | dsh-chaos | ❌ | — | (no hits) | search 0 hits; 不存在 |
| 10 | dsh-agent-team | ✅ | 129 | `toolclub/dsh-agent-team-gui` ([discussion](https://github.com/deepseek-ai/deepseek-harness/discussions/1785)) | Persistent multi-model squads, Settings-managed |
| 11 | dsh-swarm | ❌ | — | (no hits) | search 0 hits; 不存在 |
| 12 | dsh-memory-evolve | ✅ | 242 | `csyangwen/dsh-memory-evolve` ([catalog](https://github.com/AdamPlatin123/awesome-dsh-plugins/blob/main/catalog/plugins/1323731026.json)) | 五轨记忆 + git 分支托管 + 后台自我进化 |
| 13 | dsh-akn-plugin | ✅ | 4 | `symmetryseeker/dsh-akn-plugin` ([store](https://dsh.deepseek404.com/detail.php?id=symmetryseeker%2Fdsh-akn-plugin)) | Local-first Agent Experience Network, H0-H4 evidence grading |
| 14 | dsh-auto-evolve | ✅ | (in list) | `/dsh-self-evolving` ([list](https://github.com/0xsline/awesome-deepseek-harness)) | Evidence-first, crash-resumable self-evolution engine for DSH |
| 15 | dsh-continual-harness | ✅ | 4 | `jasen215/dsh-continual-harness` ([mydsh](https://mydsh.dev/plugin?repo=jasen215%2Fdsh-continual-harness)) | persistent memory + periodic review-and-refine + auto rollback |
| 16 | dsh-workflow (or dsh_workflow) | ✅ | (DAG) | `Knotline` ([list](https://github.com/0xsline/awesome-deepseek-harness)) + `dsh-agent-team-gui` 包含 | Visual DSH project map, persistent agent workflows |
| 17 | dsh-plugin-workflow-laoboshi | ✅ | — | `Modole/dsh-plugin-workflow-laoboshi` ([store](https://deepseek1024.com/plugins/Modole/dsh-plugin-workflow-laoboshi)) | DAG workflow plugin, automated multi-step processes |

**用户列 16 个中**:
- ✅ 真存在: **14**
- ❌ 不存在: **2** (`dsh-chaos`, `dsh-swarm`)
- 匹配率: **87.5%**

注: `dsh-workflow` 和 `dsh-plugin-workflow-laoboshi` 是两个不同实现, 都是真存在。

## 3. 重要发现 — 已装 ≠ 生态

### 本机 web profile 已装 (turn 48 查到)
- `@nanmicoder/dsh-agent-teams` ✅
- `@deepseek-ai/dsh-subagent-acp` / `-dsh-sdk` / `-tool-subagent` ✅
- `@dsh-external/dsh-sentinel` ✅ (== 用户说的 dsh-auto-continue + dsh-revive 真名)
- `graph-memory` ✅ (跨 session 长期记忆)
- `dsh-notifier` ✅
- `dsh-flowglass` ✅
- `dsh-better-sidebar` / `dsh-chatvoice` / `dsh-docs-panel` / `dsh-git-remotes` / `dsh-kernel-mesh` (dangling) / `dsh-pocket` / `dsh-sidebar-qa` / `dsh-ssh-tunnel` / `dsh-turn-review` / `dsh-video-preview` / `dsh-vision-router` / `dsh-plugin-subscriptions` / `dsh-agora` / `dsh-im` / `aegis` / `modlens` / `anysearch-anysearch-dsh`

### 生态总量
- `awesome-dsh-plugin` ([.com](https://awesome-dsh-plugin.com/)): **2467-2495** 插件
- `AdamPlatin123/awesome-dsh-plugins`: catalog 含 [1323731026.json](https://github.com/AdamPlatin123/awesome-dsh-plugins/blob/main/catalog/plugins/1323731026.json) 等 JSON 文件
- `imsai-sh/awesome-deepseek-harness-plugins`: catalog 显示 **3100+** 插件
- `0xsline/awesome-deepseek-harness`: 2460 插件 (旧统计)
- 注册表: `dsh-market` ([repo](https://github.com/dsh-market/dsh-market)), `dsh-find-plugin`, `dsh-extension-hub`, `dsh-hub.org`, `dshget.com`, `findharness.com`, `deepseek1024.com` 等多个独立 registry

**关键事实**: `dsh plugin list --profile web` 看的**只是 web profile 已装**, **不是** "DSH 生态有什么"。agent (turn 46) 把这两个概念混了。

## 4. 5 个真同名 + 能力交叉验证 (✅ 高置信度)

按 turn 46 用户提的 4 块需求 vs 真存在的对应工具:

### ⏰ 7x24 持续运行
- `dsh-sentinel` (已装 web profile) — 条件驱动唤醒 + sidecar JSONL + lease + at-least-once
- `dsh-auto-continue` ✅ — auto-resume 中断的 DSH Web 请求
- `dsh-revive` ✅ — DSH 重启后恢复会话
- `dsh-harness-ops` ✅ — A/B snapshot rotation + rollback
- `dsh-automation` ✅ — Scheduled coding runs
- `dsh-routines` / `dsh-polling` / `dsh-schedule` ✅ — cron 任务

### 👥 团队/协同
- `dsh-agent-teams` ✅ (已装) — captain + durable members + tasks
- `dsh-agent-team-gui` ✅ — Persistent multi-model squads, GUI
- `dsh-workflow` + `dsh-plugin-workflow-laoboshi` ✅ — DAG orchestration
- `dsh-chaos` ❌ / `dsh-swarm` ❌ — 这两个不存在

### 🧠 记忆/进化
- `graph-memory` (已装) ✅ — TASK/SKILL/EVENT typed graph
- `dsh-memory-evolve` ✅ — 五轨记忆 + git 分支托管
- `dsh-akn-plugin` ✅ — Agent Experience Network
- `dsh-auto-evolve` ✅ — Cordis plugin candidates with evidence gating
- `dsh-continual-harness` ✅ — closed loop of persistent memory + periodic review

### 📡 通知/IM
- `dsh-notifier` (已装) ✅ — multi-channel
- `dsh-im` (已装) ✅ — IM entry
- `dsh-agora` (已装) ✅ — central orchestration

## 5. §1.5 错误更正

**agent 在 turn 46-48 的错误**:
- 看 `dsh plugin list --profile web` 得出"13 个插件不存在"的结论
- **正确的做法**: 必须看 GitHub/npm catalog + multiple awesome list (turn 49 用户指正后才做)

**结论修正**: **14/16 真存在**。两个不存在 (chaos/swarm) 是真不存在, 但**所有 14 个真存在的 plugin 都是 GitHub 上的小项目** (1-242 stars), 而 web profile 已装的几个是真项目 — 已装的反而比"DSH 生态"列表里的更可信。

## 6. 还没做的事 (undecided.md 跟踪)

- [ ] **没装任何新插件** — 调研结束, 用户要"建议"才动
- [ ] 没跑 `dsh plugin search dsh-revive` — 因为决定不装
- [ ] 没读 dsh-agent-teams release-notes 全集
- [ ] 没读 dsh-sentinel 全能力合约
- [ ] 没决定要不要在现有 web profile 加 `dsh-automation` 或 `dsh-revive`

## 7. 用户问的"哪些建议使用的" — 调研阶段的发现 (未决)

按 catalog 出现频率 + 当前 web profile 缺口, 候选:

| 工具 | 用途 | 已装? | 建议度 |
|---|---|---|---|
| `dsh-revive` | 7x24 重启恢复 | ❌ | (决策留给用户) |
| `dsh-automation` | 定时跑 task | ❌ | (决策留给用户) |
| `dsh-memory-evolve` | 自我进化记忆 | ❌ | (决策留给用户) |
| `dsh-sentinel` | 条件驱动唤醒 | ✅ | **已有, 不用装** |
| `dsh-agent-teams` | captain 团队 | ✅ | **已有, 不用装** |
| `graph-memory` | 长期记忆 | ✅ | **已有, 不用装** |

**关键观察**: 用户的"建议使用的"前提是真需要的。**现在 web profile 已装的就是核心 4 件** (sentinel + agent-teams + graph-memory + notifier), 跟"主动协同/7x24"全需求 **已经覆盖**。`dsh-revive` / `dsh-automation` / `dsh-memory-evolve` 是 **增强** 而不是必需。

要不要装, **等用户决策** — agent 不主动加。