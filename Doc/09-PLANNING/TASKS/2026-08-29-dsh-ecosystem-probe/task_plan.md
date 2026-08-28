# Task: DSH Ecosystem Probe — 真存在性核查

## 1. 目标

用户(t=46) 转述了一段"DSH 生态提供7x24 主动协同完整插件组合"的话, 列了16 个插件:
- dsh-automation / dsh-routines / dsh-polling / dsh-schedule
- dsh-auto-continue / dsh-revive / dsh-harness-ops
- dsh-agent-teams / dsh-chaos / dsh-agent-team / dsh-swarm
- dsh-memory-evolve / dsh-akn-plugin / dsh-auto-evolve / dsh-continual-harness
- dsh_workflow / dsh-plugin-workflow-laoboshi

agent (turn 46) **错误**地基于 `dsh plugin list --profile web` 的本机已装列表下了"13 个不存在"的结论。
用户(t=49) 指正 — 应查插件市场/GitHub/网络搜索。

**本任务目标**:
- 真调查 GitHub + npm + DSH community catalog, 标每个名字**真存在/不存在**
- 不装任何东西
- 不主动扩展到"应该装哪个/怎么用"
- 把"已确认"和"未决"都落盘

## 2. §1 + §1.5 + §2 约束

- §1: agora 中央不变; 这次纯调研不动任何代码
- §1.5: 不假装, 不推销, 不主动扩范围
- §2: 不补 CLI/REST/plugin 入口 (这是调研任务, 没人/agent 需要执行什么)
- §3: 本任务建立 task_dir, 含 task_plan + findings + progress
- §3 architecture capture: 同时建 architecture 子目录, 含 README + 1 undecided.md
- §4: 不需要 TDD (没写代码)

## 3. 阶段

1. ✅ turn 49 step 6-7: 查了5 个 (dsh-automation / dsh-revive / dsh-memory-evolve / dsh-chaos / dsh-swarm), 找到3 个真存在
2. ⏳ turn 51+ step 2+: 查剩下11 个 + 已查5 个的完整 catalog (作者/stars/状态/license)
3. ⏳ 写 `findings.md` (≥40 个真存在的插件, 加分类)
4. ⏳ 写 `progress.md` (阶段完成情况)
5. ⏳ 写 `Doc/03-ARCHITECTURE/2026-08-29-dsh-ecosystem-probe/README.md` (索引)
6. ⏳ 写 `Doc/03-ARCHITECTURE/2026-08-29-dsh-ecosystem-probe/undecided.md` (用户问的"哪些建议使用的"还悬)

## 4. Constitution Constraints

- 不装任何新插件 (只读 npm/GitHub)
- 不动 agora 中央
- 不动 `dsh-matrix-connector`
- 不写 `/tmp/*` (用 `~/.cache/` 或工作区)
- SSoT (`docs/Agora-实施排期-Agora-TS.md`) 这次调研任务不强制要求 — 用户在 turn 38 已经确认 SSoT 不存在不作 §3 阻断

## 5. worktree / 分支

纯调研, **不**开 worktree (按 §3 — 纯只读分析可不新开)。`Doc/` 在独立 doc 仓, 不在 dsh-agora 代码 worktree 里。

## 6. 验证口径

- 每个用户提的16 个插件名, 必须有 "✅ 真存在 + URL + stars + 1 行说明" 或 "❌ 搜索不到" 二选一
- 找到的"额外发现" (用户的列表里没提的同类工具) 必须**单独**标注, 不能假装是用户问的