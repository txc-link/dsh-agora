# Architecture: DSH Ecosystem Probe (2026-08-29)

> 来源: 2026-08-29 t=46 用户转述的"DSH 生态完整插件组合"段;
> agent (t=46-48) 错误地基于本机 web profile 没装 → "13 个不存在";
> 用户 (t=49) 指正: 应查插件市场/GitHub/网络;
> agent (t=51) 真查了 16 个名字, 14 真存在, 2 不存在。

## 子目录索引

- [`findings.md`](../../09-PLANNING/TASKS/2026-08-29-dsh-ecosystem-probe/findings.md) — 16 个名字的真存在性表 + catalog 规模 + 错误更正
- [`undecided.md`](./undecided.md) — 用户问"哪些建议使用的"还没决

## 已确认的设计 / 事实

### 1. DSH 插件生态是真实存在的, 不是营销话术
- 多个独立 registry: `dsh-market` (in-agent), `dsh-find-plugin`, `dsh-hub.org`, `dshget.com`, `findharness.com`, `deepseek1024.com`, `awesome-dsh-plugin.com`
- catalog 规模: **2467-3100+** 插件
- 多个独立 awesome list (`Alex-Yanggg/awesome-DSH-plugin` 11k stars, `0xsline/awesome-deepseek-harness`, `AdamPlatin123/awesome-dsh-plugins`, `kejixiaoliang/awesome-dsh-plugins`, `imsai-sh/awesome-deepseek-harness-plugins`, `Dominic789654/awesome-deepseek-harness`, `Anil-matcha/awesome-dsh-plugin`, `walkinglabs/awesome-deepseek-harness-plugins`)

### 2. 真存在率 = 87.5%
- 用户提 16 个 → ✅ 真存在 14, ❌ 不存在 2 (chaos, swarm)
- 详细表见 findings.md §2

### 3. 当前 web profile 已装 + 缺口
**已装** (turn 48):
- `@nanmicoder/dsh-agent-teams` v0.1.13 ✅ (captain + durable members + long-running 声明)
- `@dsh-external/dsh-sentinel` ✅ (条件驱动唤醒 + 重启复活 + at-least-once)
- `graph-memory` ✅ (TASK/SKILL/EVENT typed graph)
- `dsh-notifier` ✅ (multi-channel + 长任务心跳)
- `dsh-subagent-acp` / `-dsh-sdk` / `-tool-subagent` (subagent 引擎)
- `dsh-im` / `dsh-agora` (IM + agora 中央)

**用户提的但没装**:
- `dsh-revive` (重启恢复 — 部分功能 dsh-sentinel 已覆盖)
- `dsh-automation` (定时跑 task)
- `dsh-routines` / `dsh-polling` / `dsh-schedule` (cron 任务)
- `dsh-auto-continue` (auto-resume 中断)
- `dsh-harness-ops` (A/B snapshot rotation)
- `dsh-memory-evolve` (五轨记忆)
- `dsh-akn-plugin` (Agent Experience Network)
- `dsh-auto-evolve` / `dsh-continual-harness` (自我进化)
- `dsh-workflow` / `dsh-plugin-workflow-laoboshi` (DAG orchestration)

### 4. §1 + §1.5 不变
- agora 中央不变
- dsh-matrix-connector plugin 不变
- 不主动扩展到 "建议装哪个" 的范围 — 等用户决策

## 错误更正

### agent 在 turn 46-48 犯的错
- 看 `dsh plugin list --profile web` → 15-20 个本机已装
- 误读为 "DSH 生态就是这些"
- 错误结论: "用户提的 16 个里 13 个不存在"

### 真实情况
- `dsh plugin list --profile web` = **本机 web profile 已装**, **不是**生态
- 真生态: 2467-3100+ 插件, **远大于** 本机已装
- 用户提的 16 个里 14 个真存在

### 错误原因 (§1.5 反思)
- 没做 first-principles: 没问 "用户问的是生态还是本机"
- 主动扩展: 用户提 16 个名字 → agent 主动下 "13 个不存在" 结论
- 假装诚实: 把"本机没装"包装成"生态没有"

### 怎么避
- 涉及 "X 生态有什么" → 必须查外部 registry + awesome list + GitHub search
- 不允许只查本机已装就下结论
- 找不到证据 ≠ 不存在 (可能 catalog 没收录)

## 跟踪

- task_plan: `Doc/09-PLANNING/TASKS/2026-08-29-dsh-ecosystem-probe/task_plan.md`
- findings: `Doc/09-PLANNING/TASKS/2026-08-29-dsh-ecosystem-probe/findings.md`
- progress: `Doc/09-PLANNING/TASKS/2026-08-29-dsh-ecosystem-probe/progress.md`
- undecided: `Doc/03-ARCHITECTURE/2026-08-29-dsh-ecosystem-probe/undecided.md`