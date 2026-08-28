# Architecture: Shared Work Site (2026-08-29)

> 来源: 2026-08-29 t=55 用户提供 Tutti·VM 产品介绍, 要求"结合这个想怎么实现目标"。
> agent (t=55) 拆 4 机制, 定位真缺, 设计 4-phase 方案。

## 子目录索引

- [`01-worksite-abstraction.md`](./01-worksite-abstraction.md) — WorkSite 抽象 (统一 Task/Thread/Commit/Watch 地址)
- [`02-uri-protocol.md`](./02-uri-protocol.md) — `agora://` URI 协议 (跨域引用)
- [`03-deep-reference-pull.md`](./03-deep-reference-pull.md) — @深度引用 = pull 对象
- [`04-agent-borrow.md`](./04-agent-borrow.md) — Agent 借用 + 受控 ACL
- [`undecided.md`](./undecided.md) — 未决事项

## 已确认的设计

### 1. 借鉴 vs 不借鉴 (核心决策)

**借鉴 Tutti·VM 的 2 个机制**:
- ✅ **共享工作现场** — WorkSite 抽象 + URI 协议 (不是 SaaS Room)
- ✅ **@深度引用 = pull 对象** — IM 消息里 embed URI, agent 收到的事件 payload 直接含对象

**不抄 Tutti·VM 的 3 件事**:
- ❌ **SaaS Room** — 我们本地优先 (DSH session 本地)
- ❌ **多租户** — 我们是单人多 agent 拓扑 (captain + members)
- ❌ **Agent 自发无审批** — 我们 turn 25 明确要"受控"

**我们差异化优势** (Tutti 没做的):
- ✅ **长期** — dsh-sentinel 已装, 跨 session 唤醒
- ✅ **受控** — agora 中央 + dashboard 强制 human approve
- ✅ **审计** — agora 中央 audit log

### 2. 4-phase 实施顺序

| Phase | 内容 | 状态 |
|---|---|---|
| 1 | WorkSite 抽象 + URI 协议 (agora 中央) | 设计 |
| 2 | @深度引用 = pull 对象 (matrix-connector) | 设计 |
| 3 | Agent 借用 + 受控 ACL | 设计 |
| 4 | 真任务 end-to-end 跑 + walkthrough | 待用户选项目 |

### 3. URI 协议 (草案)

```
agora://task/<task_id>            → Task state machine + history
agora://thread/<thread_key>       → IM thread 完整消息流
agora://commit/<commit_sha>       → git commit 完整 diff + 关联 task
agora://watch/<watch_id>          → sentinel watch 当前 state + 历史触发
agora://workspace/<worktree_path> → 当前 worktree 状态 + 改动
agora://session/<session_ref>     → DSH session 当前 turn + 历史
```

详细设计见 [`02-uri-protocol.md`](./02-uri-protocol.md)

### 4. §1 + §1.5 边界

- §1: agora 中央语义不变, WorkSite 是 Core 内的**纯抽象** (不绑具体 IM/git/sentinel)
- §1.5: 不写兼容层, 不写兜底, 不写降级; 4 phase 都是设计 (没写代码)
- §2: 不补 CLI/REST/plugin (设计阶段, 不暴露)

## 错误更正 / 反思

### agent 这次的边界
- ✅ 只做了 brainstorm, 没动 Core 代码
- ✅ 只借鉴 2 个机制, 不抄 SaaS Room
- ✅ 跨子话题 brainstorm 落 4 子文档 + undecided (按 §3)
- ⚠️ 但**不能**自作主张选 Phase 4 真项目 — 等用户决策

## 跟踪

- task_plan: `Doc/09-PLANNING/TASKS/2026-08-29-tutti-vm-paradigm-review/task_plan.md`
- findings: `Doc/09-PLANNING/TASKS/2026-08-29-tutti-vm-paradigm-review/findings.md`
- progress: `Doc/09-PLANNING/TASKS/2026-08-29-tutti-vm-paradigm-review/progress.md`