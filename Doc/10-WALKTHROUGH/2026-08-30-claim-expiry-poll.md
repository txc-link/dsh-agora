# Walkthrough — Claim Expiry + Resident Poll (S2 收尾)

> 日期: 2026-08-30 · develop `8b0d3e6`
> Planning: `Doc/09-PLANNING/TASKS/2026-08-30-org-aware-task-claiming/`（收尾轮）

## 1. 目标

S2 两个收尾项: 认领超时自动释放（expire 周期执行）+ Poller 真实落地入口。

## 2. 交付

| 内容 | 文件 |
|---|---|
| `TaskClaimService.expireStale()` 批量过期扫描 | `core/src/task-claim-service.ts` |
| Poller 每轮先 expireStale（可选依赖, `PollResult.expired` 计数） | `core/src/resident-agent-poller.ts` |
| `runTaskClaimPollCommand` 单轮轮询（expire→扫未认领→匹配→认领） | `core/src/task-claim-command.ts` |
| `agora claim poll [--interval-ms]` 单轮/常驻入口 | `apps/cli/src/index.ts` |

## 3. 设计要点

- **第一性原理修正**: poller 属 agent 侧进程。认领语义 = "该 agent 真在场且现在能干活"; server 代所有 agent 认领会产生"任务被认领但 agent 不存在"的坏状态。原 checklist 的 server 常驻方案废弃, 以 agent 侧 `claim poll --interval-ms` 常驻替代（认领成功即退出 → agent 领活去干活）。
- expireStale 只扫 claimed 且 expiresAt 已过; released/expired 历史不参与; 无 expiresAt 的认领永不过期。
- 常驻模式每轮打印静默（只在认领成功或出错时输出 JSON）, 便于 agent runtime 消费。

## 4. 验证

- TDD: 8 新测试（expireStale 3 / poller expire 2 / poll command 3）; core+db 回归 **618/618**; build + 双 gate
- 真实冒烟 4/4: 单轮自动认领（expired 0/scanned 1/taskId 正确）→ 再 poll claimed=null → claim 状态确认 → 常驻模式循环正常
- 顺手修正: task-claim-command 测试 fake repo 的 insert 未入库且 id 固定, 与真实 DB 语义不符 → 唯一 id + 入库

## 5. 下一轮

S4 共享记忆（mem0 adapter, 用户指定复用; 本机即 mem0 服务器）。
