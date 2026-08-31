# T_transfer — assignee reassignment design (follow-up)

> **Status**: design-only reference (NOT implemented in master).
>
> Walkthrough §3 deferred T_transfer because it touches Core semantics
> (RuntimeBinding, Employment). This doc captures the agreed
> shortest-path proposal and the open questions the user needs to
> decide before code lands.
>
> **Slice attempt + unwind log**:
> - 2026-08-31 step 17-37 (turn 7): implemented as slice 1 on
>   `feat/2026-08-31-T-transfer` (commits ba32cdb + bcccbab): migration
>   045_task_transfers + TaskTransferRepository + TaskTransferService
>   (decideAuthority + transferTaskRequest + listHistory) + CLI verb
>   `agora task transfer` (writes pending + opens task_transfer
>   approval) + §9 decisions applied per turn108 autonomy + §1.5
>   defaults. 7/7 unit tests green.
> - 2026-09-01 step 1-5 (turn 8): user said "逆序" — `git push origin
>   --delete feat/2026-08-31-T-transfer` + worktree removed + local
>   branch deleted. master was never affected (no merge).
> - 2026-09-01 step 16-17 (turn 9): publish-dsh-matrix-connector-0.6.0.md
>   + monitoring-relay systemd/container docs landed; T_transfer remains
>   un-implemented in master.
>
> **§9 decisions status**: the default recommendations captured in §9
> were applied during the transient slice (see §2 below) but are no
> longer authoritative — the user may change any of them before the
> next implementation attempt.

## 1. 问题与边界

用户 turn 1 提出的任务中心缺口包括 **拆解 / 进度 / 转派 / 审批**。
2026-08-31 next-batch 落地了拆解（CLI `agora task subtasks`）、进度
（`getTaskProgress` + Dashboard `SubtaskPanel`）、审批（`/api/approvals/pending`
+ `/api/approvals/:id/decide`）。**转派未落地**。

"转派"的语义（first-principles）：

- 当前 task 由 runtime X 执行（绑定于 Employment EX / agent AX）；
- 人类在 Dashboard 决定转交给 runtime Y（Employment EY / agent AY）；
- 转派后 task 的执行者切到 Y，但 task 状态机、conversation、commitment
  ledger 不变（任务内容不丢）。

两类转派：

| 类型 | 触发场景 | 落点 |
|---|---|---|
| **A. 同组织内转派** | on-call 互备；当前 assignee 不可用 | `task.team.members[]` 的对应 role 改 `agentId`；`task_runtime_bindings` 改 `runtime_target_ref` |
| **B. 跨组织 / 跨 runtime 域转派** | EA 把工程任务从公司域交给生活管家 | 同 A，但需要 runtime_target 域切换 → 走 governance（InformationPolicy + Consent） |

两类都走 **Human Gate（A4）**——属于"必须由人类确认的动作"。

## 2. 既有 surface（不能重写，仅扩展）

- `task.team.members[]`：`{ role, agentId, member_kind, model_preference }` —
  当前是模板绑定，**不是** runtime 绑定。
- `task.runtime_binding_reason`：状态字段（`controller_preserved` /
  `stage_roster_excluded`），仅记录为何保留 controller；不含 runtime_target_ref。
- `RuntimeTarget`（`RuntimeTargetService`）：节点/运行时目标清单；
  `runtime_target_ref` 形如 `dsh:node-a:default`。
- `Employment`（`OrganizationService`）：人事绑定，
  `transferEmployment(employmentId, target_position_id, reason)` 已存在
  但只改 employment，不联动 task。
- `TaskClaimService`：运行时认领（agent 抢 task），不是 reassign。

真实 "task 转派" 触达：① task.team.members（role 改 agentId 或
runtimeTargetRef），② 写 `task_runtime_bindings` 表（runtime_target_ref
+ 原因 + 谁批准），③ conversation 镜像一条 "transferred by X to Y"，
④ 若 task 处于 gate/approval 状态 → 让现有 gate flow 继续（不中断），
⑤ 通知 IM（projection line）。

## 3. 提议接口（adapters/Dashboard 视角）

```text
POST /api/tasks/:taskId/transfer
  body: {
    target_runtime_ref: string        # dsh:node-a:default
    target_employment_id?: string     # 可选；未给时按 runtime 选可用 employment
    reason: string                    # 必填
  }
  202: { task: TaskRecord, approval_required: false, transfer_id: string }  # human auto-approved by session
  202: { approval_required: true, transfer_id: string, approval_id: string }  # needs explicit approval
  400: missing runtime / same-runtime / bad reason
  403: insufficient authority (A4 dashboard session absent)
  409: task state machine forbids reassign (e.g. done/cancelled)

GET  /api/tasks/:taskId/transfer/history
  200: { transfers: Array<{ id, from_runtime_ref, to_runtime_ref, reason, decided_by, decided_at, approval_id }> }
```

字段落点（Core 抽象，平台无关）：

```ts
transferTask(taskId, {
  from_runtime_ref: string;
  to_runtime_ref: string;
  target_employment_id?: string | null;
  reason: string;
  decided_by: string;       // Dashboard session username
  comment?: string;
}): Promise<{ task: TaskRecord; transfer_id: string; approval_id?: string }>;
listTaskTransfers(taskId): TaskTransferRecord[];
```

