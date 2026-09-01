# Core Closure 1–3

来源：2026-09-01 对 Agora 长期公司助手目标的落地讨论；参与者：用户与 Codex。

## 已确认设计

### 1. Governed dispatch

`GovernedDispatchService` 将 `task_id`、approved/active `CollaborationPlan`、active 未过期 `DelegationAuthority` 和 approved 未过期 `ExecutionBaseline` 解析成 `agora.governed-dispatch/v1`。Runtime registry 只消费 envelope 携带的 `action_audit`，负责 admission 和 terminal receipt；provider 仍只收到普通 runtime dispatch。

当 task 存在 approved/active plan 时，缺失 envelope 的 dispatch 直接拒绝；无治理计划的存量 task 保持现有兼容路径。该策略保证治理语义留在 Core，不绑定 Matrix、OpenClaw、Hermes 或具体 DSH provider。

### 2. Task control plane

`TaskTimelineService` 合并 task updated、flow/progress logs、action attempts/receipts、runtime dispatches、task artifacts，按时间稳定排序并给出 `idle_ms`、阈值和 `is_stuck`。既有 `TaskRecoveryService` 继续负责 scheduler probe/escalation。

Task claim 只允许 owner release；claim 过期时下一次 claim 会先标记 expired。`takeover` 是显式动作，只能替换 stale claim，不能抢占 live claim。

### 3. Document chain

Markdown artifact 使用 metadata 表达 `version`、`parent_artifact_id`、`diff_base_sha256`、`diff_kind`、`diff_changed_bytes` 和 `review_status/reviewed_by/reviewed_at/review_comment`。owner kind/ref 是任务关联边界；不同 owner 的 parent 不可串链。review 在启用 auth 时要求 Dashboard 人类 session。

## 未决事项

- timeline 是否需要分页/游标，以及 stuck threshold 是否按 task type 配置。
- diff 当前保存摘要元数据，是否需要引入 unified diff artifact 或外部 diff worker。
- review 状态机是否要和现有 Gate/approval request 共享同一张人类审批记录。
- takeover 是否要在 Dashboard 增加专门的“接管原因/审计预览”面板。
