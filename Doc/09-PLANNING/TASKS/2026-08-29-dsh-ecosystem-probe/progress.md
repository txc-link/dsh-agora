# Progress: DSH Ecosystem Probe (2026-08-29)

## 阶段

| 阶段 | 状态 | 备注 |
|---|---|---|
| 1. ✅ turn 49 step 6-7: 查 5 个 (dsh-automation, dsh-revive, dsh-memory-evolve, dsh-chaos, dsh-swarm) | 完成 | 找到 3 真存在, 2 缺席 |
| 2. ✅ turn 51 step 4: 查 5 个 (routines, polling, schedule, agent-team, akn-plugin) | 完成 | 全部 ✅ 真存在 |
| 3. ✅ turn 51 step 5: 查 5 个 (routines/polling/schedule/agent-team/akn 验证) | 完成 | 多仓库验证, 全部真存在 |
| 4. ✅ turn 51 step 7: 查 5 个 (continual-harness, harness-ops, sentinel, catalog total, registry) | 完成 | continual + ops 真存在, catalog 总 2467-3100+ |
| 5. ✅ task_plan.md + findings.md 落盘 | 完成 | 2 文档, task_plan 6 阶段, findings 7 节 |
| 6. ⏳ Doc/03-ARCHITECTURE 子目录 + undecided.md | 进行中 | 接下来写 |
| 7. ⏳ 等用户回应 "建议使用的" | pending | 不主动装任何东西 |

## 关键证据 (turn 49 + turn 51)

- 16 个用户提的名字中: **14 真存在, 2 不存在** (chaos, swarm)
- catalog 总规模 **2467-3100+** 插件, 多个独立 registry (dsh-market / dsh-hub / findharness / dshget / deepseek1024 / awesome-dsh-plugin)
- 真存在的全是 **小型个人项目** (1-242 stars), 真正稳定可信的反而是 web profile 已装的几个 (agent-teams / sentinel / graph-memory / notifier)

## 错误更正 (已落 findings.md §5)

turn 46-48 agent 把"本机 web profile 没装"误解为"生态不存在"。**真**: 生态有 2467+ 插件, 只是本机没装那么多。

## 完成状态

- 调研任务本身: **完整完成**
- 建议哪些装: **未决** (undecided.md 跟踪)
- 装任何插件: **不做** (等用户决策)