`TaskTransferService` 持有 `transferTask` + `listTaskTransfers`，
**所有规则在 service 内**，adapter / REST / CLI / connector slash
全部委托。Core 不写死 Discord / Feishu / IM（§1 三层口径）。

## 4. Human Gate（A4）策略

两条路径：

- **`approval_required: false`**：Dashboard session + caller 的 actor 在
  `assertTaskTransferAuthority(task, actor)` 通过（task owner 或
  organization admin）。直接落 transfer，不开 approval。
- **`approval_required: true`**：否则写 `task_transfer_request` 行
  （status=pending），等待 Dashboard `POST /api/approvals/:id/decide`
  按 gate_type=`task_transfer` 路由。**复用**现有
  `TaskApprovalService.decideApproval`，加 gate_type case 分派到
  `TaskTransferService.applyTransfer`。

两条路径都遵守 A4：**只允许 Dashboard session 触发**，CLI/connector
slash 只能写 transfer *request*（不直接 apply），Connector 端 `/agora
task transfer <id> --to <runtime>` 落到 pending row。

## 5. 数据迁移（最小集）

新表 `task_transfers`：

```sql
CREATE TABLE IF NOT EXISTS task_transfers (
  id                  TEXT PRIMARY KEY,
  task_id             TEXT NOT NULL,
  from_runtime_ref    TEXT NOT NULL,
  to_runtime_ref      TEXT NOT NULL,
  target_employment_id TEXT,
  reason              TEXT NOT NULL,
  decided_by          TEXT,             -- session username or NULL (pending)
  approval_id         TEXT,             -- links to approval_requests (nullable)
  status              TEXT NOT NULL,    -- pending | applied | rejected | cancelled
  applied_at          TEXT,
  rejected_at         TEXT,
  metadata            TEXT,             -- JSON: previous team.members snapshot
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_transfers_task
  ON task_transfers(task_id, applied_at DESC);
```

`approval_requests` 表已存在（migration 012）。`gate_type='task_transfer'`
行挂 task_transfers.id ↔ approval_requests.id 双向引用即可，
**不引入新 approval kind**。

## 6. 与既有 flow 的关系

| 既有 flow | 转派后行为 |
|---|---|
| TaskConversationService | 写 conversation entry: `transferred from X to Y by Z` |
| TaskStageService.gate | 不重置 stage；若 gate 等待 → 仍按原 gate 流程 |
| RuntimeDispatch | **重启** dispatch（send-complete + 新 runtime 重新 dispatch）；保留 result envelope 历史 |
| TaskClaim（agent claim）| claim 记录保留为审计（claim 发生在 transfer 之前/之后都允许） |
| Craftsman execution | 进行中的 execution 不中断；转派后的 subtask 由新 assignee 重试（标记 `retry_after_transfer`） |
| SubtaskPanel / progress | 立即反映新 assignee；旧 assignee 的活跃 execution 显示在 history |
| NotificationDispatcher | 写 `task_transferred` 行；scheduler 推送"任务已转派"消息到原 IM 房间 |

## 8. Tests / 冒烟（实现后）

- `task-transfer-service.test.ts`（核心）：
  - 同组织 / 跨组织转移语义
  - 权限闸（dashboard session 缺失返 403）
  - 拒绝路径：status=done / cancelled / block-by-gate
  - history 列表按时间倒序
- REST 集成（`apps/server/src/task-transfer-routes.test.ts`）：
  - 401 / 403 / 202 (auto) / 202 (approval pending) / 409
- CLI：`agora task transfer <id> --to <runtime> --reason <r>` 走 pending 路径
- Connector：`/agora task transfer <id> --to <runtime>` 写 pending row
- Dashboard：TransferReview 模态（在 T_center_ui 占位中声明的"coming soon" 落地点）
- IM 冒烟：转派消息送达原房间（需要 homeserver）

## 9. 未决问题（需要用户拍板）

| # | 问题 | 候选 | 影响 |
|---|---|---|---|
| 1 | 跨组织转派是否需要 organization admin 二次确认 | 是 / 否 | gate_type='task_transfer' 的 authority 规则 |
| 2 | 进行中 craftsman execution 在转派后是否自动中断 | 中断 / 保留至完成 / 保留+并发新 assignee | retry_after_transfer 行为 |
| 3 | transfer 历史是否暴露给被转派 agent | 是 / 仅显示转派后 | 个人维度隐私 |
| 4 | 转派是否同时改写 commitment ledger（delivery 凭据） | 是 / 否 | commitment 服务需联动 |
| 5 | retention：task_transfers 永久保留 vs N 月后归档 | 永久 / 1y / 6mo | storage policy |
| 6 | 批量转派（同一时刻把一组任务转给同一 runtime） | 单接口 + 数组入参 / 单接口只接单 task | REST 设计 |

## 10. 范围声明（实现时遵守）

按 §1.5：实现时只做最短路径——一个 `TaskTransferService` + 两个 REST
endpoint + 一个 CLI verb + 一个 Dashboard 模态 + 一个 migration；不
重写 existing flows；不引入 CRDT；不破坏 A1-A8。

实现前必须用户拍板 §9 的 6 个问题（至少 #1-#3），否则视为设计未冻结。