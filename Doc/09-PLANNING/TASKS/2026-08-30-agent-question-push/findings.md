# Findings: Agent Question Push

## 复用盘点（turn 163 调研 + 本轮确认）

- `IMMessagingPort.sendNotification(targetRef, payload)` — core 已有的推送缝（im-ports.ts），payload {task_id, event_type, data}，StubIMMessagingPort 可测
- borrow-command/claim-command 的 CLI runner 模式可直接复用
- repository 模式仿 task-claim.repository.ts

## 设计决策

### D1: ResearchRequestService 并入 AgentQuestionService（对照蓝图的修正）
- 蓝图 04 原设计独立 ResearchRequestService
- 第一性原理: "发起调研请求→结果回填" 语义上就是 question(kind=research) → answer(结果)；单独建 service 是重复状态机
- **决定**: kind='research' + answer 字段承载结果，蓝图偏差记录在案

### D2: escalation 是状态不是 kind
- 蓝图把 'escalation' 列为 kind；但升级是 pending 问题的**转换**（pending→escalated），不是问题类型
- **决定**: kinds = clarify/resource/approval/info/research；状态含 escalated

### D3: answer 不回推 agent
- 回推需要 agent 在线接收通道（runtime 语义），core 只做记录
- agent 侧用 `agora ask list/show` 轮询（与任务台模式一致）
- 未来 runtime 侧可加事件订阅，不属本轮

### D4: approval 类问题的 Dashboard 门控
- §2 说必须人类确认的动作走 Dashboard 登录态；但 ask 的 answer 是信息回填不是权限动作
- approval kind 问题**指向**人类决策，但记录/路由语义在 core 成立（不依赖"是不是人"）
- 未来若 approval 需要强门控 → Dashboard UI 层做，core 不变

### D5: target ref 解耦
- assistantRef/ceoRef 都是构造注入的普通字符串 ref（如 'agent:assistant' / 'human:ceo'）
- core 不知道 ref 背后是 agent 还是人（U2 不阻塞实现）

## 环境记录

- worktree `.dsh/workspaces/agent-question`，node_modules 复用 S2 记录的流程（SKILL: agora-sandbox-worktree-setup）
