# Core Closure 1–3 — task plan

## 目标

在不修改任何 DSH provider 源码的前提下，补齐 Agora Core 的三段闭环：

1. `GovernedDispatchEnvelope`：把 task、collaboration plan、delegation authority、execution baseline 组合成 provider-neutral 的一次派发合同，并在已批准计划的任务上启用 strict mode。
2. Task timeline：把状态、流程、进度、审计、runtime dispatch、artifact 聚合为可查询时间线；暴露 idle/stuck 判定；为过期 claim 提供显式 takeover。
3. Document version chain：Markdown artifact 形成 parent/version/diff/review 链，并能按 task 查询。

## 边界

- 只改 `agora-ts` Core、contracts、DB repository、server/CLI composition root 和文档。
- 不改 `dsh-agora-plugin`、`dsh-matrix-connector` 或其他 provider adapter 源码。
- 既有未治理 task 保持兼容；仅存在 approved/active CollaborationPlan 的 task 强制治理 envelope。

## 工作树

- worktree: `E:\Learn AI Agent\dsh-agora\.worktrees\core-closure-1-3`
- branch: `feat/core-closure-1-3`
- base: `master` (`3aeedb1`)

## 验收

- provider-neutral envelope 可解析、自动选择有效 authority/baseline、拒绝越权。
- strict task 无 envelope 不创建 dispatch；正常任务既有路径不回归。
- timeline 返回稳定排序和 stuck 状态；过期 claim 可 takeover，活跃 claim 不可抢占。
- Markdown root/version/review metadata 可恢复，跨 owner 的 parent 被拒绝。
- build、architecture/barrel gates、改动文件 lint 和聚焦回归通过。
