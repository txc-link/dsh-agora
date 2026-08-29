# Findings: Tutti·VM Paradigm Review (2026-08-29)

## 1. Tutti·VM 4 大机制的 first-principles 拆解

### 机制 A: 共享工作现场 (Room)
- 它怎么做的: 多人 + 多 Agent 共享同一份 文件 + 预览 + 任务 + 历史
- 本质: **统一地址 + 实时同步**, 不是 "消息流"
- 我们对应: agora Task 表 (SQLite) + matrix thread (SSE) — **两条独立流**
- 借鉴: **WorkSite 抽象** — 不是 SaaS Room, 是 URI 协议

### 机制 B: @深度引用 = pull 对象
- 它怎么做的: @ 历史片段/文件/任务/设计稿 = 直接 pull 原始内容
- 本质: **引用即上下文**, 消除"中间人转述"
- 我们对应: `@<citizen>` 只是 IM 通知字符串; agent 真要对象内容只能自己 fetch
- 借鉴: **在 IM 消息里 embed `agora://` URI**, agent 收到的 payload 直接有对象

### 机制 C: Agent 借用
- 它怎么做的: 跨 Room 跑同一个 Agent, 共享配置 + 模型额度
- 本质: **Agent 跨域移动, 但身份 + 配置不复制**
- 我们对应: dsh-agent-teams 是 captain+member 固定拓扑, 不能借出
- 借鉴: **agora borrow_request 任务类型**, 走 dashboard human approve

### 机制 D: Room 内置应用
- 它怎么做的: 工具 = Room 对象, 任何人都能 @ 调用
- 本质: **工具 = 一等公民**, 不只是 agent 内置
- 我们对应: 工具是 agent 内置 (DSH built-in tools)
- 借鉴: **暂不做** — 风险大于收益; agent 内置工具就够

## 2. 我们跟 Tutti·VM 的根本不同 (决定不抄)

| 维度 | Tutti·VM | 我们 |
|---|---|---|
| 部署 | SaaS (云端 Room) | 本地优先 (DSH session 本地) |
| 用户 | 多租户 (多人 + 多 Agent 共享 Room) | 单人 + 多 Agent (captain + members) |
| 凭证 | 本地 VM 跑 Agent, Room 同步状态 (这是亮点) | DSH session 本地跑 (我们已经是这样) |
| 目标 | 拆"消息中介"的墙 | "长期受控工作", 必须有 human approve + audit |

**关键不抄**:
- ❌ 不建 SaaS Room
- ❌ 不搞多租户
- ❌ 不让 Agent 自发无审批地跑 (这是我们 turn 25 "受控"的核心)

**关键抄**:
- ✅ 共享工作现场 (URI 抽象, 不是 Room)
- ✅ @引用即上下文 (pull 对象)
- ✅ Agent 借用 (但走 agora 中央 + dashboard human approve)

## 3. 工作现场层的URI 协议设计

### URI 模式

```
agora://task/<task_id>            → Task 完整 state machine + history
agora://thread/<thread_key>       → IM thread 完整消息流
agora://commit/<commit_sha>       → git commit 完整 diff + 关联 task
agora://watch/<watch_id>          → sentinel watch 当前 state + 历史触发
agora://workspace/<worktree_path> → 当前 worktree 状态 + 改动
agora://session/<session_ref>     → DSH session 当前 turn + 历史
```

### URI 怎么被 pull
1. IM 消息含 `agora://task/abc123`
2. matrix-connector 在 emit SSE event 前, 自动 fetch 这个 URI, 把对象 embed 进 payload
3. agent 收到的事件 `message.context.objects = [{type: "task", ref: "agora://task/abc123", content: <完整 Task>}]`
4. agent 不需要再 fetch

### URI 谁有权限
- 现在: 按 agora 现有 ACL (每个 task 的 participant)
- 未来: dashboard 可以加 "URI 公开/私有/临时" 标签

## 4. 借鉴后, 我们距离 turn 25 目标的真缺 (更新版)

| 缺口 | 严重度 | 现状 | Tutti 借鉴方案 |
|---|---|---|---|
| 没真任务 end-to-end | 🔴 顶 | 单插件测通过, 没集成 | Phase 4 选项目跑 |
| 共享工作现场层 | 🟠 高 | Task + Thread 两条流分开 | Phase 1 WorkSite 抽象 |
| @pull 对象 | 🔴 高 | @ 只能贴文字 | Phase 2 URI pull |
| Agent 借用 | 🟠 中 | 不能跨房 | Phase 3 borrow + ACL |
| 主动触发 | 🟠 高 | sentinel 已有, 缺业务 | 跟 Phase 4 一起 |
| 维护循环 | 🟡 中 | stuck alert 已有 | 用 sentinel 长期保活 |
| 进化 schema | 🟢 低 | graph-memory 已有 | 跑完后沉淀 |

## 5. Tutti·VM 给我们的**反面**教训 (重要)

### 它没解决的
- 多 Agent 之间的**长期**协同 — Tutti 房间是"当下"的, session 死了 Room 还活着但 Agent 状态没了
- **受控** — Tutti 没强制 human approve, Agent 互相借是自由的
- **可信** — Tutti 解决"凭证不离开", 但没解决"审计 + 复盘"

### 这些正是我们 turn 25 要做的
- 长期: dsh-sentinel 已装 (Tutti 没这个)
- 受控: agora 中央 + dashboard (Tutti 没这个)
- 审计: agora 中央有 audit log (Tutti 房间有历史但不是审计)

**结论**: 我们**不抄 Tutti 全套**, 只借它 "共享状态 + 引用即上下文" 的**两个机制**, 加上我们已有的 "受控 + 长期 + 审计" 是差异化优势。

## 6. 没回答的问题 (undecided.md 跟踪)

- URI 协议: 是 1 个 URI 还是分多个 scheme? (agora:// / matrix:// / git://)
- pull 走同步还是异步? (现在 matrix SSE 是异步, embed 在 emit 时做?)
- Agent 借用的边界: 谁能借谁? 借多久? 借多久回滚?
- ACL 是不是跟"已确认的设计" 一起做, 还是单独 phase?
- Phase 4 选哪个项目跑 (turn 52 我列了 4 个候选, 用户还没选)