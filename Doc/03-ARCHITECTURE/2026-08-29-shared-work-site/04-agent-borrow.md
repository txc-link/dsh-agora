# 04: Agent 借用 + 受控 ACL

## 目的

借鉴 Tutti·VM 的 "Agent 借用", 让一个 DSH session (Agent) 能在另一个 agora task 上跑, 但**走 agora 中央 + dashboard human approve**, 不像 Tutti 那样自由无审批。

## 设计原则

- §1: 借用是 Core 内的纯抽象, 不绑具体 agent runtime
- §1.5: 最短实现, 不做兼容层
- **必须** 受控 — 任何借用都需要 human approve
- **必须** 走 agora 中央 — 不允许 agent 间私下协商
- **必须** 复用现有 agora Task 状态机 — 不发明新状态机

## 现状 — 不能借

dsh-agent-teams v0.1.13:
- captain + member 拓扑是固定的
- member 不能从外部加入
- member 不能被外部借出
- 借用只能在 team 创建时 (captain `add_member`)

**真问题**: 
- user A 想让 user B 的 captain 帮自己跑个 task, 不能
- A 想让 B 的 member 临时顶替自己完不成的 task, 不能
- B 想让自己的 member 在 A 的房间里跑 (受控), 不能

## 借鉴后 — 受控借用

### Borrow 协议

```ts
interface BorrowRequest {
  type: 'borrow_request';
  source_session_id: string;     // 借出方 (谁提供 agent)
  source_agent_role: string;     // 借出什么 role 的 agent
  target_task_id: string;        // 跑在哪个 task 上
  target_session_id: string;     // 跑到哪个 session (原 session / 新建)
  reason: string;                // 为什么借
  ttl_seconds: number;           // 借多久 (秒, 默认 3600)
}

interface BorrowApproval {
  type: 'borrow_approval';
  source_user_id: string;        // 借出方的人类 (must be human, dashboard login)
  approval_at: ISODateTime;
  expires_at: ISODateTime;       // ttl 到期自动收回
}

interface BorrowRevocation {
  type: 'borrow_revocation';
  reason: string;                // 为什么收回 (manual / ttl / task complete)
}
```

### Borrow 流程

```
[1] agent A 在自己的 session 发 borrow_request
        agora 中央记录 borrow_request 任务
        events emit 到 matrix room
[2] dashboard human (source_user_id) 看到 borrow_request
        强制走 dashboard login 确认
        写 borrow_approval
        events emit
[3] agent A 的 session 收到 approval
        开始在 target task 上跑
        用 source agent 的 model + tools
        凭证不离开 source session (DSH 本地跑优势)
[4] 3 种收回条件:
        a. ttl 到期 (auto revoke)
        b. source_user 手动收回 (dashboard)
        c. target task complete (auto revoke)
        写 borrow_revocation
        events emit
```

### 关键约束 (受控核心)

| 约束 | 怎么强制 |
|---|---|
| **必须 human approve** | borrow_approval 字段必须由 dashboard session 写入, CLI/REST 写入被拒 (按 §2) |
| **必须走 agora 中央** | 没有私下通道, 所有 borrow 协议都过 agora Task |
| **凭证不离开** | source agent 在 source session 跑, 只是"代理跑" target task |
| **ttl 自动收回** | agora 中央 scheduler 检查 expires_at, 自动 revoke |
| **source 可随时收回** | borrow_revocation 任何时候可以发, 不需要 target 同意 |
| **审计可追** | borrow_request + approval + revocation 都在 agora audit log |

### Agent 借出后跑在哪里

**不是**: source session 物理移动到 target (Tutti 那种)
**而是**: source session 启动 1 个 sub-agent (用 dsh-agent-teams 已有的 long-running capability), 这个 sub-agent 在 target task 上跑

**优势 (DSH + Tutti 都没的)**:
- source session 仍然活着, source_user 可以随时 revoke
- sub-agent 失败不影响 source session
- 跑完 sub-agent 销毁, source session 回到空闲

## 跟 §1 + §2 的关系

### §1: Core 抽象
- `BorrowRequest` / `BorrowApproval` / `BorrowRevocation` 都是 Core 内的纯类型
- 不绑具体 agent runtime — 移除 dsh-agent-teams 也不变
- 不绑具体 IM — borrow_request 通过 agora 中央, IM 只是 notifications

### §2: Entry Surface
- borrow_request: **CLI** (agent 触发) + **REST** (plugin/slash bridge)
- borrow_approval: **只允许 Dashboard** (按 §2 — 必须真实人类登录)
- borrow_revocation: Dashboard + CLI 都允许 (source 可主动收回, ttl 由 agora 自动)

## 实施顺序 (Phase 3 拆分)

| Step | 内容 | 谁做 |
|---|---|---|
| 3.1 | agora Task 加 `borrow_*` type 扩展 | Core 开发 |
| 3.2 | agora 强制 borrow_approval 走 dashboard | Core + Dashboard |
| 3.3 | agora ttl scheduler (auto revoke) | Core 开发 |
| 3.4 | dsh-agent-teams 接入 borrow (sub-agent 启动) | dsh-agent-teams 开发 |
| 3.5 | matrix-connector `/agora borrow` slash command | matrix-connector 开发 |
| 3.6 | dashboard "借出管理" UI (source_user 看自己借出什么 + 收回) | Dashboard 前端 |

## 验收

- [ ] agent 发 borrow_request, dashboard 强制人 confirm
- [ ] CLI 发 borrow_approval 被拒 (按 §2)
- [ ] ttl 到期, sub-agent 自动停止 + borrow_revocation 写入
- [ ] source_user 手动 revoke, sub-agent 立即停止 (within 1s)
- [ ] borrow_request + approval + revocation 都在 audit log
- [ ] 没有"私下借" 路径 — 所有 borrow 都过 agora 中央
- [ ] sub-agent 失败不影响 source session

## 不做的事

- ❌ 不做"自由借" (Tutti 那样, 不需要 approve)
- ❌ 不做 agent 物理移动 (Tutti 那种 session 跑在别处)
- ❌ 不做"借额度但不借 agent" (Tutti 那种) — 我们借的是 agent 整体
- ❌ 不做"借方付费" (Tutti 那种消耗授权人额度) — 现在默认 source_user 承担额度
- ❌ 不做"agent 借出市场" — 我们是单组织内受控借用, 不是 SaaS